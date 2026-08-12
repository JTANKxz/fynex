"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Check, Crown, Eye, EyeOff, FolderPlus, Hash, Headphones, Maximize2, Menu, MessageCircle, Mic, MicOff, Minimize2, MonitorUp, MoreHorizontal, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Pencil, PhoneOff, Plus, Radio, Search, Settings, Square, UserPlus, Users, Volume2, VolumeX, Wifi, WifiOff, X } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { ChannelCategory, CommunityMemberRole, CommunityMemberTag, CommunityRoleIcon, CommunityRoleWithIcon, CommunitySticker, CommunityTag, Message as MessageRow, MessageReaction, PollVote, Profile, VoiceModerationEvent } from "@/lib/supabase/database.types";
import { deleteMessageAction, sendMessageAction, toggleMessageReactionAction, votePollAction } from "@/app/actions/messages";
import { banCommunityMemberAction, moderateVoiceMemberAction } from "@/app/actions/community-roles";
import { uploadToImageKit, type ImageKitUploadToken } from "@/lib/media/imagekit-client";
import { createClient } from "@/lib/supabase/client";
import { CreateChannelModal } from "@/components/community/create-channel-modal";
import { CreateChannelCategoryModal } from "@/components/community/create-channel-category-modal";
import { ManageChannelLayoutModal } from "@/components/community/manage-channel-layout-modal";
import { CreateCommunityModal } from "@/components/community/create-community-modal";
import { ConnectionsModal, type ConnectionsTab } from "@/components/community/connections-modal";
import { DirectMessagesModal } from "@/components/community/direct-messages-modal";
import { CommunityMembersModal } from "@/components/community/community-members-modal";
import { CommunitySettingsModal } from "@/components/community/community-settings-modal";
import { MemberProfileModal, type MemberProfile } from "@/components/community/member-profile-modal";
import { MessageActionsMenu, type MessageMenuState } from "@/components/community/message-actions-menu";
import { MessageAttachment } from "@/components/community/message-attachment";
import { MessageComposer } from "@/components/community/message-composer";
import { MessageMentionText } from "@/components/community/message-mention-text";
import { MessageLinkPreview } from "@/components/community/message-link-preview";
import { MessageReplyPreview, ReplyComposerPreview } from "@/components/community/message-reply-preview";
import { MessageReactions } from "@/components/community/message-reactions";
import { MessagePoll } from "@/components/community/message-poll";
import { MessageSticker } from "@/components/community/message-sticker";
import { VoiceMemberActions, VoiceMemberMenu, type VoiceMemberMenuState } from "@/components/community/voice-member-actions";
import { MediaSettingsModal, type ScreenPreset } from "@/components/community/media-settings-modal";
import { Avatar, RemoteAudio, ScreenVideo } from "@/features/community/media";
import { messageFromRow, type CommunityChannel, type CommunityMessage as Message, type CommunitySpace, type CommunityUser as User, type PresenceUser, type VoicePeer, type VoiceSignal as Signal } from "@/features/community/model";
import { EMPTY_COMMUNITY_ACCESS, resolveCommunityAccess } from "@/features/community/permissions";
import { CHAT_IMAGE_LIMIT, CHAT_IMAGE_MIMES, CHAT_VIDEO_LIMIT, CHAT_VIDEO_MIMES, type ChatAttachmentDraft } from "@/lib/media/chat-attachments";
import { extractFirstLink } from "@/lib/links";
import type { PollDraft } from "@/components/community/composer-extras";
import { respondFriendRequestAction } from "@/app/actions/social";
import { respondCommunityPairRequestAction } from "@/app/actions/community-identity";
import { RoleIcon } from "@/components/community/role-icon";

const seedMessages: Message[] = [];
type AppNotification = { id: string; author: string; text: string; communityId: string; channelId: string; channelName: string; createdAt: string; read: boolean };
type IncomingFriendRequest = { userA: string; userB: string; person: MemberProfile };
type IncomingPairRequest = { id: string; communityId: string; person: MemberProfile };
type ConnectionState = "idle" | "connecting" | "connected" | "reconnecting" | "offline";

export default function Home() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [communities, setCommunities] = useState<CommunitySpace[]>([]);
  const [communityChannels, setCommunityChannels] = useState<CommunityChannel[]>([]);
  const [channelCategories, setChannelCategories] = useState<ChannelCategory[]>([]);
  const [allCommunityChannels, setAllCommunityChannels] = useState<CommunityChannel[]>([]);
  const [activeCommunityId, setActiveCommunityId] = useState<string | null>(null);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [createCommunityOpen, setCreateCommunityOpen] = useState(false);
  const [channelModalType, setChannelModalType] = useState<"text" | "voice" | null>(null);
  const [newChannelCategoryId, setNewChannelCategoryId] = useState<string | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [channelLayoutOpen, setChannelLayoutOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<CommunityChannel | null>(null);
  const [connectionsTab, setConnectionsTab] = useState<ConnectionsTab | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [communitySettingsOpen, setCommunitySettingsOpen] = useState(false);
  const [communityMembers, setCommunityMembers] = useState<MemberProfile[]>([]);
  const [communityRoles, setCommunityRoles] = useState<CommunityRoleWithIcon[]>([]);
  const [communityRoleIcons, setCommunityRoleIcons] = useState<CommunityRoleIcon[]>([]);
  const [memberRoleAssignments, setMemberRoleAssignments] = useState<CommunityMemberRole[]>([]);
  const [communityTags, setCommunityTags] = useState<CommunityTag[]>([]);
  const [memberTagAssignments, setMemberTagAssignments] = useState<CommunityMemberTag[]>([]);
  const [communityStickers, setCommunityStickers] = useState<CommunitySticker[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<MemberProfile | null>(null);
  const [selectedProfileContext, setSelectedProfileContext] = useState<"community" | "external">("community");
  const selectedProfileContextRef = useRef<"community" | "external">("community");
  const [directMessagesOpen, setDirectMessagesOpen] = useState(false);
  const [directMessageTarget, setDirectMessageTarget] = useState<MemberProfile | null>(null);
  const [mediaSettingsOpen, setMediaSettingsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(seedMessages);
  const [messageReactions, setMessageReactions] = useState<Record<string, MessageReaction[]>>({});
  const [pollVotes, setPollVotes] = useState<Record<string, PollVote[]>>({});
  const [unreadCommunityCounts, setUnreadCommunityCounts] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [removedLinkPreviewUrl, setRemovedLinkPreviewUrl] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [replySnapshots, setReplySnapshots] = useState<Record<string, Message>>({});
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [messageMenu, setMessageMenu] = useState<MessageMenuState | null>(null);
  const [voiceMemberMenu, setVoiceMemberMenu] = useState<VoiceMemberMenuState | null>(null);
  const [attachment, setAttachment] = useState<ChatAttachmentDraft | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [voiceChannel, setVoiceChannel] = useState<string | null>(null);
  const [voicePanelChannelId, setVoicePanelChannelId] = useState<string | null>(null);
  const [pinnedVoiceUserId, setPinnedVoiceUserId] = useState<string | null>(null);
  const [voiceContext, setVoiceContext] = useState<{ communityId: string; communityName: string; channelName: string } | null>(null);
  const [screenSharing, setScreenSharing] = useState(false);
  const [localScreenPreview, setLocalScreenPreview] = useState<MediaStream | null>(null);
  const [watchingScreenId, setWatchingScreenId] = useState<string | null>(null);
  const [streamViewerOpen, setStreamViewerOpen] = useState(false);
  const [streamFullscreen, setStreamFullscreen] = useState(false);
  const [screenViewerCount, setScreenViewerCount] = useState(0);
  const [voicePeers, setVoicePeers] = useState<Record<string, VoicePeer>>({});
  const [voiceMembers, setVoiceMembers] = useState<Record<string, PresenceUser>>({});
  const [onlineUsers, setOnlineUsers] = useState<Record<string, PresenceUser>>({});
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState("");
  const [noiseSuppression, setNoiseSuppression] = useState(() => typeof window === "undefined" ? true : window.localStorage.getItem("fynex:noise-cancellation") !== "off");
  const [messageSoundEnabled, setMessageSoundEnabled] = useState(() => typeof window === "undefined" ? true : window.localStorage.getItem("fynex:message-sounds") !== "off");
  const [noiseSuppressionSupported] = useState(() => typeof navigator === "undefined" || navigator.mediaDevices?.getSupportedConstraints().noiseSuppression === true);
  const [noiseSuppressionApplied, setNoiseSuppressionApplied] = useState<boolean | null>(null);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [echoCancellationApplied, setEchoCancellationApplied] = useState<boolean | null>(null);
  const [autoGainControl, setAutoGainControl] = useState(false);
  const [microphoneVolume, setMicrophoneVolume] = useState(100);
  const [micTestActive, setMicTestActive] = useState(false);
  const [micTestLevel, setMicTestLevel] = useState(0);
  const [screenPreset, setScreenPreset] = useState<ScreenPreset>("standard");
  const [localScreenQuality, setLocalScreenQuality] = useState<{ height: number; frameRate: number } | null>(null);
  const [audioTrackVersion, setAudioTrackVersion] = useState(0);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [locallyMutedUsers, setLocallyMutedUsers] = useState<Set<string>>(() => new Set());
  const [speaking, setSpeaking] = useState(false);
  const [micError, setMicError] = useState("");
  const [realtimeError, setRealtimeError] = useState("");
  const [moderationNotice, setModerationNotice] = useState("");
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [chatConnectionState, setChatConnectionState] = useState<ConnectionState>("connecting");
  const [voiceConnectionState, setVoiceConnectionState] = useState<ConnectionState>("idle");
  const [mentionNotice, setMentionNotice] = useState<{ author: string; channelId: string; channelName: string } | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [incomingFriendRequests, setIncomingFriendRequests] = useState<IncomingFriendRequest[]>([]);
  const [incomingPairRequests, setIncomingPairRequests] = useState<IncomingPairRequest[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, { name: string; channelId: string }>>({});
  const [sending, setSending] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [membersCollapsed, setMembersCollapsed] = useState(false);
  const voiceRef = useRef<string | null>(null);
  const watchingScreenRef = useRef<string | null>(null);
  const userRef = useRef<User | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const rawLocalStream = useRef<MediaStream | null>(null);
  const microphoneAudioContext = useRef<AudioContext | null>(null);
  const microphoneGain = useRef<GainNode | null>(null);
  const micTestStream = useRef<MediaStream | null>(null);
  const localScreenStream = useRef<MediaStream | null>(null);
  const screenWatchers = useRef<Set<string>>(new Set());
  const screenStage = useRef<HTMLElement>(null);
  const peers = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const realtime = useRef<RealtimeChannel | null>(null);
  const voiceRealtime = useRef<RealtimeChannel | null>(null);
  const leaveVoiceRef = useRef<() => void>(() => undefined);
  const messagesContainer = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Message[]>([]);
  const receivedMessageSound = useRef<HTMLAudioElement | null>(null);
  const sentMessageSound = useRef<HTMLAudioElement | null>(null);
  const messageSoundEnabledRef = useRef(messageSoundEnabled);
  const ownMessageIds = useRef<Set<string>>(new Set());
  const highlightTimer = useRef<number | null>(null);
  const activeChannelRef = useRef<string | null>(null);
  const activeCommunityIdRef = useRef<string | null>(null);
  const communityMembersRef = useRef<MemberProfile[]>([]);
  const allCommunityChannelsRef = useRef<CommunityChannel[]>([]);
  const typingSentAt = useRef(0);
  const typingStopTimer = useRef<number | null>(null);
  const remoteTypingTimers = useRef<Map<string, number>>(new Map());
  const authenticatedUserId = user?.id;

  const refreshIncomingFriendRequests = useCallback(async () => {
    if (!authenticatedUserId) { setIncomingFriendRequests([]); return; }
    const { data: rows } = await supabase.from("friendships").select("user_a, user_b, requested_by").eq("status", "pending").neq("requested_by", authenticatedUserId);
    const relevant = (rows ?? []).filter((row) => row.user_a === authenticatedUserId || row.user_b === authenticatedUserId);
    const ids = relevant.map((row) => row.user_a === authenticatedUserId ? row.user_b : row.user_a);
    if (!ids.length) { setIncomingFriendRequests([]); return; }
    const { data: profiles } = await supabase.from("profiles").select("*").in("id", ids);
    const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    setIncomingFriendRequests(relevant.flatMap((row) => {
      const person = profileMap.get(row.user_a === authenticatedUserId ? row.user_b : row.user_a);
      return person ? [{ userA: row.user_a, userB: row.user_b, person: { ...person, roles: [], online: false } }] : [];
    }));
  }, [authenticatedUserId, supabase]);

  const refreshIncomingPairRequests = useCallback(async () => {
    if (!authenticatedUserId) { setIncomingPairRequests([]); return; }
    const { data: rows } = await supabase.from("community_pairs").select("id, community_id, requester_id").eq("recipient_id", authenticatedUserId).eq("status", "pending");
    const requesterIds = [...new Set((rows ?? []).map((row) => row.requester_id))];
    if (!requesterIds.length) { setIncomingPairRequests([]); return; }
    const { data: profiles } = await supabase.from("profiles").select("*").in("id", requesterIds);
    const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    setIncomingPairRequests((rows ?? []).flatMap((row) => {
      const person = profileMap.get(row.requester_id);
      return person ? [{ id: row.id, communityId: row.community_id, person: { ...person, roles: [], online: false } }] : [];
    }));
  }, [authenticatedUserId, supabase]);

  useEffect(() => {
    if (!authenticatedUserId) return;
    const task = window.setTimeout(() => void refreshIncomingFriendRequests(), 0);
    const channel = supabase.channel(`friend-notifications:${authenticatedUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => void refreshIncomingFriendRequests())
      .subscribe();
    return () => { window.clearTimeout(task); void supabase.removeChannel(channel); };
  }, [authenticatedUserId, refreshIncomingFriendRequests, supabase]);

  useEffect(() => {
    if (!authenticatedUserId) return;
    const task = window.setTimeout(() => void refreshIncomingPairRequests(), 0);
    const channel = supabase.channel(`pair-notifications:${authenticatedUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_pairs", filter: `recipient_id=eq.${authenticatedUserId}` }, () => void refreshIncomingPairRequests())
      .subscribe();
    return () => { window.clearTimeout(task); void supabase.removeChannel(channel); };
  }, [authenticatedUserId, refreshIncomingPairRequests, supabase]);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => { activeChannelRef.current = activeChannel; }, [activeChannel]);
  useEffect(() => { activeCommunityIdRef.current = activeCommunityId; }, [activeCommunityId]);
  useEffect(() => { allCommunityChannelsRef.current = allCommunityChannels; }, [allCommunityChannels]);
  useEffect(() => () => {
    if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
    remoteTypingTimers.current.forEach((timer) => window.clearTimeout(timer));
    remoteTypingTimers.current.clear();
  }, []);

  const loadCommunityPeople = useCallback(async (communityId: string) => {
    const [membersResult, rolesResult, assignmentsResult, tagsResult, tagAssignmentsResult, stickersResult, roleIconsResult] = await Promise.all([
      supabase.from("community_members").select("community_id, user_id, role, nickname, server_bio, server_accent_color, display_role_id, joined_at").eq("community_id", communityId),
      supabase.from("community_roles").select("*").eq("community_id", communityId).order("position", { ascending: false }),
      supabase.from("community_member_roles").select("*").eq("community_id", communityId),
      supabase.from("community_tags").select("*").eq("community_id", communityId).order("created_at"),
      supabase.from("community_member_tags").select("*").eq("community_id", communityId),
      supabase.from("community_stickers").select("*").eq("community_id", communityId).order("created_at"),
      supabase.from("community_role_icons").select("*").eq("community_id", communityId).order("created_at"),
    ]);
    const memberships = membersResult.data ?? [];
    const ids = memberships.map((membership) => membership.user_id);
    const profilesResult = ids.length
      ? await supabase.from("profiles").select("*").in("id", ids)
      : { data: [] as MemberProfile[] };
    const membershipMap = new Map(memberships.map((membership) => [membership.user_id, membership]));
    const roleIconMap = new Map((roleIconsResult.data ?? []).map((icon) => [icon.id, icon]));
    const roles: CommunityRoleWithIcon[] = (rolesResult.data ?? []).map((role) => ({ ...role, customIcon: role.custom_icon_id ? roleIconMap.get(role.custom_icon_id) ?? null : null }));
    const assignments = assignmentsResult.data ?? [];
    const tags = tagsResult.data ?? [];
    const tagAssignments = tagAssignmentsResult.data ?? [];
    const stickers = stickersResult.data ?? [];
    const nextMembers = (profilesResult.data ?? []).map((profile) => ({
      ...profile,
      joinedAt: membershipMap.get(profile.id)?.joined_at,
      nickname: membershipMap.get(profile.id)?.nickname ?? null,
      server_bio: membershipMap.get(profile.id)?.server_bio ?? null,
      server_accent_color: membershipMap.get(profile.id)?.server_accent_color ?? null,
      display_role_id: membershipMap.get(profile.id)?.display_role_id ?? null,
      bio: membershipMap.get(profile.id)?.server_bio ?? profile.bio,
      accent_color: membershipMap.get(profile.id)?.server_accent_color ?? profile.accent_color,
      isOwner: membershipMap.get(profile.id)?.role === "owner",
      roles: roles.filter((role) => assignments.some((assignment) => assignment.user_id === profile.id && assignment.role_id === role.id)),
      tags: tags.filter((tag) => tagAssignments.some((assignment) => assignment.user_id === profile.id && assignment.tag_id === tag.id)),
    }));
    if (activeCommunityIdRef.current !== communityId) return;
    communityMembersRef.current = nextMembers;
    setCommunityRoles(roles);
    setCommunityRoleIcons(roleIconsResult.data ?? []);
    setMemberRoleAssignments(assignments);
    setCommunityTags(tags);
    setMemberTagAssignments(tagAssignments);
    setCommunityStickers(stickers);
    setCommunityMembers(nextMembers);
    setSelectedProfile((current) => selectedProfileContextRef.current === "community" && current ? nextMembers.find((member) => member.id === current.id) ?? null : current);
  }, [supabase]);
  useEffect(() => {
    selectedProfileContextRef.current = selectedProfileContext;
  }, [selectedProfileContext]);
  useEffect(() => () => {
    if (attachment) URL.revokeObjectURL(attachment.previewUrl);
  }, [attachment]);

  const playSound = useCallback((sound: HTMLAudioElement | null) => {
    if (!sound) return;
    sound.loop = false;
    sound.currentTime = 0;
    void sound.play().then(() => { window.setTimeout(() => { sound.pause(); sound.currentTime = 0; }, 1800); }).catch(() => undefined);
  }, []);

  const syncWorkspaceUrl = useCallback((communityId: string, channelId: string | null) => {
    if (typeof window === "undefined" || voiceRef.current) return;
    const query = new URLSearchParams({ community: communityId });
    if (channelId) query.set("channel", channelId);
    window.history.replaceState(window.history.state, "", `/?${query.toString()}`);
  }, []);

  const loadWorkspace = useCallback(async (preferredCommunityId?: string, preferredChannelId?: string) => {
    const currentUserId = userRef.current?.id;
    if (!currentUserId) return;

    const { data: memberships, error: membershipError } = await supabase
      .from("community_members")
      .select("community_id")
      .eq("user_id", currentUserId);

    if (membershipError) {
      setRealtimeError("Não foi possível carregar suas participações.");
      return;
    }

    const communityIds = (memberships ?? []).map((membership) => membership.community_id);
    const { data: spaces, error } = communityIds.length
      ? await supabase.from("communities").select("*").in("id", communityIds).order("created_at", { ascending: true })
      : { data: [], error: null };
    if (error) {
      setRealtimeError("Não foi possível carregar suas comunidades.");
      return;
    }

    const available = spaces ?? [];
    setCommunities(available);
    const selected = available.find((space) => space.id === preferredCommunityId)
      ?? available.find((space) => space.id === activeCommunityIdRef.current)
      ?? available[0];

    if (!selected) {
      activeCommunityIdRef.current = null;
      setCommunityChannels([]);
      setAllCommunityChannels([]);
      setActiveCommunityId(null);
      setActiveChannel(null);
      return;
    }

    const [{ data: loadedChannels, error: channelError }, { data: loadedCategories }] = communityIds.length
      ? await Promise.all([
        supabase.from("channels").select("*").in("community_id", communityIds).order("position").order("created_at"),
        supabase.from("channel_categories").select("*").in("community_id", communityIds).order("position").order("created_at"),
      ])
      : [{ data: [], error: null }, { data: [] }];
    if (channelError) {
      setRealtimeError("Não foi possível carregar os canais.");
      return;
    }

    const everyChannel = loadedChannels ?? [];
    const nextChannels = everyChannel.filter((channel) => channel.community_id === selected.id);
    activeCommunityIdRef.current = selected.id;
    communityMembersRef.current = [];
    setCommunityMembers([]);
    setCommunityRoles([]);
    setCommunityRoleIcons([]);
    setMemberRoleAssignments([]);
    setCommunityTags([]);
    setMemberTagAssignments([]);
    setCommunityStickers([]);
    setMessages([]);
    setAllCommunityChannels(everyChannel);
    setActiveCommunityId(selected.id);
    setCommunityChannels(nextChannels);
    setChannelCategories((loadedCategories ?? []).filter((category) => category.community_id === selected.id));
    const selectedChannelId = nextChannels.find((channel) => channel.type === "text" && channel.id === preferredChannelId)?.id ?? nextChannels.find((channel) => channel.type === "text")?.id ?? null;
    setActiveChannel(selectedChannelId);
    syncWorkspaceUrl(selected.id, selectedChannelId);
    await loadCommunityPeople(selected.id);
  }, [loadCommunityPeople, supabase, syncWorkspaceUrl]);

  useEffect(() => {
    const received = new Audio("/sounds/message-received.mp3");
    const sent = new Audio("/sounds/message-sent.mp3");
    received.preload = "auto";
    sent.preload = "auto";
    received.volume = 0.7;
    sent.volume = 0.65;
    receivedMessageSound.current = received;
    sentMessageSound.current = sent;
    const stopMedia = () => [received, sent].forEach((sound) => { sound.pause(); sound.currentTime = 0; sound.removeAttribute("src"); sound.load(); });
    const stopWhenHidden = () => { if (document.visibilityState === "hidden") stopMedia(); };
    window.addEventListener("pagehide", stopMedia);
    window.addEventListener("beforeunload", stopMedia);
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () => {
      window.removeEventListener("pagehide", stopMedia);
      window.removeEventListener("beforeunload", stopMedia);
      document.removeEventListener("visibilitychange", stopWhenHidden);
      stopMedia();
      receivedMessageSound.current = null;
      sentMessageSound.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mobileNav) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNav(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileNav]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      sessionStorage.removeItem("fynex:user");
      sessionStorage.removeItem("nexo:user");
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.replace("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("id, username, display_name, accent_color, avatar_url, presence_status").eq("id", authUser.id).single();
      if (cancelled) return;
      if (!profile) { await supabase.auth.signOut(); router.replace("/login?error=profile"); return; }
      const current = { id: profile.id, username: profile.username, name: profile.display_name, color: profile.accent_color, avatarUrl: profile.avatar_url, status: profile.presence_status };
      userRef.current = current;
      setUser(current);
      const query = new URLSearchParams(window.location.search);
      await loadWorkspace(query.get("community") ?? undefined, query.get("channel") ?? undefined);
      setAuthLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loadWorkspace, router, supabase]);

  useEffect(() => {
    voiceRef.current = voiceChannel;
    if (!voiceChannel && activeCommunityId) syncWorkspaceUrl(activeCommunityId, activeChannel);
  }, [activeChannel, activeCommunityId, syncWorkspaceUrl, voiceChannel]);
  useEffect(() => { watchingScreenRef.current = watchingScreenId; }, [watchingScreenId]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => {
    const syncFullscreenState = () => setStreamFullscreen(document.fullscreenElement === screenStage.current);
    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);
  useEffect(() => {
    const container = messagesContainer.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [activeChannel, messages]);

  const post = useCallback((signal: Omit<Signal, "from">) => {
    const current = userRef.current;
    if (current) {
      void voiceRealtime.current?.send({
        type: "broadcast",
        event: "voice-signal",
        payload: { ...signal, from: current.id },
      });
    }
  }, []);

  const closePeer = useCallback((id: string) => {
    peers.current.get(id)?.close();
    peers.current.delete(id);
    pendingIceCandidates.current.delete(id);
    screenWatchers.current.delete(id);
    setScreenViewerCount(screenWatchers.current.size);
    setVoicePeers((old) => {
      const next = { ...old };
      delete next[id];
      return next;
    });
  }, []);

  const makePeer = useCallback((id: string, peerName: string) => {
    if (peers.current.has(id)) return peers.current.get(id)!;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    localStream.current?.getTracks().forEach((track) => pc.addTrack(track, localStream.current!));
    pc.onicecandidate = (event) => {
      if (event.candidate && voiceRef.current) {
        post({ type: "ice", to: id, channel: voiceRef.current, payload: event.candidate.toJSON() });
      }
    };
    pc.ontrack = (event) => {
      const incomingStream = event.streams[0] ?? new MediaStream([event.track]);
      if (event.track.kind === "video") {
        setVoicePeers((old) => ({ ...old, [id]: { ...(old[id] ?? { id, name: peerName, muted: false, speaking: false }), screenStream: incomingStream, screenSharing: true } }));
        event.track.onended = () => {
          setVoicePeers((old) => ({ ...old, [id]: { ...(old[id] ?? { id, name: peerName, muted: false, speaking: false }), screenStream: undefined } }));
        };
      } else {
        setVoicePeers((old) => ({ ...old, [id]: { ...(old[id] ?? { id, name: peerName, muted: false, speaking: false }), stream: incomingStream } }));
      }
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "closed"].includes(pc.connectionState)) closePeer(id);
    };
    peers.current.set(id, pc);
    setVoicePeers((old) => ({ ...old, [id]: old[id] ?? { id, name: peerName, muted: false, speaking: false } }));
    return pc;
  }, [closePeer, post]);

  const renegotiatePeers = useCallback(async () => {
    const current = userRef.current;
    const channel = voiceRef.current;
    if (!current || !channel) return;
    await Promise.all([...peers.current.entries()].map(async ([id, peer]) => {
      if (peer.signalingState !== "stable") return;
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      post({ type: "offer", to: id, channel, name: current.name, payload: offer });
    }));
  }, [post]);

  const renegotiatePeer = useCallback(async (id: string, peer: RTCPeerConnection) => {
    const current = userRef.current;
    const channel = voiceRef.current;
    if (!current || !channel || peer.signalingState !== "stable") return;
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    post({ type: "offer", to: id, channel, name: current.name, payload: offer });
  }, [post]);

  const handleVoiceSignal = useCallback(async (data: Signal) => {
    const me = userRef.current;
    if (!me || data.from === me.id || (data.to && data.to !== me.id)) return;
    if (data.type === "leave") { closePeer(data.from); return; }
    if (!voiceRef.current || data.channel !== voiceRef.current) return;

    try {
      if (data.type === "screen-state") {
        setVoicePeers((old) => ({
          ...old,
          [data.from]: {
            ...(old[data.from] ?? { id: data.from, name: data.name ?? "Visitante", muted: false, speaking: false }),
            name: data.name ?? old[data.from]?.name ?? "Visitante",
            screenSharing: !!data.screenSharing,
            screenStream: data.screenSharing ? old[data.from]?.screenStream : undefined,
            screenHeight: data.screenHeight ?? old[data.from]?.screenHeight,
            screenFrameRate: data.screenFrameRate ?? old[data.from]?.screenFrameRate,
          },
        }));
        if (!data.screenSharing && watchingScreenRef.current === data.from) {
          watchingScreenRef.current = null;
          setWatchingScreenId(null);
          setStreamViewerOpen(false);
          if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
        }
      } else if (data.type === "screen-watch") {
        const screenStream = localScreenStream.current;
        if (!screenStream) return;
        const pc = makePeer(data.from, data.name ?? "Visitante");
        const videoTrack = screenStream.getVideoTracks()[0];
        if (data.watching && videoTrack) {
          const alreadySending = pc.getSenders().some((sender) => sender.track?.id === videoTrack.id);
          if (!alreadySending) pc.addTrack(videoTrack, screenStream);
          screenWatchers.current.add(data.from);
        } else {
          pc.getSenders().filter((sender) => sender.track?.kind === "video").forEach((sender) => pc.removeTrack(sender));
          screenWatchers.current.delete(data.from);
        }
        setScreenViewerCount(screenWatchers.current.size);
        await renegotiatePeer(data.from, pc);
      } else if (data.type === "announce") {
        const pc = makePeer(data.from, data.name ?? "Visitante");
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        post({ type: "offer", to: data.from, channel: voiceRef.current, name: me.name, payload: offer });
        if (localScreenStream.current) {
          const settings = localScreenStream.current.getVideoTracks()[0]?.getSettings();
          post({ type: "screen-state", to: data.from, channel: voiceRef.current, name: me.name, screenSharing: true, screenHeight: settings?.height, screenFrameRate: settings?.frameRate });
        }
      } else if (data.type === "offer") {
        const pc = makePeer(data.from, data.name ?? "Visitante");
        await pc.setRemoteDescription(data.payload as RTCSessionDescriptionInit);
        for (const candidate of pendingIceCandidates.current.get(data.from) ?? []) await pc.addIceCandidate(candidate);
        pendingIceCandidates.current.delete(data.from);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        post({ type: "answer", to: data.from, channel: voiceRef.current, name: me.name, payload: answer });
      } else if (data.type === "answer") {
        const pc = peers.current.get(data.from);
        if (!pc) return;
        await pc.setRemoteDescription(data.payload as RTCSessionDescriptionInit);
        for (const candidate of pendingIceCandidates.current.get(data.from) ?? []) await pc.addIceCandidate(candidate);
        pendingIceCandidates.current.delete(data.from);
      } else if (data.type === "ice") {
        const pc = peers.current.get(data.from);
        if (!pc) return;
        const candidate = data.payload as RTCIceCandidateInit;
        if (pc.remoteDescription) await pc.addIceCandidate(candidate);
        else pendingIceCandidates.current.set(data.from, [...(pendingIceCandidates.current.get(data.from) ?? []), candidate]);
      } else if (data.type === "voice-state") {
        setVoicePeers((old) => ({ ...old, [data.from]: { ...(old[data.from] ?? { id: data.from, name: data.name ?? "Visitante" }), muted: !!data.muted, speaking: !!data.speaking } }));
      }
    } catch (error) {
      console.error("Falha na sinalização WebRTC", error);
    }
  }, [closePeer, makePeer, post, renegotiatePeer]);

  const stopWatchingScreen = useCallback(() => {
    const presenterId = watchingScreenId;
    if (presenterId && voiceRef.current) {
      post({ type: "screen-watch", to: presenterId, channel: voiceRef.current, watching: false });
      setVoicePeers((old) => old[presenterId] ? { ...old, [presenterId]: { ...old[presenterId], screenStream: undefined } } : old);
    }
    watchingScreenRef.current = null;
    setWatchingScreenId(null);
    setStreamViewerOpen(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }, [post, watchingScreenId]);

  const watchScreen = useCallback((presenterId: string) => {
    if (!voiceRef.current) {
      setMicError("Entre na sala de voz para assistir à transmissão.");
      return;
    }
    if (watchingScreenId && watchingScreenId !== presenterId) {
      post({ type: "screen-watch", to: watchingScreenId, channel: voiceRef.current, watching: false });
    }
    setMicError("");
    watchingScreenRef.current = presenterId;
    setWatchingScreenId(presenterId);
    setStreamViewerOpen(true);
    post({ type: "screen-watch", to: presenterId, channel: voiceRef.current, watching: true });
  }, [post, watchingScreenId]);

  const toggleStreamFullscreen = useCallback(async () => {
    const stage = screenStage.current;
    if (!stage) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stage.requestFullscreen();
    } catch {
      setMicError("O navegador não permitiu abrir a transmissão em tela cheia.");
    }
  }, []);

  const stopScreenShare = useCallback(async (renegotiate = true) => {
    const stream = localScreenStream.current;
    if (!stream) return;
    const trackIds = new Set(stream.getTracks().map((track) => track.id));
    peers.current.forEach((peer) => {
      peer.getSenders().forEach((sender) => {
        if (sender.track && trackIds.has(sender.track.id)) peer.removeTrack(sender);
      });
    });
    localScreenStream.current = null;
    screenWatchers.current.clear();
    setScreenViewerCount(0);
    setScreenSharing(false);
    setLocalScreenQuality(null);
    setLocalScreenPreview(null);
    setStreamViewerOpen(false);
    stream.getTracks().forEach((track) => track.stop());
    if (voiceRef.current) post({ type: "screen-state", channel: voiceRef.current, screenSharing: false });
    if (renegotiate) await renegotiatePeers();
  }, [post, renegotiatePeers]);

  const startScreenShare = useCallback(async () => {
    if (!voiceRef.current || !voiceRealtime.current) {
      setMicError("Entre na sala de voz antes de compartilhar a tela.");
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setMicError("Este navegador não oferece compartilhamento de tela.");
      return;
    }
    setMicError("");
    try {
      if (localScreenStream.current) await stopScreenShare(false);
      const economy = screenPreset === "economy";
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: economy ? 960 : 1280, max: economy ? 960 : 1280 },
          height: { ideal: economy ? 540 : 720, max: economy ? 540 : 720 },
          frameRate: { ideal: economy ? 24 : 30, max: economy ? 24 : 30 },
        },
        audio: false,
      });
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) throw new Error("Captura de tela sem vídeo");
      await videoTrack.applyConstraints({
        width: { ideal: economy ? 960 : 1280, max: economy ? 960 : 1280 },
        height: { ideal: economy ? 540 : 720, max: economy ? 540 : 720 },
        frameRate: { ideal: economy ? 24 : 30, max: economy ? 24 : 30 },
      }).catch(() => undefined);
      videoTrack.contentHint = "detail";
      const appliedSettings = videoTrack.getSettings();
      localScreenStream.current = stream;
      setScreenSharing(true);
      setLocalScreenPreview(stream);
      setLocalScreenQuality({ height: appliedSettings.height ?? (economy ? 540 : 720), frameRate: Math.round(appliedSettings.frameRate ?? (economy ? 24 : 30)) });
      setStreamViewerOpen(true);
      videoTrack.onended = () => { void stopScreenShare(); };
      post({ type: "screen-state", channel: voiceRef.current, screenSharing: true, screenHeight: appliedSettings.height, screenFrameRate: appliedSettings.frameRate });
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") return;
      setMicError("Não foi possível iniciar a transmissão de tela.");
    }
  }, [post, screenPreset, stopScreenShare]);

  const refreshAudioInputs = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "audioinput");
    setAudioInputs(devices);
    setSelectedAudioInput((current) => {
      if (current && devices.some((device) => device.deviceId === current)) return current;
      return devices[0]?.deviceId ?? "";
    });
  }, []);

  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) return;
    navigator.mediaDevices.addEventListener("devicechange", refreshAudioInputs);
    return () => navigator.mediaDevices.removeEventListener("devicechange", refreshAudioInputs);
  }, [refreshAudioInputs]);

  useEffect(() => {
    if (!authenticatedUserId) return;
    const realtimeUser = userRef.current;
    if (!realtimeUser) return;
    let disposed = false;
    const voicePeersMap = peers.current;

    const channel = supabase
      .channel("fynex:voice:v1", {
        config: {
          presence: { key: realtimeUser.id },
          broadcast: { self: false, ack: false },
        },
      })
      .on("presence", { event: "sync" }, () => {
        const presences = Object.values(channel.presenceState<PresenceUser>()).flat();
        const nextVoiceMembers: Record<string, PresenceUser> = {};
        presences.forEach((presence) => {
          if (presence.id && presence.voiceChannel) nextVoiceMembers[presence.id] = presence;
        });
        setVoiceMembers(nextVoiceMembers);

        const currentVoiceChannel = voiceRef.current;
        if (!currentVoiceChannel) return;
        const connectedIds = new Set(
          presences
            .filter((presence) => presence.id !== realtimeUser.id && presence.voiceChannel === currentVoiceChannel)
            .map((presence) => presence.id),
        );
        peers.current.forEach((_, id) => {
          if (!connectedIds.has(id)) closePeer(id);
        });
        presences.forEach((presence) => {
          if (
            presence.id === realtimeUser.id
            || presence.voiceChannel !== currentVoiceChannel
            || peers.current.has(presence.id)
            || realtimeUser.id > presence.id
          ) return;
          void (async () => {
            try {
              const peer = makePeer(presence.id, presence.name ?? "Visitante");
              const offer = await peer.createOffer();
              await peer.setLocalDescription(offer);
              post({ type: "offer", to: presence.id, channel: currentVoiceChannel, name: realtimeUser.name, payload: offer });
            } catch (error) {
              console.error("Falha ao iniciar conexão WebRTC", error);
              closePeer(presence.id);
            }
          })();
        });
      })
      .on("broadcast", { event: "voice-signal" }, ({ payload }) => {
        void handleVoiceSignal(payload as Signal);
      })
      .subscribe(async (status) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          voiceRealtime.current = channel;
          setVoiceConnectionState(voiceRef.current ? "connected" : "idle");
          await channel.track({ ...realtimeUser, onlineAt: new Date().toISOString(), voiceChannel: voiceRef.current, muted: false });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setVoiceConnectionState(voiceRef.current ? "reconnecting" : "offline");
        } else if (status === "CLOSED") {
          setVoiceConnectionState(voiceRef.current ? "offline" : "idle");
        } else if (voiceRef.current) {
          setVoiceConnectionState("connecting");
        }
      });

    return () => {
      disposed = true;
      if (voiceRef.current) {
        void channel.send({
          type: "broadcast",
          event: "voice-signal",
          payload: { type: "leave", from: realtimeUser.id, channel: voiceRef.current } satisfies Signal,
        });
      }
      void channel.untrack();
      void supabase.removeChannel(channel);
      if (voiceRealtime.current === channel) voiceRealtime.current = null;
      setVoiceConnectionState("idle");
      localScreenStream.current?.getTracks().forEach((track) => track.stop());
      localStream.current?.getTracks().forEach((track) => track.stop());
      rawLocalStream.current?.getTracks().forEach((track) => track.stop());
      void microphoneAudioContext.current?.close().catch(() => undefined);
      voicePeersMap.forEach((peer) => peer.close());
      voicePeersMap.clear();
      setVoiceMembers({});
    };
  }, [authenticatedUserId, closePeer, handleVoiceSignal, makePeer, post, supabase]);

  useEffect(() => {
    if (!activeCommunityId) return;
    const realtimeUser = userRef.current;
    if (!realtimeUser) return;
    // The authenticated browser client is created once for this page.
    if (!supabase) {
      queueMicrotask(() => setRealtimeError("Supabase não configurado neste ambiente."));
      return;
    }

    let disposed = false;
    let peopleRefreshTimer: number | null = null;
    let channelsRefreshTimer: number | null = null;

    const refreshPeopleSoon = () => {
      if (peopleRefreshTimer) window.clearTimeout(peopleRefreshTimer);
      peopleRefreshTimer = window.setTimeout(() => {
        if (!disposed) void loadCommunityPeople(activeCommunityId);
      }, 80);
    };

    const refreshChannelsSoon = () => {
      if (channelsRefreshTimer) window.clearTimeout(channelsRefreshTimer);
      channelsRefreshTimer = window.setTimeout(() => {
        void supabase.from("channels").select("*").eq("community_id", activeCommunityId).order("position").order("created_at").then(({ data, error }) => {
          if (disposed || error) return;
          const nextChannels = data ?? [];
          setCommunityChannels(nextChannels);
          setActiveChannel((current) => nextChannels.some((item) => item.id === current && item.type === "text")
            ? current
            : nextChannels.find((item) => item.type === "text")?.id ?? null);
        });
      }, 80);
    };

    const isActiveCommunityRow = (row: Record<string, unknown>) => row.community_id === activeCommunityId;
    const handleSignal = async (data: Signal) => {
      const me = userRef.current;
      if (!me) return;
      if (data.from === me.id || (data.to && data.to !== me.id)) return;
      if (data.type === "leave") { closePeer(data.from); return; }
      if (!voiceRef.current || data.channel !== voiceRef.current) return;
      try {
        if (data.type === "screen-state") {
          setVoicePeers((old) => ({
            ...old,
            [data.from]: {
              ...(old[data.from] ?? { id: data.from, name: data.name ?? "Visitante", muted: false, speaking: false }),
              name: data.name ?? old[data.from]?.name ?? "Visitante",
              screenSharing: !!data.screenSharing,
              screenStream: data.screenSharing ? old[data.from]?.screenStream : undefined,
            },
          }));
          if (!data.screenSharing && watchingScreenRef.current === data.from) {
            watchingScreenRef.current = null;
            setWatchingScreenId(null);
            setStreamViewerOpen(false);
            if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
          }
        } else if (data.type === "screen-watch") {
          const screenStream = localScreenStream.current;
          if (!screenStream) return;
          const pc = makePeer(data.from, data.name ?? "Visitante");
          const videoTrack = screenStream.getVideoTracks()[0];
          if (data.watching && videoTrack) {
            const alreadySending = pc.getSenders().some((sender) => sender.track?.id === videoTrack.id);
            if (!alreadySending) pc.addTrack(videoTrack, screenStream);
            screenWatchers.current.add(data.from);
          } else {
            pc.getSenders().filter((sender) => sender.track?.kind === "video").forEach((sender) => pc.removeTrack(sender));
            screenWatchers.current.delete(data.from);
          }
          setScreenViewerCount(screenWatchers.current.size);
          await renegotiatePeer(data.from, pc);
        } else if (data.type === "announce") {
          const pc = makePeer(data.from, data.name ?? "Visitante");
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          post({ type: "offer", to: data.from, channel: voiceRef.current, name: me.name, payload: offer });
          if (localScreenStream.current) {
            post({ type: "screen-state", to: data.from, channel: voiceRef.current, name: me.name, screenSharing: true });
          }
        } else if (data.type === "offer") {
          const pc = makePeer(data.from, data.name ?? "Visitante");
          await pc.setRemoteDescription(data.payload as RTCSessionDescriptionInit);
          for (const candidate of pendingIceCandidates.current.get(data.from) ?? []) {
            await pc.addIceCandidate(candidate);
          }
          pendingIceCandidates.current.delete(data.from);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          post({ type: "answer", to: data.from, channel: voiceRef.current, name: me.name, payload: answer });
        } else if (data.type === "answer") {
          const pc = peers.current.get(data.from);
          if (!pc) return;
          await pc.setRemoteDescription(data.payload as RTCSessionDescriptionInit);
          for (const candidate of pendingIceCandidates.current.get(data.from) ?? []) {
            await pc.addIceCandidate(candidate);
          }
          pendingIceCandidates.current.delete(data.from);
        } else if (data.type === "ice") {
          const pc = peers.current.get(data.from);
          if (!pc) return;
          const candidate = data.payload as RTCIceCandidateInit;
          if (pc.remoteDescription) {
            await pc.addIceCandidate(candidate);
          } else {
            const queued = pendingIceCandidates.current.get(data.from) ?? [];
            pendingIceCandidates.current.set(data.from, [...queued, candidate]);
          }
        } else if (data.type === "voice-state") {
          setVoicePeers((old) => ({ ...old, [data.from]: { ...(old[data.from] ?? { id: data.from, name: data.name ?? "Visitante" }), muted: !!data.muted, speaking: !!data.speaking } }));
        }
      } catch (error) {
        console.error("Falha na sinalização WebRTC", error);
      }
    };

    const channel = supabase
      .channel(`fynex:community:${activeCommunityId}`, {
        config: {
          presence: { key: realtimeUser.id },
          broadcast: { self: false, ack: false },
        },
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceUser>();
        const next: Record<string, PresenceUser> = {};
        const presences = Object.values(state).flat();
        presences.forEach((presence) => {
          if (!presence.id) return;
          if (presence.id !== realtimeUser.id && presence.status !== "invisible") next[presence.id] = presence;
        });
        setOnlineUsers(next);
      })
      .on("broadcast", { event: "voice-signal" }, ({ payload }) => {
        void handleSignal(payload as Signal);
      })
      .on("broadcast", { event: "message-deleted" }, ({ payload }) => {
        const deleted = payload as { id?: string; channelId?: string };
        if (!deleted.id) return;
        setMessages((old) => old.filter((message) => message.id !== deleted.id));
        setReplyTarget((current) => current?.id === deleted.id ? null : current);
      })
      .on("broadcast", { event: "mention-everyone" }, ({ payload }) => {
        const mention = payload as { authorId?: string; author?: string; channelId?: string; channelName?: string };
        if (!mention.channelId || mention.authorId === realtimeUser.id) return;
        setMentionNotice({ author: mention.author ?? "Um administrador", channelId: mention.channelId, channelName: mention.channelName ?? "canal" });
        setNotifications((current) => [{
          id: crypto.randomUUID(),
          author: mention.author ?? "Um administrador",
          text: "mencionou @todos",
          communityId: activeCommunityId,
          channelId: mention.channelId!,
          channelName: mention.channelName ?? "canal",
          createdAt: new Date().toISOString(),
          read: false,
        }, ...current].slice(0, 50));
        playSound(receivedMessageSound.current);
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const typing = payload as { userId?: string; name?: string; channelId?: string; active?: boolean };
        if (!typing.userId || !typing.channelId || typing.userId === realtimeUser.id) return;
        const previousTimer = remoteTypingTimers.current.get(typing.userId);
        if (previousTimer) window.clearTimeout(previousTimer);
        if (!typing.active) {
          setTypingUsers((current) => { const next = { ...current }; delete next[typing.userId!]; return next; });
          return;
        }
        setTypingUsers((current) => ({ ...current, [typing.userId!]: { name: typing.name ?? "Alguém", channelId: typing.channelId! } }));
        remoteTypingTimers.current.set(typing.userId, window.setTimeout(() => {
          setTypingUsers((current) => { const next = { ...current }; delete next[typing.userId!]; return next; });
          remoteTypingTimers.current.delete(typing.userId!);
        }, 2600));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "communities" }, ({ new: updated }) => {
        const community = updated as CommunitySpace;
        setCommunities((current) => current.map((item) => item.id === community.id ? community : item));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "channels", filter: `community_id=eq.${activeCommunityId}` }, refreshChannelsSoon)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "channels", filter: `community_id=eq.${activeCommunityId}` }, refreshChannelsSoon)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "channels" }, ({ old }) => {
        if (isActiveCommunityRow(old)) refreshChannelsSoon();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_members", filter: `community_id=eq.${activeCommunityId}` }, ({ new: membership }) => {
        refreshPeopleSoon();
        const joined = membership as { user_id: string; joined_at?: string };
        if (joined.user_id === realtimeUser.id) return;
        void supabase.from("profiles").select("display_name").eq("id", joined.user_id).maybeSingle().then(({ data }) => {
          if (!data) return;
          const createdAt = joined.joined_at ?? new Date().toISOString();
          const id = `join:${activeCommunityId}:${joined.user_id}:${createdAt}`;
          setMessages((current) => current.some((message) => message.id === id) ? current : [...current, { id, channelId: activeChannelRef.current ?? "", author: data.display_name, authorId: joined.user_id, color: "#8b5cf6", content: `${data.display_name} entrou na comunidade`, time: new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(createdAt)), createdAt, messageKind: "system" as const }].slice(-150));
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "community_members", filter: `community_id=eq.${activeCommunityId}` }, refreshPeopleSoon)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "community_members" }, ({ old }) => {
        if (isActiveCommunityRow(old)) refreshPeopleSoon();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_roles", filter: `community_id=eq.${activeCommunityId}` }, refreshPeopleSoon)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "community_roles", filter: `community_id=eq.${activeCommunityId}` }, refreshPeopleSoon)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "community_roles" }, ({ old }) => {
        if (isActiveCommunityRow(old)) refreshPeopleSoon();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "community_role_icons", filter: `community_id=eq.${activeCommunityId}` }, refreshPeopleSoon)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_member_roles", filter: `community_id=eq.${activeCommunityId}` }, refreshPeopleSoon)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "community_member_roles", filter: `community_id=eq.${activeCommunityId}` }, refreshPeopleSoon)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "community_member_roles" }, ({ old }) => {
        if (isActiveCommunityRow(old)) refreshPeopleSoon();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "community_tags", filter: `community_id=eq.${activeCommunityId}` }, refreshPeopleSoon)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_stickers", filter: `community_id=eq.${activeCommunityId}` }, refreshPeopleSoon)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_member_tags", filter: `community_id=eq.${activeCommunityId}` }, refreshPeopleSoon)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "community_member_tags", filter: `community_id=eq.${activeCommunityId}` }, refreshPeopleSoon)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "community_member_tags" }, ({ old }) => {
        if (isActiveCommunityRow(old)) refreshPeopleSoon();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, ({ new: updated }) => {
        const profile = updated as Profile;
        const belongsToCommunity = communityMembersRef.current.some((member) => member.id === profile.id);
        if (!belongsToCommunity && profile.id !== realtimeUser.id) return;

        communityMembersRef.current = communityMembersRef.current.map((member) => member.id === profile.id ? { ...member, ...profile } : member);
        setCommunityMembers(communityMembersRef.current);
        setMessages((current) => current.map((message) => message.authorId === profile.id ? {
          ...message,
          author: profile.display_name,
          color: profile.accent_color,
          avatarUrl: profile.avatar_url,
        } : message));
        setReplySnapshots((current) => Object.fromEntries(Object.entries(current).map(([id, message]) => [id, message.authorId === profile.id ? {
          ...message,
          author: profile.display_name,
          color: profile.accent_color,
          avatarUrl: profile.avatar_url,
        } : message])));
        setSelectedProfile((current) => current?.id === profile.id ? { ...current, ...profile } : current);

        if (profile.id === realtimeUser.id) {
          const nextUser = { id: profile.id, username: profile.username, name: profile.display_name, color: profile.accent_color, avatarUrl: profile.avatar_url, status: profile.presence_status };
          userRef.current = nextUser;
          setUser(nextUser);
          if (nextUser.status === "invisible") void channel.untrack();
          else void channel.track({ ...nextUser, onlineAt: new Date().toISOString(), voiceChannel: voiceRef.current, muted: false });
        }
      })
      .subscribe(async (status, error) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          realtime.current = channel;
          setRealtimeConnected(true);
          setChatConnectionState("connected");
          setRealtimeError("");
          if (realtimeUser.status !== "invisible") await channel.track({ ...realtimeUser, onlineAt: new Date().toISOString(), voiceChannel: voiceRef.current, muted: false });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeConnected(false);
          setChatConnectionState("reconnecting");
          setRealtimeError(error?.message ?? "Não foi possível conectar ao tempo real.");
        } else if (status === "CLOSED") {
          setRealtimeConnected(false);
          setChatConnectionState("offline");
        } else {
          setChatConnectionState("connecting");
        }
      });

    return () => {
      disposed = true;
      if (peopleRefreshTimer) window.clearTimeout(peopleRefreshTimer);
      if (channelsRefreshTimer) window.clearTimeout(channelsRefreshTimer);
      void channel.untrack();
      void supabase.removeChannel(channel);
      realtime.current = null;
      setRealtimeConnected(false);
      setChatConnectionState("offline");
      setOnlineUsers({});
    };
  }, [activeCommunityId, closePeer, loadCommunityPeople, makePeer, playSound, post, renegotiatePeer, supabase]);

  useEffect(() => {
    if (!user || !activeChannel) return;

    let disposed = false;
    const loadReactions = async (messageIds: string[]) => {
      if (!messageIds.length) { if (!disposed) setMessageReactions({}); return; }
      const { data } = await supabase.from("message_reactions").select("*").in("message_id", messageIds);
      if (disposed || !data) return;
      const grouped: Record<string, MessageReaction[]> = {};
      data.forEach((reaction) => { grouped[reaction.message_id] = [...(grouped[reaction.message_id] ?? []), reaction]; });
      setMessageReactions(grouped);
    };
    const loadPollVotes = async (messageIds: string[]) => {
      if (!messageIds.length) { if (!disposed) setPollVotes({}); return; }
      const { data } = await supabase.from("poll_votes").select("*").in("message_id", messageIds);
      if (disposed || !data) return;
      const grouped: Record<string, PollVote[]> = {};
      data.forEach((vote) => { grouped[vote.message_id] = [...(grouped[vote.message_id] ?? []), vote]; });
      setPollVotes(grouped);
    };
    const addMessage = async (row: MessageRow) => {
      const { data: author } = await supabase.from("profiles").select("display_name, accent_color, avatar_url").eq("id", row.author_id).single();
      if (!author || disposed) return;
      const incoming = messageFromRow(row, author);
      setMessages((old) => old.some((item) => item.id === incoming.id) ? old : [...old, incoming].slice(-150));
      const wasSentInThisTab = ownMessageIds.current.delete(row.id);
      const username = userRef.current?.username;
      const isDirectMention = Boolean(row.author_id !== user.id && username && new RegExp(`(^|\\s)@${username}(?=\\s|$|[.,!?])`, "i").test(row.content));
      const repliedToYou = Boolean(row.author_id !== user.id && row.reply_to_id && messagesRef.current.some((message) => message.id === row.reply_to_id && message.authorId === user.id));
      if (!wasSentInThisTab && row.author_id !== user.id && row.message_kind !== "system" && (messageSoundEnabledRef.current || isDirectMention || repliedToYou)) {
        playSound(receivedMessageSound.current);
      }
      if (isDirectMention || repliedToYou) {
        const channelName = communityChannels.find((channel) => channel.id === row.channel_id)?.name ?? "canal";
        setNotifications((current) => [{
          id: row.id,
          author: author.display_name,
          text: repliedToYou ? "respondeu à sua mensagem" : `mencionou @${username}`,
          communityId: activeCommunityId ?? "",
          channelId: row.channel_id,
          channelName,
          createdAt: row.created_at,
          read: false,
        }, ...current.filter((notification) => notification.id !== row.id)].slice(0, 50));
      }
    };

    const messageChannel = supabase
      .channel(`fynex:messages:${activeChannel}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${activeChannel}` }, ({ new: row }) => { void addMessage(row as MessageRow); })
      .subscribe();

    const reactionChannel = supabase
      .channel(`fynex:reactions:${activeChannel}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_reactions" }, ({ new: row }) => {
        const reaction = row as MessageReaction;
        if (!messagesRef.current.some((message) => message.id === reaction.message_id)) return;
        setMessageReactions((current) => ({ ...current, [reaction.message_id]: [...(current[reaction.message_id] ?? []).filter((item) => !(item.user_id === reaction.user_id && item.emoji === reaction.emoji)), reaction] }));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "message_reactions" }, ({ old: row }) => {
        const reaction = row as MessageReaction;
        setMessageReactions((current) => ({ ...current, [reaction.message_id]: (current[reaction.message_id] ?? []).filter((item) => !(item.user_id === reaction.user_id && item.emoji === reaction.emoji)) }));
      })
      .subscribe();

    const pollVoteChannel = supabase
      .channel(`fynex:poll-votes:${activeChannel}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "poll_votes" }, ({ new: row }) => {
        const vote = row as PollVote;
        if (!messagesRef.current.some((message) => message.id === vote.message_id)) return;
        setPollVotes((current) => ({ ...current, [vote.message_id]: [...(current[vote.message_id] ?? []).filter((item) => item.user_id !== vote.user_id), vote] }));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "poll_votes" }, ({ new: row }) => {
        const vote = row as PollVote;
        setPollVotes((current) => ({ ...current, [vote.message_id]: [...(current[vote.message_id] ?? []).filter((item) => item.user_id !== vote.user_id), vote] }));
      })
      .subscribe();

    void supabase.from("messages")
      .select("id, channel_id, author_id, content, created_at, edited_at, reply_to_id, message_kind, poll_question, poll_options, sticker_id, attachment_kind, attachment_url, attachment_file_id, attachment_path, attachment_mime, attachment_size, attachment_width, attachment_height, attachment_name, link_preview_url, link_preview_title, link_preview_description, link_preview_site_name, profiles!messages_author_id_fkey(display_name, accent_color, avatar_url)")
      .eq("channel_id", activeChannel)
      .order("created_at", { ascending: false })
      .limit(150)
      .then(async ({ data, error }) => {
        if (disposed) return;
        if (error) {
          setRealtimeError("Não foi possível carregar as mensagens.");
          return;
        }
        const loaded = (data ?? []).reverse().flatMap((row) => {
          const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
          return profile ? [messageFromRow(row, profile)] : [];
        });
        setMessages(loaded);
        void loadReactions(loaded.map((message) => message.id));
        void loadPollVotes(loaded.filter((message) => message.poll).map((message) => message.id));
        const loadedIds = new Set(loaded.map((message) => message.id));
        const missingReplyIds = [...new Set(loaded.map((message) => message.replyToId).filter((id): id is string => Boolean(id) && !loadedIds.has(id!)))];
        if (missingReplyIds.length) {
          const { data: parents } = await supabase.from("messages")
            .select("id, channel_id, author_id, content, created_at, edited_at, reply_to_id, message_kind, poll_question, poll_options, sticker_id, attachment_kind, attachment_url, attachment_file_id, attachment_path, attachment_mime, attachment_size, attachment_width, attachment_height, attachment_name, link_preview_url, link_preview_title, link_preview_description, link_preview_site_name, profiles!messages_author_id_fkey(display_name, accent_color, avatar_url)")
            .in("id", missingReplyIds);
          if (!disposed && parents) {
            const snapshots = parents.flatMap((row) => {
              const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
              return profile ? [messageFromRow(row, profile)] : [];
            });
            setReplySnapshots(Object.fromEntries(snapshots.map((message) => [message.id, message])));
          }
        } else setReplySnapshots({});
      });

    return () => {
      disposed = true;
      void supabase.removeChannel(messageChannel);
      void supabase.removeChannel(reactionChannel);
      void supabase.removeChannel(pollVoteChannel);
    };
  }, [activeChannel, activeCommunityId, communityChannels, playSound, supabase, user]);

  const refreshUnreadCounts = useCallback(async () => {
    if (!userRef.current) return;
    const { data, error } = await supabase.rpc("get_unread_community_counts");
    if (error) return;
    setUnreadCommunityCounts(Object.fromEntries((data ?? []).map((row) => [row.community_id, Number(row.unread_count)])));
  }, [supabase]);

  useEffect(() => {
    if (!authenticatedUserId || !allCommunityChannels.length) return;
    const refreshTask = window.setTimeout(() => void refreshUnreadCounts(), 0);
    const unreadChannel = supabase
      .channel(`fynex:unread:${authenticatedUserId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, ({ new: row }) => {
        const message = row as MessageRow;
        if (message.author_id === authenticatedUserId || message.channel_id === activeChannelRef.current) return;
        const channel = allCommunityChannelsRef.current.find((item) => item.id === message.channel_id);
        if (!channel) return;
        setUnreadCommunityCounts((current) => ({ ...current, [channel.community_id]: (current[channel.community_id] ?? 0) + 1 }));
      })
      .subscribe();
    return () => { window.clearTimeout(refreshTask); void supabase.removeChannel(unreadChannel); };
  }, [allCommunityChannels.length, authenticatedUserId, refreshUnreadCounts, supabase]);

  useEffect(() => {
    if (!authenticatedUserId || !activeChannel || document.visibilityState === "hidden") return;
    void supabase.from("channel_read_states").upsert({ user_id: authenticatedUserId, channel_id: activeChannel, last_read_at: new Date().toISOString() }, { onConflict: "user_id,channel_id" }).then(() => void refreshUnreadCounts());
  }, [activeChannel, authenticatedUserId, messages.length, refreshUnreadCounts, supabase]);

  useEffect(() => {
    if (!voiceChannel || !localStream.current || !user) return;
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    const source = context.createMediaStreamSource(localStream.current);
    source.connect(analyser);
    const values = new Uint8Array(analyser.frequencyBinCount);
    let frame = 0;
    let last = false;
    let silentFrames = 0;
    const tick = () => {
      analyser.getByteFrequencyData(values);
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      const detected = !muted && average > 18;
      if (detected) silentFrames = 0;
      else silentFrames += 1;
      const active = detected || (last && silentFrames < 12);
      setSpeaking(active);
      if (active !== last) {
        post({ type: "voice-state", channel: voiceChannel, name: user.name, muted, speaking: active });
        last = active;
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(frame); source.disconnect(); void context.close(); };
  }, [voiceChannel, muted, user, post, audioTrackVersion]);

  useEffect(() => {
    if (!micTestActive) return;
    const stream = micTestStream.current ?? localStream.current;
    if (!stream) return;
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    const source = context.createMediaStreamSource(stream);
    source.connect(analyser);
    const values = new Uint8Array(analyser.frequencyBinCount);
    let frame = 0;
    const tick = () => {
      analyser.getByteFrequencyData(values);
      setMicTestLevel(Math.min(100, Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 1.8)));
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(frame); source.disconnect(); void context.close(); };
  }, [micTestActive, audioTrackVersion]);

  const captureMicrophone = async (
    deviceId = selectedAudioInput,
    processing: Partial<Record<"noiseSuppression" | "echoCancellation" | "autoGainControl", boolean>> = {},
  ) => {
    const supported = navigator.mediaDevices.getSupportedConstraints();
    const requestedNoiseSuppression = processing.noiseSuppression ?? noiseSuppression;
    const requestedEchoCancellation = processing.echoCancellation ?? echoCancellation;
    const requestedAutoGainControl = processing.autoGainControl ?? autoGainControl;
    const constraints = (strictNoiseSuppression: boolean): MediaTrackConstraints => ({
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      ...(supported.echoCancellation ? { echoCancellation: { ideal: requestedEchoCancellation } } : {}),
      ...(supported.noiseSuppression
        ? { noiseSuppression: strictNoiseSuppression ? { exact: requestedNoiseSuppression } : { ideal: requestedNoiseSuppression } }
        : {}),
      ...(supported.autoGainControl ? { autoGainControl: { ideal: requestedAutoGainControl } } : {}),
      channelCount: { ideal: 1 },
      sampleRate: { ideal: 48_000 },
    });

    try {
      return await navigator.mediaDevices.getUserMedia({ audio: constraints(true) });
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== "OverconstrainedError" || !supported.noiseSuppression) throw error;
      return navigator.mediaDevices.getUserMedia({ audio: constraints(false) });
    }
  };

  const createOutgoingAudioStream = async (capturedStream: MediaStream) => {
    if (microphoneAudioContext.current) await microphoneAudioContext.current.close().catch(() => undefined);
    const context = new AudioContext();
    await context.resume().catch(() => undefined);
    const source = context.createMediaStreamSource(capturedStream);
    const gain = context.createGain();
    const destination = context.createMediaStreamDestination();
    gain.gain.value = microphoneVolume / 100;
    source.connect(gain).connect(destination);
    microphoneAudioContext.current = context;
    microphoneGain.current = gain;
    return new MediaStream(destination.stream.getAudioTracks());
  };

  const toggleMicTest = async () => {
    if (micTestActive) {
      micTestStream.current?.getTracks().forEach((track) => track.stop());
      micTestStream.current = null;
      setMicTestActive(false);
      setMicTestLevel(0);
      return;
    }
    setMicError("");
    try {
      if (!localStream.current) micTestStream.current = await captureMicrophone();
      setMicTestActive(true);
    } catch {
      setMicError("Não foi possível iniciar o teste do microfone.");
    }
  };

  const updateMicrophoneVolume = async (value: number) => {
    setMicrophoneVolume(value);
    const gain = microphoneGain.current;
    if (gain) gain.gain.setTargetAtTime(value / 100, gain.context.currentTime, .015);
  };

  const updateMessageSoundPreference = (enabled: boolean) => {
    messageSoundEnabledRef.current = enabled;
    setMessageSoundEnabled(enabled);
    window.localStorage.setItem("fynex:message-sounds", enabled ? "on" : "off");
  };

  const closeMediaSettings = () => {
    if (micTestActive) {
      micTestStream.current?.getTracks().forEach((track) => track.stop());
      micTestStream.current = null;
      setMicTestActive(false);
      setMicTestLevel(0);
    }
    setMediaSettingsOpen(false);
  };

  const joinVoice = async (channel: string) => {
    if (voiceChannel === channel) return;
    if (!voiceRealtime.current) {
      setMicError("Aguarde a conexão em tempo real antes de entrar na voz.");
      return;
    }
    if (voiceChannel) leaveVoice();
    const targetChannel = communityChannels.find((item) => item.id === channel && item.type === "voice");
    const uniqueMembers = new Set(Object.values(voiceMembers).filter((member) => member.voiceChannel === channel).map((member) => member.id));
    const userLimit = targetChannel?.user_limit ?? 10;
    if (uniqueMembers.size >= userLimit) {
      setMicError(`Este canal está lotado (${userLimit}/${userLimit}).`);
      return;
    }
    setMicError("");
    try {
      setVoiceConnectionState("connecting");
      const capturedStream = await captureMicrophone();
      const stream = await createOutgoingAudioStream(capturedStream);
      rawLocalStream.current = capturedStream;
      localStream.current = stream;
      const appliedNoiseSuppression = capturedStream.getAudioTracks()[0]?.getSettings().noiseSuppression ?? null;
      setNoiseSuppressionApplied(appliedNoiseSuppression);
      setEchoCancellationApplied(capturedStream.getAudioTracks()[0]?.getSettings().echoCancellation ?? null);
      if (noiseSuppression && appliedNoiseSuppression === false) {
        setMicError("O microfone foi conectado, mas este navegador não aplicou o cancelamento de ruído.");
      }
      const activeDeviceId = capturedStream.getAudioTracks()[0]?.getSettings().deviceId;
      if (activeDeviceId) setSelectedAudioInput(activeDeviceId);
      await refreshAudioInputs();
      voiceRef.current = channel;
      setVoiceChannel(channel);
      const currentCommunity = communities.find((community) => community.id === activeCommunityId);
      setVoiceContext({
        communityId: currentCommunity?.id ?? activeCommunityId ?? "",
        communityName: currentCommunity?.name ?? "Comunidade",
        channelName: targetChannel?.name ?? "Canal de voz",
      });
      setAudioTrackVersion((version) => version + 1);
      const current = userRef.current;
      if (current) {
        await voiceRealtime.current.track({ ...current, onlineAt: new Date().toISOString(), voiceChannel: channel, muted: false });
      }
      setVoiceConnectionState("connected");
    } catch {
      setVoiceConnectionState("offline");
      setMicError("Não foi possível acessar o microfone. Verifique a permissão do navegador.");
    }
  };

  const openVoiceChannel = async (channel: string) => {
    setVoicePanelChannelId(channel);
    if (voiceChannel !== channel) await joinVoice(channel);
  };

  const leaveVoice = () => {
    stopWatchingScreen();
    void stopScreenShare(false);
    if (voiceRef.current) post({ type: "leave", channel: voiceRef.current });
    const current = userRef.current;
    if (current) {
      void voiceRealtime.current?.track({ ...current, onlineAt: new Date().toISOString(), voiceChannel: null, muted: false });
    }
    peers.current.forEach((peer) => peer.close());
    peers.current.clear();
    pendingIceCandidates.current.clear();
    localStream.current?.getTracks().forEach((track) => track.stop());
    localStream.current = null;
    rawLocalStream.current?.getTracks().forEach((track) => track.stop());
    rawLocalStream.current = null;
    void microphoneAudioContext.current?.close().catch(() => undefined);
    microphoneAudioContext.current = null;
    microphoneGain.current = null;
    setNoiseSuppressionApplied(null);
    setEchoCancellationApplied(null);
    voiceRef.current = null;
    setVoiceChannel(null);
    setVoiceConnectionState("idle");
    setVoiceContext(null);
    setVoicePanelChannelId(null);
    setPinnedVoiceUserId(null);
    setVoicePeers({});
    setMuted(false);
    setDeafened(false);
  };
  useEffect(() => {
    leaveVoiceRef.current = leaveVoice;
  });

  useEffect(() => {
    if (!authenticatedUserId) return;
    const moderationChannel = supabase
      .channel(`fynex:voice-moderation:${authenticatedUserId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "voice_moderation_events", filter: `target_user_id=eq.${authenticatedUserId}` }, ({ new: row }) => {
        const event = row as VoiceModerationEvent;
        if (!voiceRef.current || event.channel_id !== voiceRef.current) return;
        if (event.action === "disconnect") {
          setModerationNotice("Um moderador removeu você da chamada.");
          leaveVoiceRef.current();
          return;
        }
        localStream.current?.getAudioTracks().forEach((track) => { track.enabled = false; });
        setMuted(true);
        setModerationNotice("Seu microfone foi silenciado por um moderador.");
        const current = userRef.current;
        if (current) {
          void voiceRealtime.current?.track({ ...current, onlineAt: new Date().toISOString(), voiceChannel: voiceRef.current, muted: true });
          post({ type: "voice-state", channel: voiceRef.current ?? undefined, name: current.name, muted: true, speaking: false });
        }
      })
      .subscribe();
    return () => { void supabase.removeChannel(moderationChannel); };
  }, [authenticatedUserId, post, supabase]);

  const toggleMute = () => {
    const next = !muted;
    localStream.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMuted(next);
    const current = userRef.current;
    if (current) {
      void voiceRealtime.current?.track({ ...current, onlineAt: new Date().toISOString(), voiceChannel: voiceRef.current, muted: next });
      if (voiceRef.current) {
        post({ type: "voice-state", channel: voiceRef.current, name: current.name, muted: next, speaking: next ? false : speaking });
      }
    }
  };

  const changeAudioInput = async (deviceId: string) => {
    setSelectedAudioInput(deviceId);
    if (!voiceRef.current) return;
    setMicError("");
    try {
      const capturedStream = await captureMicrophone(deviceId);
      const replacementStream = await createOutgoingAudioStream(capturedStream);
      const replacementTrack = replacementStream.getAudioTracks()[0];
      if (!replacementTrack) throw new Error("Microfone sem faixa de áudio");
      await Promise.all(
        [...peers.current.values()].map(async (peer) => {
          const sender = peer.getSenders().find((item) => item.track?.kind === "audio");
          if (sender) await sender.replaceTrack(replacementTrack);
        }),
      );
      localStream.current?.getTracks().forEach((track) => track.stop());
      rawLocalStream.current?.getTracks().forEach((track) => track.stop());
      replacementTrack.enabled = !muted;
      rawLocalStream.current = capturedStream;
      localStream.current = replacementStream;
      const appliedNoiseSuppression = capturedStream.getAudioTracks()[0]?.getSettings().noiseSuppression ?? null;
      setNoiseSuppressionApplied(appliedNoiseSuppression);
      setEchoCancellationApplied(capturedStream.getAudioTracks()[0]?.getSettings().echoCancellation ?? null);
      if (noiseSuppression && appliedNoiseSuppression === false) {
        setMicError("O microfone foi trocado, mas este navegador não aplicou o cancelamento de ruído.");
      }
      setAudioTrackVersion((version) => version + 1);
    } catch {
      setMicError("Não foi possível trocar o microfone.");
    }
  };

  const updateAudioProcessing = async (setting: "noiseSuppression" | "echoCancellation" | "autoGainControl", enabled: boolean) => {
    if (setting === "noiseSuppression") {
      setNoiseSuppression(enabled);
      window.localStorage.setItem("fynex:noise-cancellation", enabled ? "on" : "off");
    }
    if (setting === "echoCancellation") setEchoCancellation(enabled);
    if (setting === "autoGainControl") setAutoGainControl(enabled);
    const track = rawLocalStream.current?.getAudioTracks()[0];
    if (!track) return;
    setMicError("");
    try {
      await track.applyConstraints({
        noiseSuppression: { exact: setting === "noiseSuppression" ? enabled : noiseSuppression },
        echoCancellation: { ideal: setting === "echoCancellation" ? enabled : echoCancellation },
        autoGainControl: { ideal: setting === "autoGainControl" ? enabled : autoGainControl },
      });
      setNoiseSuppressionApplied(track.getSettings().noiseSuppression ?? null);
      setEchoCancellationApplied(track.getSettings().echoCancellation ?? null);
    } catch {
      try {
        const capturedStream = await captureMicrophone(selectedAudioInput, { [setting]: enabled });
        const replacementStream = await createOutgoingAudioStream(capturedStream);
        const replacementTrack = replacementStream.getAudioTracks()[0];
        if (!replacementTrack) throw new Error("Microfone sem faixa de audio");
        await Promise.all(
          [...peers.current.values()].map(async (peer) => {
            const sender = peer.getSenders().find((item) => item.track?.kind === "audio");
            if (sender) await sender.replaceTrack(replacementTrack);
          }),
        );
        localStream.current?.getTracks().forEach((currentTrack) => currentTrack.stop());
        rawLocalStream.current?.getTracks().forEach((currentTrack) => currentTrack.stop());
        replacementTrack.enabled = !muted;
        rawLocalStream.current = capturedStream;
        localStream.current = replacementStream;
        setNoiseSuppressionApplied(capturedStream.getAudioTracks()[0]?.getSettings().noiseSuppression ?? null);
        setEchoCancellationApplied(capturedStream.getAudioTracks()[0]?.getSettings().echoCancellation ?? null);
        setAudioTrackVersion((version) => version + 1);
      } catch {
        if (setting === "noiseSuppression") setNoiseSuppressionApplied(false);
        setMicError("Seu navegador não conseguiu aplicar esse ajuste ao microfone.");
      }
    }
  };

  const toggleLocalMute = (userId: string) => {
    setLocallyMutedUsers((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const chooseAttachment = (file?: File) => {
    if (!file) return;
    const kind = CHAT_IMAGE_MIMES.has(file.type) ? "image" : CHAT_VIDEO_MIMES.has(file.type) ? "video" : null;
    if (!kind) {
      setRealtimeError("Escolha uma imagem JPG, PNG, WebP ou GIF, ou um vídeo MP4, WebM ou MOV.");
      return;
    }
    const limit = kind === "image" ? CHAT_IMAGE_LIMIT : CHAT_VIDEO_LIMIT;
    if (file.size > limit) {
      setRealtimeError(`${kind === "image" ? "A imagem" : "O vídeo"} pode ter no máximo ${kind === "image" ? "8 MB" : "20 MB"}.`);
      return;
    }
    setRealtimeError("");
    setUploadProgress(0);
    setAttachment({ file, kind, previewUrl: URL.createObjectURL(file) });
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim().slice(0, 2000);
    const outgoingLink = extractFirstLink(content);
    if ((!content && !attachment) || !user || !activeChannel || sending) return;

    setSending(true);
    setRealtimeError("");
    setUploadProgress(attachment ? 2 : 0);
    const messageId = crypto.randomUUID();
    ownMessageIds.current.add(messageId);
    window.setTimeout(() => ownMessageIds.current.delete(messageId), 30000);

    try {
      let uploaded: { fileId: string; filePath: string; url: string } | undefined;
      if (attachment) {
        const tokenResponse = await fetch("/api/imagekit/upload-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: `message-${attachment.kind}`, mime: attachment.file.type, channelId: activeChannel }),
        });
        const token = await tokenResponse.json() as ImageKitUploadToken;
        if (!tokenResponse.ok || !token.token) throw new Error(token.error ?? "Não foi possível autorizar o anexo.");
        uploaded = await uploadToImageKit(attachment.file, token, setUploadProgress);
      }

      const result = await sendMessageAction({
        id: messageId,
        channelId: activeChannel,
        content,
        replyToId: replyTarget?.id ?? null,
        includeLinkPreview: Boolean(outgoingLink && removedLinkPreviewUrl !== outgoingLink),
        attachment: attachment && uploaded ? {
          kind: attachment.kind,
          fileId: uploaded.fileId,
          filePath: uploaded.filePath,
          url: uploaded.url,
          originalName: attachment.file.name,
        } : undefined,
      });
      if (result.error || !result.data) throw new Error(result.error ?? "A mensagem não foi enviada.");

      const sent = messageFromRow(result.data, { display_name: user.name, accent_color: user.color, avatar_url: user.avatarUrl ?? null });
      setMessages((old) => old.some((item) => item.id === sent.id) ? old : [...old, sent].slice(-150));
      if (/(^|\s)@todos([^a-zA-Z0-9_]|$)/i.test(content)) {
        await realtime.current?.send({ type: "broadcast", event: "mention-everyone", payload: { authorId: user.id, author: user.name, channelId: activeChannel, channelName: currentChannel.name } });
      }
      playSound(sentMessageSound.current);
      await realtime.current?.send({ type: "broadcast", event: "typing", payload: { userId: user.id, name: user.name, channelId: activeChannel, active: false } });
      if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
      typingSentAt.current = 0;
      setDraft("");
      setRemovedLinkPreviewUrl(null);
      setReplyTarget(null);
      setAttachment(null);
      setUploadProgress(0);
    } catch (error) {
      ownMessageIds.current.delete(messageId);
      setRealtimeError(error instanceof Error ? error.message : "A mensagem não foi enviada. Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  const sendSpecialMessage = async (payload: { poll?: PollDraft; stickerId?: string }) => {
    if (!user || !activeChannel || sending) return;
    setSending(true);
    setRealtimeError("");
    const messageId = crypto.randomUUID();
    ownMessageIds.current.add(messageId);
    window.setTimeout(() => ownMessageIds.current.delete(messageId), 30000);
    try {
      const result = await sendMessageAction({ id: messageId, channelId: activeChannel, content: "", poll: payload.poll, stickerId: payload.stickerId });
      if (result.error || !result.data) throw new Error(result.error ?? "Não foi possível enviar.");
      const sent = messageFromRow(result.data, { display_name: user.name, accent_color: user.color, avatar_url: user.avatarUrl ?? null });
      setMessages((old) => old.some((item) => item.id === sent.id) ? old : [...old, sent].slice(-150));
      playSound(sentMessageSound.current);
    } catch (error) {
      ownMessageIds.current.delete(messageId);
      setRealtimeError(error instanceof Error ? error.message : "Não foi possível enviar.");
    } finally {
      setSending(false);
    }
  };

  const votePoll = async (message: Message, optionIndex: number) => {
    if (!user) return;
    const optimisticVote: PollVote = { message_id: message.id, user_id: user.id, option_index: optionIndex, created_at: new Date().toISOString() };
    const previous = pollVotes[message.id] ?? [];
    setPollVotes((current) => ({ ...current, [message.id]: [...previous.filter((vote) => vote.user_id !== user.id), optimisticVote] }));
    const result = await votePollAction({ messageId: message.id, optionIndex });
    if (result.error) {
      setPollVotes((current) => ({ ...current, [message.id]: previous }));
      setRealtimeError(result.error);
    }
  };

  const activeCommunity = communities.find((community) => community.id === activeCommunityId);
  const communityAccent = /^#[0-9a-f]{6}$/i.test(activeCommunity?.accent_color ?? "") ? activeCommunity!.accent_color : "#8b5cf6";
  const communityChatStyle: React.CSSProperties = {
    borderColor: `${communityAccent}78`,
    background: `radial-gradient(ellipse 100% 62% at 50% -12%, ${communityAccent}78 0%, transparent 72%), linear-gradient(160deg, ${communityAccent}4a 0%, #0b0d12 72%)`,
  };
  const textChannels = communityChannels.filter((channel) => channel.type === "text");
  const voiceChannels = communityChannels.filter((channel) => channel.type === "voice");
  const visibleMessages = useMemo(() => {
    const query = messageSearch.trim().toLocaleLowerCase("pt-BR");
    return messages.filter((message) => message.channelId === activeChannel && (!query || `${message.author} ${message.content}`.toLocaleLowerCase("pt-BR").includes(query)));
  }, [messages, activeChannel, messageSearch]);
  const draftLinkUrl = useMemo(() => extractFirstLink(draft), [draft]);
  const currentChannel = textChannels.find((channel) => channel.id === activeChannel) ?? textChannels[0];
  const voiceName = voiceChannels.find((channel) => channel.id === voiceChannel)?.name ?? voiceContext?.channelName;
  const chatConnectionLabel = chatConnectionState === "connected" ? "Chat ao vivo" : chatConnectionState === "reconnecting" ? "Reconectando chat" : chatConnectionState === "connecting" ? "Conectando chat" : "Chat indisponível";
  const voiceConnectionLabel = voiceConnectionState === "connected" ? "Voz conectada" : voiceConnectionState === "reconnecting" ? "Reconectando voz" : voiceConnectionState === "connecting" ? "Conectando voz" : "Voz indisponível";
  const onlineMembers = user ? [...(user.status === "invisible" ? [] : [user]), ...Object.values(onlineUsers).filter((onlineUser) => onlineUser.id !== user.id && onlineUser.status !== "invisible")] : [];
  const onlineIds = new Set(onlineMembers.map((member) => member.id));
  const displayedCommunityMembers = communityMembers
    .map((member) => ({ ...member, online: onlineIds.has(member.id) }))
    .sort((a, b) => Number(b.online) - Number(a.online) || Number(b.isOwner) - Number(a.isOwner) || a.display_name.localeCompare(b.display_name));
  const currentAccess = activeCommunity && user
    ? resolveCommunityAccess(activeCommunity.owner_id, user.id, communityRoles, memberRoleAssignments)
    : EMPTY_COMMUNITY_ACCESS;
  const canModerateVoiceMember = (memberId: string) => {
    if (!currentAccess.manageMembers || memberId === user?.id) return false;
    const member = displayedCommunityMembers.find((item) => item.id === memberId);
    if (!member || member.isOwner) return false;
    const highest = Math.max(0, ...(member.roles ?? []).map((role) => role.position));
    return currentAccess.highestPosition > highest;
  };
  const memberNameColors = new Map(displayedCommunityMembers.map((member) => {
    const primaryRole = member.roles?.find((role) => role.id === member.display_role_id) ?? member.roles?.reduce<CommunityRoleWithIcon | null>((highest, role) => !highest || role.position > highest.position ? role : highest, null);
    return [member.id, primaryRole?.color ?? "#c8c2b8"];
  }));
  const memberPrimaryRoles = new Map(displayedCommunityMembers.flatMap((member) => {
    const highestRole = member.roles?.find((role) => role.id === member.display_role_id) ?? member.roles?.reduce<CommunityRoleWithIcon | null>((highest, role) => !highest || role.position > highest.position ? role : highest, null);
    return highestRole ? [[member.id, highestRole] as const] : [];
  }));
  const memberNameColor = (memberId: string, fallback: string) => memberNameColors.get(memberId) ?? fallback;
  const memberChatName = (memberId: string, fallback: string) => displayedCommunityMembers.find((member) => member.id === memberId)?.nickname?.trim() || fallback;
  const mentionMembers = displayedCommunityMembers.map((member) => ({ ...member, accent_color: memberNameColor(member.id, member.accent_color) }));
  const activeTypingNames = Object.values(typingUsers).filter((typing) => typing.channelId === activeChannel).map((typing) => typing.name);
  const getVoiceMembers = (channelId: string) => {
    const members = Object.values(voiceMembers)
      .filter((member) => member.voiceChannel === channelId)
      .filter((member, index, all) => all.findIndex((candidate) => candidate.id === member.id) === index);
    if (user && voiceChannel === channelId && !members.some((member) => member.id === user.id)) members.unshift({ ...user, onlineAt: new Date().toISOString(), voiceChannel, muted });
    return members;
  };
  const currentVoiceMembers = voiceChannel ? getVoiceMembers(voiceChannel) : [];
  const remoteScreenPeer = Object.values(voicePeers).find((peer) => peer.screenSharing);
  const watchedScreenPeer = watchingScreenId ? voicePeers[watchingScreenId] : undefined;
  const activeScreenStream = screenSharing ? localScreenPreview : watchedScreenPeer?.screenStream;
  const screenPresenter = screenSharing ? user?.name : watchedScreenPeer?.name ?? remoteScreenPeer?.name;
  const screenQuality = screenSharing
    ? localScreenQuality
    : { height: watchedScreenPeer?.screenHeight ?? remoteScreenPeer?.screenHeight ?? 720, frameRate: Math.round(watchedScreenPeer?.screenFrameRate ?? remoteScreenPeer?.screenFrameRate ?? 30) };
  const screenQualityLabel = `${screenQuality?.height ?? 720}P · ${screenQuality?.frameRate ?? 30} FPS`;

  const moderateVoiceParticipant = async (memberId: string, channelId: string, operation: "mute" | "disconnect") => {
    if (!activeCommunity || !canModerateVoiceMember(memberId)) return;
    const result = await moderateVoiceMemberAction({ communityId: activeCommunity.id, channelId, userId: memberId, operation });
    setModerationNotice(result.error ?? (operation === "mute" ? "Participante silenciado na chamada." : "Participante removido da chamada."));
    setVoiceMemberMenu(null);
  };

  const openVoiceModerationMenu = (member: PresenceUser, channelId: string, x: number, y: number) => {
    if (!canModerateVoiceMember(member.id)) return;
    setVoiceMemberMenu({ memberId: member.id, channelId, name: member.name, x, y });
  };

  const handleCommunityCreated = async (communityId: string) => {
    setCreateCommunityOpen(false);
    await loadWorkspace(communityId);
  };

  const selectCommunity = async (communityId: string) => {
    if (communityId === activeCommunityId) return;
    setVoicePanelChannelId(null);
    setPinnedVoiceUserId(null);
    await loadWorkspace(communityId);
  };

  const returnToCallCommunity = async () => {
    if (!voiceContext || voiceContext.communityId === activeCommunityId) return;
    await loadWorkspace(voiceContext.communityId);
  };

  const handleChannelCreated = async (channelId: string, type: "text" | "voice") => {
    setChannelModalType(null);
    setEditingChannel(null);
    await loadWorkspace(activeCommunityId ?? undefined, type === "text" ? channelId : activeChannel ?? undefined);
  };

  const openMemberProfile = (userId: string) => {
    const member = displayedCommunityMembers.find((item) => item.id === userId);
    if (member) {
      setSelectedProfileContext("community");
      setSelectedProfile(member);
    }
  };

  const openExternalProfile = (profile: MemberProfile) => {
    setSelectedProfileContext("external");
    setSelectedProfile(profile);
  };

  const mentionMessageAuthor = (message: Message) => {
    const member = communityMembers.find((item) => item.id === message.authorId);
    const mention = `@${member?.username ?? message.author.toLowerCase().replace(/[^a-z0-9_]/g, "_")} `;
    setDraft((current) => current.includes(mention.trim()) ? current : `${current}${current && !current.endsWith(" ") ? " " : ""}${mention}`);
    setMessageMenu(null);
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
    if (!user || !activeChannel) return;
    const sendTyping = (active: boolean) => void realtime.current?.send({ type: "broadcast", event: "typing", payload: { userId: user.id, name: user.name, channelId: activeChannel, active } });
    if (!value.trim()) {
      sendTyping(false);
      typingSentAt.current = 0;
      if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
      return;
    }
    const now = Date.now();
    if (now - typingSentAt.current > 1200) {
      sendTyping(true);
      typingSentAt.current = now;
    }
    if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
    typingStopTimer.current = window.setTimeout(() => { sendTyping(false); typingSentAt.current = 0; }, 1800);
  };

  const jumpToMessage = async (messageId: string) => {
    let target = messages.find((message) => message.id === messageId) ?? replySnapshots[messageId];
    if (!target) {
      const { data: row } = await supabase.from("messages").select("*").eq("id", messageId).maybeSingle();
      if (row) {
        const { data: author } = await supabase.from("profiles").select("display_name, accent_color, avatar_url").eq("id", row.author_id).maybeSingle();
        if (author) target = messageFromRow(row, author);
      }
    }
    if (!target || target.channelId !== activeChannel) {
      setRealtimeError("A mensagem original não está mais disponível neste canal.");
      return;
    }
    if (!messages.some((message) => message.id === target?.id)) {
      setMessages((current) => [...current, target!].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-151));
    }
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    window.setTimeout(() => {
      document.getElementById(`message-${messageId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMessageId(messageId);
      highlightTimer.current = window.setTimeout(() => setHighlightedMessageId(null), 1800);
    }, 40);
  };

  const deleteSelectedMessage = async (message: Message) => {
    setMessageMenu(null);
    const result = await deleteMessageAction({ messageId: message.id });
    if (result.error) {
      setRealtimeError(result.error);
      return;
    }
    setMessages((old) => old.filter((item) => item.id !== message.id));
    if (replyTarget?.id === message.id) setReplyTarget(null);
    await realtime.current?.send({ type: "broadcast", event: "message-deleted", payload: { id: message.id, channelId: message.channelId } });
  };

  const banMessageAuthor = async (message: Message) => {
    if (!activeCommunity || !canModerateVoiceMember(message.authorId)) return;
    const formData = new FormData();
    formData.set("communityId", activeCommunity.id);
    formData.set("userId", message.authorId);
    const result = await banCommunityMemberAction({}, formData);
    setMessageMenu(null);
    setModerationNotice(result.error ?? `${message.author} foi banido da comunidade.`);
    if (!result.error) await loadCommunityPeople(activeCommunity.id);
  };

  const toggleMessageReaction = async (message: Message, emoji: string) => {
    const currentUserId = user?.id;
    if (!currentUserId) return;
    setMessageMenu(null);
    const result = await toggleMessageReactionAction({ messageId: message.id, emoji });
    if (result.error || result.active === undefined) {
      setRealtimeError(result.error ?? "Não foi possível atualizar a reação.");
      return;
    }
    setMessageReactions((current) => {
      const withoutOwn = (current[message.id] ?? []).filter((reaction) => !(reaction.user_id === currentUserId && reaction.emoji === emoji));
      return {
        ...current,
        [message.id]: result.active
          ? [...withoutOwn, { message_id: message.id, user_id: currentUserId, emoji, created_at: new Date().toISOString() }]
          : withoutOwn,
      };
    });
  };

  const openNotification = async (notification: AppNotification) => {
    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read: true } : item));
    setNotificationsOpen(false);
    await loadWorkspace(notification.communityId, notification.channelId);
  };

  const respondToFriendRequest = async (request: IncomingFriendRequest, decision: "accepted" | "declined") => {
    const formData = new FormData();
    formData.set("userA", request.userA);
    formData.set("userB", request.userB);
    formData.set("decision", decision);
    const result = await respondFriendRequestAction({}, formData);
    if (result.error) setRealtimeError(result.error);
    await refreshIncomingFriendRequests();
  };

  const respondToPairRequest = async (request: IncomingPairRequest, decision: "accepted" | "declined") => {
    const result = await respondCommunityPairRequestAction({ requestId: request.id, decision });
    if (result.error) setRealtimeError(result.error);
    await refreshIncomingPairRequests();
    if (decision === "accepted" && activeCommunityId === request.communityId) await loadCommunityPeople(request.communityId);
  };
  const unreadNotifications = notifications.filter((notification) => !notification.read).length + incomingFriendRequests.length + incomingPairRequests.length;

  if (!user || !activeCommunity || !currentChannel) return <main className="auth-loading"><span className="brand-mark large">F</span><p>{authLoading ? "Preparando seu espaço…" : "Crie sua primeira comunidade para começar."}</p>{!authLoading && <button className="auth-submit compact" onClick={() => setCreateCommunityOpen(true)}><Plus size={16} />Criar comunidade</button>}{createCommunityOpen && <CreateCommunityModal open onClose={() => setCreateCommunityOpen(false)} onCreated={(id) => void handleCommunityCreated(id)} />}</main>;

  return (
    <main className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${membersCollapsed ? "members-collapsed" : ""}`} style={{ "--community-accent": activeCommunity.accent_color } as React.CSSProperties}>
      <aside className="server-rail" aria-label="Barra principal">
        <button className="server brand-server" aria-label="Início do FYNEX"><span>FYNEX</span></button>
        <div className="rail-divider" />
        <nav className="rail-community-list" aria-label="Suas comunidades">
          {communities.map((community) => (
            <button
              key={community.id}
              className={`rail-community ${community.id === activeCommunityId ? "active" : ""} ${community.id === voiceContext?.communityId ? "in-call" : ""}`}
              onClick={() => void selectCommunity(community.id)}
              aria-label={`Abrir ${community.name}`}
              title={community.name}
            >
              <span style={{ backgroundColor: community.accent_color, backgroundImage: community.avatar_url ? `url(${community.avatar_url})` : undefined }}>
                {community.avatar_url ? "" : community.name.slice(0, 2).toUpperCase()}
              </span>
              {(unreadCommunityCounts[community.id] ?? 0) > 0 && <b className="rail-unread-count">{unreadCommunityCounts[community.id] > 99 ? "99+" : unreadCommunityCounts[community.id]}</b>}
              {community.id === voiceContext?.communityId && <i aria-hidden="true" />}
            </button>
          ))}
          <button className="rail-community rail-community-add" onClick={() => setCreateCommunityOpen(true)} aria-label="Criar comunidade" title="Criar comunidade"><Plus size={18} /></button>
        </nav>
        {voiceChannel && <button className={`top-call-indicator ${voiceConnectionState}`} onClick={() => void returnToCallCommunity()} title={`${voiceConnectionLabel}. Voltar à chamada`}><Radio size={14} /><span><strong>{voiceConnectionState === "connected" ? "EM CALL" : voiceConnectionLabel.toUpperCase()}</strong>{voiceContext?.communityName} · {voiceName}</span>{screenSharing && <MonitorUp size={13} />}</button>}
        <div className="rail-spacer" />
        <button className={`top-connections notification-trigger ${unreadNotifications ? "has-unread" : ""}`} onClick={() => setNotificationsOpen((open) => !open)} aria-label="Abrir notificações" title="Notificações"><Bell size={16} />{unreadNotifications > 0 && <i>{unreadNotifications > 9 ? "9+" : unreadNotifications}</i>}</button>
        <button className="top-connections" onClick={() => { setDirectMessageTarget(null); setDirectMessagesOpen(true); }} aria-label="Mensagens privadas" title="Mensagens privadas"><MessageCircle size={16} /></button>
        <button className="top-connections" onClick={() => setConnectionsTab("friends")} aria-label="Amigos e convites" title="Amigos e convites"><UserPlus size={16} /></button>
        <Link className="top-profile-button" href="/profile" aria-label="Abrir perfil" title="Abrir perfil"><Avatar name={user.name} color={user.color} imageUrl={user.avatarUrl} presenceStatus={user.status} small /></Link>
      </aside>

      {notificationsOpen && <aside className="notifications-popover" aria-label="Notificações"><header><strong>Notificações</strong><button onClick={() => setNotificationsOpen(false)} aria-label="Fechar notificações"><X size={15} /></button></header>{incomingFriendRequests.length > 0 && <section className="friend-notifications"><h3>PEDIDOS DE AMIZADE</h3>{incomingFriendRequests.map((request) => <article key={`${request.userA}-${request.userB}`}><button className="friend-notification-person" onClick={() => openExternalProfile(request.person)}><Avatar name={request.person.display_name} color={request.person.accent_color} imageUrl={request.person.avatar_url} small status={false} /><span><strong>{request.person.display_name}</strong><small>@{request.person.username}</small></span></button><div><button onClick={() => void respondToFriendRequest(request, "accepted")}><Check size={13} />Aceitar</button><button onClick={() => void respondToFriendRequest(request, "declined")}><X size={13} />Recusar</button></div></article>)}</section>}{incomingPairRequests.length > 0 && <section className="friend-notifications"><h3>PEDIDOS DE PAR</h3>{incomingPairRequests.map((request) => <article key={request.id}><button className="friend-notification-person" onClick={() => { setSelectedProfileContext("community"); setSelectedProfile(request.person); }}><Avatar name={request.person.display_name} color={request.person.accent_color} imageUrl={request.person.avatar_url} small status={false} /><span><strong>{request.person.display_name}</strong><small>quer ser seu par nesta comunidade</small></span></button><div><button onClick={() => void respondToPairRequest(request, "accepted")}><Check size={13} />Aceitar</button><button onClick={() => void respondToPairRequest(request, "declined")}><X size={13} />Recusar</button></div></article>)}</section>}{notifications.length ? <div>{notifications.map((notification) => <button key={notification.id} className={notification.read ? "read" : ""} onClick={() => void openNotification(notification)}><Bell size={14} /><span><strong>{notification.author}</strong><small>{notification.text} em #{notification.channelName}</small></span></button>)}</div> : !incomingFriendRequests.length && !incomingPairRequests.length && <p>Nenhuma notificação por enquanto.</p>}</aside>}

      <button className={`mobile-backdrop ${mobileNav ? "visible" : ""}`} onClick={() => setMobileNav(false)} aria-label="Fechar menu de canais" aria-hidden={!mobileNav} tabIndex={mobileNav ? 0 : -1} />
      {sidebarCollapsed && <button className="sidebar-reopen" onClick={() => setSidebarCollapsed(false)} aria-label="Mostrar canais"><PanelLeftOpen size={17} /></button>}
      {membersCollapsed && <button className="members-reopen" onClick={() => setMembersCollapsed(false)} aria-label="Mostrar membros"><PanelRightOpen size={17} /></button>}

      <aside className={`channel-sidebar ${mobileNav ? "mobile-open" : ""}`}>
        <header className={`community-header ${activeCommunity.banner_url ? "has-banner" : ""}`} style={activeCommunity.banner_url ? { backgroundImage: `linear-gradient(90deg, rgba(7,6,10,.9), rgba(7,6,10,.5)), url(${activeCommunity.banner_url})` } : undefined}><div><span className="community-dot" style={{ backgroundColor: activeCommunity.accent_color, backgroundImage: activeCommunity.avatar_url ? `url(${activeCommunity.avatar_url})` : undefined }}>{activeCommunity.avatar_url ? "" : activeCommunity.name.slice(0, 1).toUpperCase()}</span><strong>{activeCommunity.name}</strong></div><div className="community-header-actions">{currentAccess.isAdmin && <button onClick={() => setCommunitySettingsOpen(true)} aria-label="Configurar comunidade" title="Configurar comunidade"><Settings size={15} /></button>}<button className="sidebar-collapse" onClick={() => setSidebarCollapsed(true)} aria-label="Recolher canais" title="Recolher canais"><PanelLeftClose size={16} /></button><button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Fechar menu"><X size={17} /></button></div></header>
        <nav className="community-switcher" aria-label="Suas comunidades">
          <div className="community-switcher-title"><span>SUAS COMUNIDADES</span><button onClick={() => setCreateCommunityOpen(true)} aria-label="Criar comunidade"><Plus size={14} /></button></div>
          {communities.map((community) => <button key={community.id} className={`community-switcher-item ${community.id === activeCommunityId ? "active" : ""} ${community.id === voiceContext?.communityId ? "in-call" : ""}`} onClick={() => void selectCommunity(community.id)}><span className="community-switcher-avatar" style={{ backgroundColor: community.accent_color, backgroundImage: community.avatar_url ? `url(${community.avatar_url})` : undefined }}>{community.avatar_url ? "" : community.name.slice(0, 2).toUpperCase()}</span><strong>{community.name}</strong>{(unreadCommunityCounts[community.id] ?? 0) > 0 && <em className="community-unread-count">{unreadCommunityCounts[community.id] > 99 ? "99+" : unreadCommunityCounts[community.id]}</em>}{community.id === voiceContext?.communityId && <i title={screenSharing ? "Transmitindo nesta comunidade" : "Em chamada nesta comunidade"}>{screenSharing ? <MonitorUp size={11} /> : <Radio size={11} />}</i>}</button>)}
        </nav>
        {currentAccess.isAdmin && <div className="invite-card"><UserPlus size={15} /><div><strong>Convide alguém</strong><small>Link permanente e entrada</small></div><button onClick={() => setConnectionsTab("community")}>Gerenciar</button></div>}
        {currentAccess.manageChannels && <button className="channel-organization-trigger" onClick={() => setChannelLayoutOpen(true)}><FolderPlus size={15}/><span><strong>Organizar canais</strong><small>Criar categorias e ordenar canais</small></span></button>}
        <nav className="channel-nav">
          <section>
            <div className="section-title"><span>CANAIS DE TEXTO</span>{currentAccess.manageChannels && <button onClick={() => { setNewChannelCategoryId(null); setChannelModalType("text"); }} aria-label="Criar canal de texto" title="Criar canal de texto"><Plus size={14} /></button>}</div>
            {textChannels.filter((channel) => !channel.category_id).map((channel) => <div className="channel-row" key={channel.id}><button className={`channel ${activeChannel === channel.id ? "selected" : ""}`} onClick={() => { setActiveChannel(channel.id); syncWorkspaceUrl(activeCommunity.id, channel.id); setMobileNav(false); }}><MessageCircle size={16} />{channel.name}<i>{onlineMembers.length}</i></button>{currentAccess.manageChannels && <button className="channel-edit" onClick={() => setEditingChannel(channel)} aria-label={`Editar canal ${channel.name}`} title="Editar canal"><Pencil size={12} /></button>}</div>)}
          </section>
          <section className="voice-section">
            <div className="section-title"><span>CANAIS DE VOZ</span>{currentAccess.manageChannels && <button onClick={() => setChannelModalType("voice")} aria-label="Criar canal de voz" title="Criar canal de voz"><Plus size={14} /></button>}</div>
            {voiceChannels.filter((channel) => !channel.category_id).map((channel) => {
              const channelMembers = getVoiceMembers(channel.id);
              return <div key={channel.id}>
                <div className="channel-row"><button className={`channel voice-channel ${voiceChannel === channel.id ? "selected" : ""}`} onClick={() => void openVoiceChannel(channel.id)} disabled={voiceChannel !== channel.id && channelMembers.length >= (channel.user_limit ?? 10)}><Radio size={16} />{channel.name}<small className="voice-capacity">{channelMembers.length}/{channel.user_limit ?? 10}</small>{voiceChannel === channel.id && <b className={`live-pill ${voiceConnectionState}`}>{voiceConnectionState === "connected" ? "CONECTADO" : voiceConnectionLabel.toUpperCase()}</b>}</button>{currentAccess.manageChannels && <button className="channel-edit" onClick={() => setEditingChannel(channel)} aria-label={`Editar canal ${channel.name}`} title="Editar canal"><Pencil size={12} /></button>}</div>
                {channelMembers.length > 0 && <div className="voice-list">
                  {channelMembers.map((member) => {
                    const isCurrentUser = member.id === user.id;
                    const peer = voicePeers[member.id];
                    const memberSpeaking = isCurrentUser ? speaking : !!peer?.speaking;
                    const memberMuted = isCurrentUser ? muted : (peer?.muted ?? member.muted ?? false);
                    const locallyMuted = locallyMutedUsers.has(member.id);
                    return <div className={`voice-user ${memberSpeaking ? "speaking" : ""} ${locallyMuted ? "locally-muted" : ""}`} key={member.id} onContextMenu={(event) => { if (!canModerateVoiceMember(member.id)) return; event.preventDefault(); openVoiceModerationMenu(member, channel.id, event.clientX, event.clientY); }}><Avatar name={member.name} color={member.color} imageUrl={member.avatarUrl} small status={false} /><span style={{ color: memberNameColor(member.id, member.color) }}>{member.name}{isCurrentUser ? " (você)" : ""}</span>{!isCurrentUser && <small className={peer?.stream ? "audio-ready" : ""}>{locallyMuted ? "silenciado para você" : peer?.stream ? "áudio ativo" : "conectando"}</small>}{memberMuted && <MicOff size={12} />}{!isCurrentUser && <button className="local-mute-button" onClick={() => toggleLocalMute(member.id)} aria-label={locallyMuted ? `Ouvir ${member.name}` : `Silenciar ${member.name} somente para você`} title={locallyMuted ? "Voltar a ouvir" : "Silenciar para mim"}>{locallyMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}</button>}{canModerateVoiceMember(member.id) && <VoiceMemberActions name={member.name} onOpen={(x, y) => openVoiceModerationMenu(member, channel.id, x, y)} />}</div>;
                  })}
                </div>}
              </div>;
            })}
          </section>
          {channelCategories.map((category) => <section className="channel-category" key={category.id}><div className="section-title"><span>{category.name.toUpperCase()}</span>{currentAccess.manageChannels && <button onClick={() => { setNewChannelCategoryId(category.id); setChannelModalType("text"); }} aria-label={`Criar canal na categoria ${category.name}`} title="Criar canal nesta categoria"><Plus size={14}/></button>}</div>{communityChannels.filter((channel) => channel.category_id === category.id).map((channel) => <div className="channel-row" key={channel.id}>{channel.type === "text" ? <button className={`channel ${activeChannel === channel.id ? "selected" : ""}`} onClick={() => { setActiveChannel(channel.id); syncWorkspaceUrl(activeCommunity.id, channel.id); setMobileNav(false); }}><MessageCircle size={16}/>{channel.name}</button> : <button className={`channel voice-channel ${voiceChannel === channel.id ? "selected" : ""}`} onClick={() => void openVoiceChannel(channel.id)}><Radio size={16}/>{channel.name}<small className="voice-capacity">{getVoiceMembers(channel.id).length}/{channel.user_limit ?? 10}</small></button>}{currentAccess.manageChannels && <button className="channel-edit" onClick={() => setEditingChannel(channel)} aria-label={`Editar canal ${channel.name}`}><Pencil size={12}/></button>}</div>)}</section>)}
        </nav>
        {(micError || realtimeError) && <div className="mic-error">{micError || realtimeError}</div>}
        {voiceChannel && <div className={`voice-connection ${voiceConnectionState}`}><div>{voiceConnectionState === "connected" ? <Radio className="signal-icon" size={17} /> : <WifiOff className="signal-icon" size={17} />}<strong>{voiceConnectionLabel}</strong><small>{voiceConnectionState === "reconnecting" ? "A chamada será retomada automaticamente" : `${voiceContext?.communityName} · ${voiceName}`}</small></div><span className="voice-connection-actions">{voiceContext?.communityId !== activeCommunityId && <button onClick={() => void returnToCallCommunity()} aria-label="Voltar à comunidade da chamada" title="Voltar à comunidade da chamada"><MessageCircle size={14} /></button>}<button onClick={leaveVoice} aria-label="Desconectar da voz"><PhoneOff size={15} /></button></span></div>}
        <div className="user-panel">
          <Link className="avatar-profile-button" href="/profile" aria-label="Abrir perfil" title="Abrir perfil"><Avatar name={user.name} color={user.color} imageUrl={user.avatarUrl} presenceStatus={user.status} /></Link>
          <div className="user-copy"><strong style={{ color: memberNameColor(user.id, user.color) }}>{user.name}</strong></div>
          <button className={muted ? "control-on" : ""} onClick={toggleMute} aria-label={muted ? "Ativar microfone" : "Silenciar microfone"}>{muted ? <MicOff size={15} /> : <Mic size={15} />}</button>
          <button className={deafened ? "control-on" : ""} onClick={() => setDeafened(!deafened)} aria-label={deafened ? "Ativar áudio" : "Silenciar áudio"}>{deafened ? <VolumeX size={15} /> : <Volume2 size={15} />}</button>
          <button className={screenSharing ? "control-on screen-on" : ""} onClick={() => screenSharing ? void stopScreenShare() : void startScreenShare()} aria-label={screenSharing ? "Parar transmissão de tela" : "Compartilhar tela"}>{screenSharing ? <Square size={14} /> : <MonitorUp size={15} />}</button>
          <button aria-label="Configurações de áudio e transmissão" title="Áudio e transmissão" onClick={() => setMediaSettingsOpen(true)}><Settings size={15} /></button>
        </div>
      </aside>

      <section className="chat-panel" style={communityChatStyle}>
        <header className="chat-header">
          <button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Abrir canais"><Menu size={18} /></button>
          <span className="hash"><Hash size={16} /></span><strong>{currentChannel.name}</strong><i />
          <p>{activeCommunity.description || `Conversas em ${activeCommunity.name}`}</p>
          <div className="header-actions"><div className={`connection-state ${chatConnectionState}`} title={chatConnectionLabel}>{chatConnectionState === "connected" ? <Wifi size={13} /> : <WifiOff size={13} />}<span>{chatConnectionLabel}</span></div><div className="header-online"><span />{onlineMembers.length} online</div><button aria-label="Notificações" onClick={() => setNotificationsOpen(true)}><Bell size={16} /></button><label><Search size={14} /><input value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)} placeholder="Buscar mensagens ou pessoas" />{messageSearch && <button onClick={() => setMessageSearch("")} aria-label="Limpar busca"><X size={12} /></button>}</label></div>
        </header>

        {voicePanelChannelId && <section className="voice-room-stage">
          <header><div><span>CANAL DE VOZ</span><strong>{voiceChannel === voicePanelChannelId ? voiceName : voiceChannels.find((channel) => channel.id === voicePanelChannelId)?.name ?? "Sala de voz"}</strong><small>{getVoiceMembers(voicePanelChannelId).length} participante(s)</small></div><button onClick={() => { setVoicePanelChannelId(null); setPinnedVoiceUserId(null); }} aria-label="Fechar visualização da chamada"><X size={18} /></button></header>
          <div className="voice-room-grid">{getVoiceMembers(voicePanelChannelId).map((member) => { const peer = voicePeers[member.id]; const isCurrentUser = member.id === user.id; const locallyMuted = locallyMutedUsers.has(member.id); return <button key={member.id} className={`voice-room-card ${(isCurrentUser ? speaking : peer?.speaking) ? "speaking" : ""} ${pinnedVoiceUserId === member.id ? "pinned" : ""}`} onContextMenu={(event) => { if (!canModerateVoiceMember(member.id)) return; event.preventDefault(); openVoiceModerationMenu(member, voicePanelChannelId, event.clientX, event.clientY); }} onClick={() => { setPinnedVoiceUserId((current) => current === member.id ? null : member.id); if (!isCurrentUser) openMemberProfile(member.id); }}><Avatar name={member.name} color={member.color} imageUrl={member.avatarUrl} /><strong>{member.name}{isCurrentUser ? " (você)" : ""}</strong><small>{locallyMuted ? "Silenciado para você" : peer?.stream || isCurrentUser ? "Na chamada" : "Conectando"}</small>{pinnedVoiceUserId === member.id && <i>DESTAQUE</i>}</button>; })}</div>
          <footer><button className={muted ? "active" : ""} onClick={toggleMute}>{muted ? <MicOff size={17} /> : <Mic size={17} />}<span>{muted ? "Ativar microfone" : "Silenciar"}</span></button><button className={deafened ? "active" : ""} onClick={() => setDeafened(!deafened)}>{deafened ? <VolumeX size={17} /> : <Volume2 size={17} />}<span>{deafened ? "Ouvir novamente" : "Ensurdecer"}</span></button><button className={screenSharing ? "active screen" : ""} onClick={() => screenSharing ? void stopScreenShare() : void startScreenShare()}>{screenSharing ? <Square size={16} /> : <MonitorUp size={17} />}<span>{screenSharing ? "Parar transmissão" : "Transmitir tela"}</span></button><button className="leave" onClick={leaveVoice}><PhoneOff size={17} /><span>Sair da chamada</span></button></footer>
        </section>}

        {(screenSharing || remoteScreenPeer) && !streamViewerOpen && <section className="screen-invite">
          <div className="screen-invite-preview"><MonitorUp size={25} /></div>
          <div><span>TRANSMISSÃO AO VIVO</span><strong>{screenSharing ? "Sua tela está sendo transmitida" : `${remoteScreenPeer?.name} está compartilhando a tela`}</strong><small>{screenQualityLabel} · conexão ativada somente para espectadores</small></div>
          <button onClick={() => {
            if (screenSharing || watchingScreenId === remoteScreenPeer?.id) {
              setStreamViewerOpen(true);
            } else if (remoteScreenPeer) {
              watchScreen(remoteScreenPeer.id);
            }
          }}><Eye size={15} /> {watchingScreenId || screenSharing ? "Abrir transmissão" : "Assistir transmissão"}</button>
        </section>}

        {streamViewerOpen && (screenSharing || watchingScreenId) && <section className="screen-stage" ref={screenStage}>
          <header className="screen-toolbar">
            <div><MonitorUp size={16} /><span><strong>{screenPresenter ?? "Transmissão"}</strong><small>{screenSharing ? `${screenViewerCount} ${screenViewerCount === 1 ? "espectador" : "espectadores"}` : activeScreenStream ? "Ao vivo" : "Conectando ao vídeo..."}</small></span></div>
            <div><b>{screenQualityLabel}</b><button onClick={() => setStreamViewerOpen(false)} aria-label="Minimizar transmissão"><Minimize2 size={15} /></button><button onClick={() => screenSharing ? void stopScreenShare() : stopWatchingScreen()} aria-label={screenSharing ? "Encerrar transmissão" : "Sair da transmissão"}><X size={16} /></button></div>
          </header>
          <div className="screen-player">
            {activeScreenStream ? <ScreenVideo stream={activeScreenStream} /> : <div className="screen-loading"><span /><strong>Conectando à transmissão</strong><small>O vídeo começa assim que a conexão direta estiver pronta.</small></div>}
          </div>
          <footer className="screen-controls">
            <div><span className="live-dot" /> AO VIVO</div>
            <div>
              <button onClick={() => setStreamViewerOpen(false)} aria-label="Ver o chat sem encerrar a transmissão"><MessageCircle size={17} /><span>Ver chat</span></button>
              <button onClick={() => void toggleStreamFullscreen()} aria-label={streamFullscreen ? "Sair da tela cheia" : "Abrir em tela cheia"}>{streamFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}<span>{streamFullscreen ? "Sair da tela cheia" : "Tela cheia"}</span></button>
              {!screenSharing && <button onClick={stopWatchingScreen} className="leave-stream"><EyeOff size={17} /><span>Sair da transmissão</span></button>}
              {screenSharing && <button onClick={() => void stopScreenShare()} className="leave-stream"><Square size={16} /><span>Encerrar transmissão</span></button>}
            </div>
            <small>{screenSharing ? `Enviando vídeo para ${screenViewerCount}` : "Recebendo vídeo enquanto você assiste"}</small>
          </footer>
        </section>}

        <div className="messages" ref={messagesContainer}>
          <div className="channel-intro"><div><MessageCircle size={21} /></div><h2>Bem-vindo a #{currentChannel.name}</h2><p>Este é o começo deste canal em {activeCommunity.name}.</p></div>
          {visibleMessages.map((message, index) => {
            if (message.messageKind === "system") {
              return <article id={`message-${message.id}`} className="system-message" key={message.id}><span>{message.content}</span><time>{message.time}</time></article>;
            }
            const previous = visibleMessages[index - 1];
            const grouped = previous?.messageKind !== "system" && previous?.authorId === message.authorId;
            const repliedMessage = message.replyToId ? visibleMessages.find((item) => item.id === message.replyToId) ?? replySnapshots[message.replyToId] : undefined;
            const authorName = memberChatName(message.authorId, message.author);
            return <article id={`message-${message.id}`} className={`message ${grouped ? "grouped" : ""} ${highlightedMessageId === message.id ? "message-highlighted" : ""}`} key={message.id} onContextMenu={(event) => { event.preventDefault(); setMessageMenu({ message, x: event.clientX, y: event.clientY }); }}>
              {!grouped && <button className="message-profile-trigger avatar-trigger" onClick={() => openMemberProfile(message.authorId)} aria-label={`Ver perfil de ${authorName}`}><Avatar name={authorName} color={message.color} imageUrl={message.avatarUrl} status={false} /></button>}
              <div>{message.replyToId && <MessageReplyPreview message={repliedMessage} missing={!repliedMessage} onJump={() => void jumpToMessage(message.replyToId!)} />}{!grouped && <header><button className="message-profile-trigger" style={{ color: memberNameColor(message.authorId, message.color) }} onClick={() => openMemberProfile(message.authorId)}>{authorName}{memberPrimaryRoles.get(message.authorId) ? <RoleIcon name={memberPrimaryRoles.get(message.authorId)?.icon} customUrl={memberPrimaryRoles.get(message.authorId)?.customIcon?.image_url} color={memberPrimaryRoles.get(message.authorId)?.color} /> : null}</button><time>{message.time}</time></header>}
                {message.content && <p><MessageMentionText content={message.content} members={displayedCommunityMembers} onProfile={(profile) => { setSelectedProfileContext("community"); setSelectedProfile(profile); }} /></p>}
                {message.linkPreview ? <MessageLinkPreview preview={message.linkPreview} /> : null}
                {message.attachment ? <MessageAttachment attachment={message.attachment} /> : null}
                {message.poll ? <MessagePoll question={message.poll.question} options={message.poll.options} votes={pollVotes[message.id] ?? []} currentUserId={user.id} disabled={sending} onVote={(optionIndex) => void votePoll(message, optionIndex)} /> : null}
                {message.stickerId ? <MessageSticker sticker={communityStickers.find((sticker) => sticker.id === message.stickerId)} /> : null}
                <MessageReactions reactions={messageReactions[message.id] ?? []} currentUserId={user.id} onToggle={(emoji) => void toggleMessageReaction(message, emoji)} />
              </div>
              <button className="message-more" onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setMessageMenu({ message, x: rect.right - 198, y: rect.bottom + 4 }); }} aria-label="Ações da mensagem"><MoreHorizontal size={16} /></button>
            </article>;
          })}
        </div>
        {activeTypingNames.length > 0 && <div className="typing-indicator"><i><span /><span /><span /></i><strong>{activeTypingNames.length === 1 ? activeTypingNames[0] : activeTypingNames.length === 2 ? `${activeTypingNames[0]} e ${activeTypingNames[1]}` : `${activeTypingNames[0]}, ${activeTypingNames[1]} e mais ${activeTypingNames.length - 2}`}</strong><small>{activeTypingNames.length === 1 ? "está digitando…" : "estão digitando…"}</small></div>}
        {replyTarget && <ReplyComposerPreview message={replyTarget} onClose={() => setReplyTarget(null)} />}
        <MessageComposer attachment={attachment} channelName={currentChannel.name} draft={draft} realtimeConnected={realtimeConnected} sending={sending} uploadProgress={uploadProgress} members={mentionMembers} stickers={communityStickers} canMentionEveryone={currentAccess.isAdmin} focusRequestKey={replyTarget?.id ?? null} onAttachment={chooseAttachment} onDraft={handleDraftChange} onRemoveAttachment={() => setAttachment(null)} linkUrl={draftLinkUrl} linkPreviewRemoved={Boolean(draftLinkUrl && removedLinkPreviewUrl === draftLinkUrl)} onRemoveLinkPreview={() => setRemovedLinkPreviewUrl(draftLinkUrl)} onRestoreLinkPreview={() => setRemovedLinkPreviewUrl(null)} onCreatePoll={(poll) => void sendSpecialMessage({ poll })} onSendSticker={(stickerId) => void sendSpecialMessage({ stickerId })} onSubmit={sendMessage} />
      </section>

      <aside className="members-panel">
        <div className="prototype-tag"><Radio size={11} /> {activeCommunity.name.toUpperCase()}</div>
        <div className="members-hero"><div className="orbit-ring"><Headphones size={25} /><i /><b /></div><strong>{voiceChannel ? voiceName : "Canal de voz"}</strong><small>{voiceChannel ? `${currentVoiceMembers.length} na conversa` : "Entre para conversar em tempo real"}</small><button onClick={() => voiceChannel ? leaveVoice() : voiceChannels[0] && void joinVoice(voiceChannels[0].id)} disabled={!voiceChannels.length}>{voiceChannel ? <><PhoneOff size={14} /> Sair da voz</> : <><Headphones size={14} /> Entrar na voz</>}</button></div>
        <div className="members-heading"><h3><Users size={12} /> MEMBROS — {displayedCommunityMembers.length}</h3><div><button onClick={() => setMembersOpen(true)}>Ver todos</button><button className="members-collapse" onClick={() => setMembersCollapsed(true)} aria-label="Recolher membros" title="Recolher membros"><PanelRightClose size={15} /></button></div></div>
        {displayedCommunityMembers.map((member) => { const shownStatus = member.online ? member.presence_status ?? "online" : "invisible"; const primaryRole = memberPrimaryRoles.get(member.id); return <button className="member member-button" key={member.id} onClick={() => { setSelectedProfileContext("community"); setSelectedProfile(member); }}><div className="member-presence-avatar"><Avatar name={member.display_name} color={member.accent_color} imageUrl={member.avatar_url} status={false} /><i className={`status-${shownStatus}`} /></div><div><strong style={{ color: memberNameColor(member.id, member.accent_color) }}>{member.display_name}{member.id === user.id && <span>VOCÊ</span>}{member.isOwner && <Crown size={11} />}{primaryRole ? <RoleIcon name={primaryRole.icon} customUrl={primaryRole.customIcon?.image_url} color={primaryRole.color} /> : null}</strong><small>@{member.username}</small></div></button>; })}
      </aside>
      {createCommunityOpen && <CreateCommunityModal open onClose={() => setCreateCommunityOpen(false)} onCreated={(id) => void handleCommunityCreated(id)} />}
      {channelModalType && <CreateChannelModal communityId={activeCommunity.id} communityName={activeCommunity.name} initialType={channelModalType} initialCategoryId={newChannelCategoryId} categories={channelCategories} onClose={() => { setChannelModalType(null); setNewChannelCategoryId(null); }} onCreated={(id, type) => void handleChannelCreated(id, type)} />}
      {editingChannel && <CreateChannelModal communityId={activeCommunity.id} communityName={activeCommunity.name} initialType={editingChannel.type as "text" | "voice"} channel={editingChannel} categories={channelCategories} onClose={() => setEditingChannel(null)} onCreated={(id, type) => void handleChannelCreated(id, type)} onDeleted={() => { setEditingChannel(null); void loadWorkspace(activeCommunity.id); }} />}
      {categoryModalOpen && <CreateChannelCategoryModal communityId={activeCommunity.id} onClose={() => setCategoryModalOpen(false)} onCreated={() => void loadWorkspace(activeCommunity.id, activeChannel ?? undefined)} />}
      {channelLayoutOpen && <ManageChannelLayoutModal communityId={activeCommunity.id} categories={channelCategories} channels={communityChannels} onClose={() => setChannelLayoutOpen(false)} onChanged={() => void loadWorkspace(activeCommunity.id, activeChannel ?? undefined)} onCreateCategory={() => setCategoryModalOpen(true)} />}
      {connectionsTab && <ConnectionsModal community={activeCommunity} currentUserId={user.id} initialTab={connectionsTab} onClose={() => setConnectionsTab(null)} onMembershipChanged={() => void loadWorkspace()} onCommunityChanged={() => void loadWorkspace(activeCommunity.id, activeChannel ?? undefined)} onViewProfile={openExternalProfile} onMessage={(profile) => { setConnectionsTab(null); setDirectMessageTarget(profile); setDirectMessagesOpen(true); }} />}
      {membersOpen && <CommunityMembersModal communityId={activeCommunity.id} communityName={activeCommunity.name} currentUserId={user.id} members={displayedCommunityMembers} roles={communityRoles} roleIcons={communityRoleIcons} assignments={memberRoleAssignments} tags={communityTags} tagAssignments={memberTagAssignments} access={currentAccess} onViewProfile={(profile) => { setSelectedProfileContext("community"); setSelectedProfile(profile); }} onClose={() => setMembersOpen(false)} onChanged={() => void loadCommunityPeople(activeCommunity.id)} />}
      {communitySettingsOpen && <CommunitySettingsModal community={activeCommunity} canDelete={currentAccess.isOwner} onClose={() => setCommunitySettingsOpen(false)} onAccentPreview={(accentColor) => setCommunities((current) => current.map((community) => community.id === activeCommunity.id ? { ...community, accent_color: accentColor } : community))} onChanged={() => void loadWorkspace(activeCommunity.id, activeChannel ?? undefined)} onDeleted={() => { setCommunitySettingsOpen(false); void loadWorkspace(); }} />}
      {selectedProfile && <MemberProfileModal profile={selectedProfile} currentUserId={user.id} communityId={selectedProfileContext === "community" ? activeCommunity.id : undefined} communityMembers={selectedProfileContext === "community" ? displayedCommunityMembers : []} onClose={() => setSelectedProfile(null)} onChanged={() => void loadCommunityPeople(activeCommunity.id)} onMessage={(profile) => { setSelectedProfile(null); setDirectMessageTarget(profile); setDirectMessagesOpen(true); }} />}
      {directMessagesOpen && <DirectMessagesModal currentUserId={user.id} initialProfile={directMessageTarget} onClose={() => { setDirectMessagesOpen(false); setDirectMessageTarget(null); }} onViewProfile={openExternalProfile} />}
      {messageMenu && <MessageActionsMenu state={messageMenu} canDelete={messageMenu.message.authorId === user.id || (currentAccess.manageMessages && (currentAccess.isOwner || messageMenu.message.authorId !== activeCommunity.owner_id))} canBan={canModerateVoiceMember(messageMenu.message.authorId)} onReply={() => { setReplyTarget(messageMenu.message); setMessageMenu(null); }} onMention={() => mentionMessageAuthor(messageMenu.message)} onReaction={(emoji) => { void toggleMessageReaction(messageMenu.message, emoji); setMessageMenu(null); }} onDelete={() => void deleteSelectedMessage(messageMenu.message)} onBan={() => void banMessageAuthor(messageMenu.message)} onClose={() => setMessageMenu(null)} />}
      {voiceMemberMenu && <VoiceMemberMenu state={voiceMemberMenu} onMute={() => void moderateVoiceParticipant(voiceMemberMenu.memberId, voiceMemberMenu.channelId, "mute")} onDisconnect={() => void moderateVoiceParticipant(voiceMemberMenu.memberId, voiceMemberMenu.channelId, "disconnect")} onClose={() => setVoiceMemberMenu(null)} />}
      {mentionNotice && <button className="mention-notice" onClick={() => { setActiveChannel(mentionNotice.channelId); setMentionNotice(null); }}><Bell size={15} /><span><strong>{mentionNotice.author} mencionou @todos</strong><small>Abrir #{mentionNotice.channelName}</small></span><X size={14} /></button>}
      {moderationNotice && <button className="mention-notice moderation-notice" onClick={() => setModerationNotice("")}><MicOff size={15} /><span><strong>{moderationNotice}</strong><small>Clique para fechar</small></span><X size={14} /></button>}
      {mediaSettingsOpen && <MediaSettingsModal audioInputs={audioInputs} selectedAudioInput={selectedAudioInput} onAudioInput={(deviceId) => void changeAudioInput(deviceId)} noiseSuppression={noiseSuppression} noiseSuppressionSupported={noiseSuppressionSupported} noiseSuppressionApplied={noiseSuppressionApplied} echoCancellation={echoCancellation} echoCancellationApplied={echoCancellationApplied} onProcessing={(setting, enabled) => void updateAudioProcessing(setting, enabled)} microphoneVolume={microphoneVolume} onMicrophoneVolume={(value) => void updateMicrophoneVolume(value)} micTestActive={micTestActive} micTestLevel={micTestLevel} onToggleMicTest={() => void toggleMicTest()} screenPreset={screenPreset} onScreenPreset={setScreenPreset} onClose={closeMediaSettings} />}
      <div className="persistent-audio-rack" aria-hidden="true">
        {Object.values(voicePeers).map((peer) => <RemoteAudio key={peer.id} stream={peer.stream} muted={deafened || locallyMutedUsers.has(peer.id)} />)}
      </div>
    </main>
  );
}
