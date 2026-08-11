"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Crown, Eye, EyeOff, Hash, Headphones, Maximize2, Menu, MessageCircle, Mic, MicOff, Minimize2, MonitorUp, MoreHorizontal, Pencil, PhoneOff, Plus, Radio, Search, Settings, Square, UserPlus, Users, Volume2, VolumeX, X } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { CommunityMemberRole, CommunityRole, Message as MessageRow, Profile } from "@/lib/supabase/database.types";
import { deleteMessageAction, sendMessageAction } from "@/app/actions/messages";
import { uploadToImageKit, type ImageKitUploadToken } from "@/lib/media/imagekit-client";
import { createClient } from "@/lib/supabase/client";
import { CreateChannelModal } from "@/components/community/create-channel-modal";
import { CreateCommunityModal } from "@/components/community/create-community-modal";
import { ConnectionsModal, type ConnectionsTab } from "@/components/community/connections-modal";
import { CommunityMembersModal } from "@/components/community/community-members-modal";
import { CommunitySettingsModal } from "@/components/community/community-settings-modal";
import { MemberProfileModal, type MemberProfile } from "@/components/community/member-profile-modal";
import { MessageActionsMenu, type MessageMenuState } from "@/components/community/message-actions-menu";
import { MessageAttachment } from "@/components/community/message-attachment";
import { MessageComposer } from "@/components/community/message-composer";
import { MessageMentionText } from "@/components/community/message-mention-text";
import { MessageLinkPreview } from "@/components/community/message-link-preview";
import { MessageReplyPreview, ReplyComposerPreview } from "@/components/community/message-reply-preview";
import { MediaSettingsModal, type ScreenPreset } from "@/components/community/media-settings-modal";
import { Avatar, RemoteAudio, ScreenVideo } from "@/features/community/media";
import { messageFromRow, type CommunityChannel, type CommunityMessage as Message, type CommunitySpace, type CommunityUser as User, type PresenceUser, type VoicePeer, type VoiceSignal as Signal } from "@/features/community/model";
import { EMPTY_COMMUNITY_ACCESS, resolveCommunityAccess } from "@/features/community/permissions";
import { CHAT_IMAGE_LIMIT, CHAT_IMAGE_MIMES, CHAT_VIDEO_LIMIT, CHAT_VIDEO_MIMES, type ChatAttachmentDraft } from "@/lib/media/chat-attachments";
import { extractFirstLink } from "@/lib/links";

const seedMessages: Message[] = [];

export default function Home() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [communities, setCommunities] = useState<CommunitySpace[]>([]);
  const [communityChannels, setCommunityChannels] = useState<CommunityChannel[]>([]);
  const [activeCommunityId, setActiveCommunityId] = useState<string | null>(null);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [createCommunityOpen, setCreateCommunityOpen] = useState(false);
  const [channelModalType, setChannelModalType] = useState<"text" | "voice" | null>(null);
  const [editingChannel, setEditingChannel] = useState<CommunityChannel | null>(null);
  const [connectionsTab, setConnectionsTab] = useState<ConnectionsTab | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [communitySettingsOpen, setCommunitySettingsOpen] = useState(false);
  const [communityMembers, setCommunityMembers] = useState<MemberProfile[]>([]);
  const [communityRoles, setCommunityRoles] = useState<CommunityRole[]>([]);
  const [memberRoleAssignments, setMemberRoleAssignments] = useState<CommunityMemberRole[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<MemberProfile | null>(null);
  const [mediaSettingsOpen, setMediaSettingsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(seedMessages);
  const [draft, setDraft] = useState("");
  const [removedLinkPreviewUrl, setRemovedLinkPreviewUrl] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [replySnapshots, setReplySnapshots] = useState<Record<string, Message>>({});
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [messageMenu, setMessageMenu] = useState<MessageMenuState | null>(null);
  const [attachment, setAttachment] = useState<ChatAttachmentDraft | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [voiceChannel, setVoiceChannel] = useState<string | null>(null);
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
  const [noiseSuppressionSupported] = useState(() => typeof navigator === "undefined" || navigator.mediaDevices?.getSupportedConstraints().noiseSuppression === true);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [autoGainControl, setAutoGainControl] = useState(true);
  const [screenPreset, setScreenPreset] = useState<ScreenPreset>("standard");
  const [audioTrackVersion, setAudioTrackVersion] = useState(0);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [micError, setMicError] = useState("");
  const [realtimeError, setRealtimeError] = useState("");
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [mentionNotice, setMentionNotice] = useState<{ author: string; channelId: string; channelName: string } | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, { name: string; channelId: string }>>({});
  const [sending, setSending] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const voiceRef = useRef<string | null>(null);
  const watchingScreenRef = useRef<string | null>(null);
  const userRef = useRef<User | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const localScreenStream = useRef<MediaStream | null>(null);
  const screenWatchers = useRef<Set<string>>(new Set());
  const screenStage = useRef<HTMLElement>(null);
  const peers = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const realtime = useRef<RealtimeChannel | null>(null);
  const messagesContainer = useRef<HTMLDivElement>(null);
  const receivedMessageSound = useRef<HTMLAudioElement | null>(null);
  const sentMessageSound = useRef<HTMLAudioElement | null>(null);
  const ownMessageIds = useRef<Set<string>>(new Set());
  const highlightTimer = useRef<number | null>(null);
  const activeChannelRef = useRef<string | null>(null);
  const communityMembersRef = useRef<MemberProfile[]>([]);
  const typingSentAt = useRef(0);
  const typingStopTimer = useRef<number | null>(null);
  const remoteTypingTimers = useRef<Map<string, number>>(new Map());

  useEffect(() => { activeChannelRef.current = activeChannel; }, [activeChannel]);
  useEffect(() => () => {
    if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
    remoteTypingTimers.current.forEach((timer) => window.clearTimeout(timer));
    remoteTypingTimers.current.clear();
  }, []);

  const loadCommunityPeople = useCallback(async (communityId: string) => {
    const [membersResult, rolesResult, assignmentsResult] = await Promise.all([
      supabase.from("community_members").select("community_id, user_id, role, joined_at").eq("community_id", communityId),
      supabase.from("community_roles").select("*").eq("community_id", communityId).order("position", { ascending: false }),
      supabase.from("community_member_roles").select("*").eq("community_id", communityId),
    ]);
    const memberships = membersResult.data ?? [];
    const ids = memberships.map((membership) => membership.user_id);
    const profilesResult = ids.length
      ? await supabase.from("profiles").select("id, username, display_name, bio, avatar_url, banner_url, accent_color, created_at").in("id", ids)
      : { data: [] as MemberProfile[] };
    const membershipMap = new Map(memberships.map((membership) => [membership.user_id, membership]));
    const roles = rolesResult.data ?? [];
    const assignments = assignmentsResult.data ?? [];
    const nextMembers = (profilesResult.data ?? []).map((profile) => ({
      ...profile,
      joinedAt: membershipMap.get(profile.id)?.joined_at,
      isOwner: membershipMap.get(profile.id)?.role === "owner",
      roles: roles.filter((role) => assignments.some((assignment) => assignment.user_id === profile.id && assignment.role_id === role.id)),
    }));
    communityMembersRef.current = nextMembers;
    setCommunityRoles(roles);
    setMemberRoleAssignments(assignments);
    setCommunityMembers(nextMembers);
    setSelectedProfile((current) => current ? nextMembers.find((member) => member.id === current.id) ?? null : null);
  }, [supabase]);
  useEffect(() => () => {
    if (attachment) URL.revokeObjectURL(attachment.previewUrl);
  }, [attachment]);

  const playSound = useCallback((sound: HTMLAudioElement | null) => {
    if (!sound) return;
    sound.currentTime = 0;
    void sound.play().catch(() => undefined);
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
      ?? available.find((space) => space.id === activeCommunityId)
      ?? available[0];

    if (!selected) {
      setCommunityChannels([]);
      setActiveCommunityId(null);
      setActiveChannel(null);
      return;
    }

    const { data: loadedChannels, error: channelError } = await supabase.from("channels").select("*").eq("community_id", selected.id).order("position").order("created_at");
    if (channelError) {
      setRealtimeError("Não foi possível carregar os canais.");
      return;
    }

    const nextChannels = loadedChannels ?? [];
    setActiveCommunityId(selected.id);
    setCommunityChannels(nextChannels);
    setActiveChannel(nextChannels.find((channel) => channel.type === "text" && channel.id === preferredChannelId)?.id ?? nextChannels.find((channel) => channel.type === "text")?.id ?? null);
    await loadCommunityPeople(selected.id);
  }, [activeCommunityId, loadCommunityPeople, supabase]);

  useEffect(() => {
    const received = new Audio("/sounds/message-received.mp3");
    const sent = new Audio("/sounds/message-sent.mp3");
    received.preload = "auto";
    sent.preload = "auto";
    received.volume = 0.7;
    sent.volume = 0.65;
    receivedMessageSound.current = received;
    sentMessageSound.current = sent;
    return () => {
      received.pause();
      sent.pause();
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
      const { data: profile } = await supabase.from("profiles").select("id, display_name, accent_color, avatar_url").eq("id", authUser.id).single();
      if (cancelled) return;
      if (!profile) { await supabase.auth.signOut(); router.replace("/login?error=profile"); return; }
      const current = { id: profile.id, name: profile.display_name, color: profile.accent_color, avatarUrl: profile.avatar_url };
      userRef.current = current;
      setUser(current);
      await loadWorkspace();
      setAuthLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loadWorkspace, router, supabase]);

  useEffect(() => { voiceRef.current = voiceChannel; }, [voiceChannel]);
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
      void realtime.current?.send({
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
    setLocalScreenPreview(null);
    setStreamViewerOpen(false);
    stream.getTracks().forEach((track) => track.stop());
    if (voiceRef.current) post({ type: "screen-state", channel: voiceRef.current, screenSharing: false });
    if (renegotiate) await renegotiatePeers();
  }, [post, renegotiatePeers]);

  const startScreenShare = useCallback(async () => {
    if (!voiceRef.current || !realtime.current) {
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
      videoTrack.contentHint = "detail";
      localScreenStream.current = stream;
      setScreenSharing(true);
      setLocalScreenPreview(stream);
      setStreamViewerOpen(true);
      videoTrack.onended = () => { void stopScreenShare(); };
      post({ type: "screen-state", channel: voiceRef.current, screenSharing: true });
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
        const nextVoiceMembers: Record<string, PresenceUser> = {};
        const presences = Object.values(state).flat();
        presences.forEach((presence) => {
          if (!presence.id) return;
          if (presence.id !== realtimeUser.id) next[presence.id] = presence;
          if (presence.voiceChannel) nextVoiceMembers[presence.id] = presence;
        });
        setOnlineUsers(next);
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
              const pc = makePeer(presence.id, presence.name ?? "Visitante");
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              post({ type: "offer", to: presence.id, channel: currentVoiceChannel, name: realtimeUser.name, payload: offer });
            } catch (error) {
              console.error("Falha ao iniciar conexão WebRTC", error);
              closePeer(presence.id);
            }
          })();
        });
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
        if (mention.channelId !== activeChannelRef.current) playSound(receivedMessageSound.current);
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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_members", filter: `community_id=eq.${activeCommunityId}` }, refreshPeopleSoon)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "community_members", filter: `community_id=eq.${activeCommunityId}` }, refreshPeopleSoon)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "community_members" }, ({ old }) => {
        if (isActiveCommunityRow(old)) refreshPeopleSoon();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_roles", filter: `community_id=eq.${activeCommunityId}` }, refreshPeopleSoon)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "community_roles", filter: `community_id=eq.${activeCommunityId}` }, refreshPeopleSoon)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "community_roles" }, ({ old }) => {
        if (isActiveCommunityRow(old)) refreshPeopleSoon();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_member_roles", filter: `community_id=eq.${activeCommunityId}` }, refreshPeopleSoon)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "community_member_roles", filter: `community_id=eq.${activeCommunityId}` }, refreshPeopleSoon)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "community_member_roles" }, ({ old }) => {
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
          const nextUser = { id: profile.id, name: profile.display_name, color: profile.accent_color, avatarUrl: profile.avatar_url };
          userRef.current = nextUser;
          setUser(nextUser);
        }
      })
      .subscribe(async (status, error) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          realtime.current = channel;
          setRealtimeConnected(true);
          setRealtimeError("");
          await channel.track({ ...realtimeUser, onlineAt: new Date().toISOString(), voiceChannel: voiceRef.current, muted: false });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeConnected(false);
          setRealtimeError(error?.message ?? "Não foi possível conectar ao tempo real.");
        }
      });

    return () => {
      disposed = true;
      if (peopleRefreshTimer) window.clearTimeout(peopleRefreshTimer);
      if (channelsRefreshTimer) window.clearTimeout(channelsRefreshTimer);
      if (voiceRef.current) {
        void channel.send({
          type: "broadcast",
          event: "voice-signal",
          payload: { type: "leave", from: realtimeUser.id, channel: voiceRef.current } satisfies Signal,
        });
      }
      void channel.untrack();
      void supabase.removeChannel(channel);
      localScreenStream.current?.getTracks().forEach((track) => track.stop());
      localScreenStream.current = null;
      realtime.current = null;
      setRealtimeConnected(false);
      setOnlineUsers({});
      setVoiceMembers({});
    };
  }, [activeCommunityId, closePeer, loadCommunityPeople, makePeer, playSound, post, renegotiatePeer, supabase]);

  useEffect(() => {
    if (!user || !activeChannel) return;

    let disposed = false;
    const addMessage = async (row: MessageRow) => {
      const { data: author } = await supabase.from("profiles").select("display_name, accent_color, avatar_url").eq("id", row.author_id).single();
      if (!author || disposed) return;
      const incoming = messageFromRow(row, author);
      setMessages((old) => old.some((item) => item.id === incoming.id) ? old : [...old, incoming].slice(-150));
      const wasSentInThisTab = ownMessageIds.current.delete(row.id);
      if (!wasSentInThisTab && row.author_id !== user.id) playSound(receivedMessageSound.current);
    };

    const messageChannel = supabase
      .channel(`fynex:messages:${activeChannel}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${activeChannel}` }, ({ new: row }) => { void addMessage(row as MessageRow); })
      .subscribe();

    void supabase.from("messages")
      .select("id, channel_id, author_id, content, created_at, edited_at, reply_to_id, attachment_kind, attachment_url, attachment_file_id, attachment_path, attachment_mime, attachment_size, attachment_width, attachment_height, attachment_name, link_preview_url, link_preview_title, link_preview_description, link_preview_site_name, profiles!messages_author_id_fkey(display_name, accent_color, avatar_url)")
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
        const loadedIds = new Set(loaded.map((message) => message.id));
        const missingReplyIds = [...new Set(loaded.map((message) => message.replyToId).filter((id): id is string => Boolean(id) && !loadedIds.has(id!)))];
        if (missingReplyIds.length) {
          const { data: parents } = await supabase.from("messages")
            .select("id, channel_id, author_id, content, created_at, edited_at, reply_to_id, attachment_kind, attachment_url, attachment_file_id, attachment_path, attachment_mime, attachment_size, attachment_width, attachment_height, attachment_name, link_preview_url, link_preview_title, link_preview_description, link_preview_site_name, profiles!messages_author_id_fkey(display_name, accent_color, avatar_url)")
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
    };
  }, [activeChannel, playSound, supabase, user]);

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

  const joinVoice = async (channel: string) => {
    if (voiceChannel === channel) return;
    if (!realtime.current) {
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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(selectedAudioInput ? { deviceId: { exact: selectedAudioInput } } : {}),
          echoCancellation,
          noiseSuppression,
          autoGainControl,
        },
      });
      localStream.current = stream;
      const activeDeviceId = stream.getAudioTracks()[0]?.getSettings().deviceId;
      if (activeDeviceId) setSelectedAudioInput(activeDeviceId);
      await refreshAudioInputs();
      voiceRef.current = channel;
      setVoiceChannel(channel);
      setAudioTrackVersion((version) => version + 1);
      const current = userRef.current;
      if (current) {
        await realtime.current.track({ ...current, onlineAt: new Date().toISOString(), voiceChannel: channel, muted: false });
      }
    } catch {
      setMicError("Não foi possível acessar o microfone. Verifique a permissão do navegador.");
    }
  };

  const leaveVoice = () => {
    stopWatchingScreen();
    void stopScreenShare(false);
    if (voiceRef.current) post({ type: "leave", channel: voiceRef.current });
    const current = userRef.current;
    if (current) {
      void realtime.current?.track({ ...current, onlineAt: new Date().toISOString(), voiceChannel: null, muted: false });
    }
    peers.current.forEach((peer) => peer.close());
    peers.current.clear();
    pendingIceCandidates.current.clear();
    localStream.current?.getTracks().forEach((track) => track.stop());
    localStream.current = null;
    voiceRef.current = null;
    setVoiceChannel(null);
    setVoicePeers({});
    setMuted(false);
    setDeafened(false);
  };

  const toggleMute = () => {
    const next = !muted;
    localStream.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMuted(next);
    const current = userRef.current;
    if (current) {
      void realtime.current?.track({ ...current, onlineAt: new Date().toISOString(), voiceChannel: voiceRef.current, muted: next });
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
      const replacementStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: deviceId },
          echoCancellation,
          noiseSuppression,
          autoGainControl,
        },
      });
      const replacementTrack = replacementStream.getAudioTracks()[0];
      if (!replacementTrack) throw new Error("Microfone sem faixa de áudio");
      await Promise.all(
        [...peers.current.values()].map(async (peer) => {
          const sender = peer.getSenders().find((item) => item.track?.kind === "audio");
          if (sender) await sender.replaceTrack(replacementTrack);
        }),
      );
      localStream.current?.getTracks().forEach((track) => track.stop());
      replacementTrack.enabled = !muted;
      localStream.current = replacementStream;
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
    const track = localStream.current?.getAudioTracks()[0];
    if (!track) return;
    setMicError("");
    try {
      await track.applyConstraints({
        noiseSuppression: setting === "noiseSuppression" ? enabled : noiseSuppression,
        echoCancellation: setting === "echoCancellation" ? enabled : echoCancellation,
        autoGainControl: setting === "autoGainControl" ? enabled : autoGainControl,
      });
    } catch {
      setMicError("Seu navegador não conseguiu aplicar esse ajuste ao microfone.");
    }
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

  const activeCommunity = communities.find((community) => community.id === activeCommunityId);
  const textChannels = communityChannels.filter((channel) => channel.type === "text");
  const voiceChannels = communityChannels.filter((channel) => channel.type === "voice");
  const visibleMessages = useMemo(() => messages.filter((message) => message.channelId === activeChannel), [messages, activeChannel]);
  const draftLinkUrl = useMemo(() => extractFirstLink(draft), [draft]);
  const currentChannel = textChannels.find((channel) => channel.id === activeChannel) ?? textChannels[0];
  const voiceName = voiceChannels.find((channel) => channel.id === voiceChannel)?.name;
  const onlineMembers = user ? [user, ...Object.values(onlineUsers).filter((onlineUser) => onlineUser.id !== user.id)] : [];
  const onlineIds = new Set(onlineMembers.map((member) => member.id));
  const displayedCommunityMembers = communityMembers
    .map((member) => ({ ...member, online: onlineIds.has(member.id) }))
    .sort((a, b) => Number(b.online) - Number(a.online) || Number(b.isOwner) - Number(a.isOwner) || a.display_name.localeCompare(b.display_name));
  const currentAccess = activeCommunity && user
    ? resolveCommunityAccess(activeCommunity.owner_id, user.id, communityRoles, memberRoleAssignments)
    : EMPTY_COMMUNITY_ACCESS;
  const memberNameColors = new Map(displayedCommunityMembers.map((member) => {
    const highestRole = member.roles?.reduce<CommunityRole | null>((highest, role) => !highest || role.position > highest.position ? role : highest, null);
    return [member.id, member.isOwner ? activeCommunity?.accent_color ?? member.accent_color : highestRole?.color ?? member.accent_color];
  }));
  const memberNameColor = (memberId: string, fallback: string) => memberNameColors.get(memberId) ?? fallback;
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

  const handleCommunityCreated = async (communityId: string) => {
    setCreateCommunityOpen(false);
    if (voiceChannel) leaveVoice();
    await loadWorkspace(communityId);
  };

  const selectCommunity = async (communityId: string) => {
    if (communityId === activeCommunityId) return;
    if (voiceChannel) leaveVoice();
    await loadWorkspace(communityId);
  };

  const handleChannelCreated = async (channelId: string, type: "text" | "voice") => {
    setChannelModalType(null);
    setEditingChannel(null);
    await loadWorkspace(activeCommunityId ?? undefined, type === "text" ? channelId : activeChannel ?? undefined);
  };

  const openMemberProfile = (userId: string) => {
    const member = displayedCommunityMembers.find((item) => item.id === userId);
    if (member) setSelectedProfile(member);
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

  if (!user || !activeCommunity || !currentChannel) return <main className="auth-loading"><span className="brand-mark large">F</span><p>{authLoading ? "Preparando seu espaço…" : "Crie sua primeira comunidade para começar."}</p>{!authLoading && <button className="auth-submit compact" onClick={() => setCreateCommunityOpen(true)}><Plus size={16} />Criar comunidade</button>}{createCommunityOpen && <CreateCommunityModal open onClose={() => setCreateCommunityOpen(false)} onCreated={(id) => void handleCommunityCreated(id)} />}</main>;

  return (
    <main className="app-shell">
      <aside className="server-rail" aria-label="Barra principal">
        <button className="server brand-server" aria-label="Início do FYNEX"><span>FYNEX</span></button>
        <div className="rail-divider" />
        {communities.map((community) => <button key={community.id} className={`server community-server ${community.id === activeCommunityId ? "active" : ""}`} style={{ backgroundColor: community.id === activeCommunityId ? community.accent_color : undefined, backgroundImage: community.avatar_url ? `url(${community.avatar_url})` : undefined }} onClick={() => void selectCommunity(community.id)} aria-label={community.name} title={community.name}><span>{community.avatar_url ? "" : community.name.slice(0, 2).toUpperCase()}</span><i /></button>)}
        <button className="server add-server" onClick={() => setCreateCommunityOpen(true)} aria-label="Criar comunidade" title="Criar comunidade"><Plus size={18} /></button>
        <div className="community-badge"><Radio size={14} /><span>{activeCommunity.name}</span></div>
        <div className="rail-spacer" />
        <button className="top-online" onClick={() => setMembersOpen(true)} aria-label="Ver membros da comunidade" title="Ver membros"><Users size={15} /><strong>{onlineMembers.length}</strong><span>online</span></button>
        <button className="top-connections" onClick={() => setConnectionsTab("friends")} aria-label="Amigos e convites" title="Amigos e convites"><UserPlus size={16} /></button>
        <Link className="top-profile-button" href="/profile" aria-label="Abrir perfil" title="Abrir perfil"><Avatar name={user.name} color={user.color} imageUrl={user.avatarUrl} small /></Link>
      </aside>

      <button className={`mobile-backdrop ${mobileNav ? "visible" : ""}`} onClick={() => setMobileNav(false)} aria-label="Fechar menu de canais" aria-hidden={!mobileNav} tabIndex={mobileNav ? 0 : -1} />

      <aside className={`channel-sidebar ${mobileNav ? "mobile-open" : ""}`}>
        <header className={`community-header ${activeCommunity.banner_url ? "has-banner" : ""}`} style={activeCommunity.banner_url ? { backgroundImage: `linear-gradient(90deg, rgba(7,6,10,.9), rgba(7,6,10,.5)), url(${activeCommunity.banner_url})` } : undefined}><div><span className="community-dot" style={{ backgroundColor: activeCommunity.accent_color, backgroundImage: activeCommunity.avatar_url ? `url(${activeCommunity.avatar_url})` : undefined }}>{activeCommunity.avatar_url ? "" : activeCommunity.name.slice(0, 1).toUpperCase()}</span><strong>{activeCommunity.name}</strong></div><div className="community-header-actions">{currentAccess.isOwner && <button onClick={() => setCommunitySettingsOpen(true)} aria-label="Configurar comunidade" title="Configurar comunidade"><Settings size={15} /></button>}<button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Fechar menu"><X size={17} /></button></div></header>
        <div className="invite-card"><UserPlus size={15} /><div><strong>Convide alguém</strong><small>Amigos, convites e entrada</small></div><button onClick={() => setConnectionsTab("community")}>Gerenciar</button></div>
        <nav className="channel-nav">
          <section>
            <div className="section-title"><span>CANAIS DE TEXTO</span>{currentAccess.manageChannels && <button onClick={() => setChannelModalType("text")} aria-label="Criar canal de texto" title="Criar canal de texto"><Plus size={14} /></button>}</div>
            {textChannels.map((channel) => <div className="channel-row" key={channel.id}><button className={`channel ${activeChannel === channel.id ? "selected" : ""}`} onClick={() => { setActiveChannel(channel.id); setMobileNav(false); }}><MessageCircle size={16} />{channel.name}<i>{onlineMembers.length}</i></button>{currentAccess.manageChannels && <button className="channel-edit" onClick={() => setEditingChannel(channel)} aria-label={`Editar canal ${channel.name}`} title="Editar canal"><Pencil size={12} /></button>}</div>)}
          </section>
          <section className="voice-section">
            <div className="section-title"><span>CANAIS DE VOZ</span>{currentAccess.manageChannels && <button onClick={() => setChannelModalType("voice")} aria-label="Criar canal de voz" title="Criar canal de voz"><Plus size={14} /></button>}</div>
            {voiceChannels.map((channel) => {
              const channelMembers = getVoiceMembers(channel.id);
              return <div key={channel.id}>
                <div className="channel-row"><button className={`channel voice-channel ${voiceChannel === channel.id ? "selected" : ""}`} onClick={() => void joinVoice(channel.id)} disabled={voiceChannel !== channel.id && channelMembers.length >= (channel.user_limit ?? 10)}><Radio size={16} />{channel.name}<small className="voice-capacity">{channelMembers.length}/{channel.user_limit ?? 10}</small>{voiceChannel === channel.id && <b className="live-pill">CONECTADO</b>}</button>{currentAccess.manageChannels && <button className="channel-edit" onClick={() => setEditingChannel(channel)} aria-label={`Editar canal ${channel.name}`} title="Editar canal"><Pencil size={12} /></button>}</div>
                {channelMembers.length > 0 && <div className="voice-list">
                  {channelMembers.map((member) => {
                    const isCurrentUser = member.id === user.id;
                    const peer = voicePeers[member.id];
                    const memberSpeaking = isCurrentUser ? speaking : !!peer?.speaking;
                    const memberMuted = isCurrentUser ? muted : (peer?.muted ?? member.muted ?? false);
                    return <div className={`voice-user ${memberSpeaking ? "speaking" : ""}`} key={member.id}><Avatar name={member.name} color={member.color} imageUrl={member.avatarUrl} small status={false} /><span style={{ color: memberNameColor(member.id, member.color) }}>{member.name}{isCurrentUser ? " (você)" : ""}</span>{!isCurrentUser && <small className={peer?.stream ? "audio-ready" : ""}>{peer?.stream ? "áudio ativo" : "conectando"}</small>}{memberMuted && <MicOff size={12} />}{!isCurrentUser && <RemoteAudio stream={peer?.stream} muted={deafened} />}</div>;
                  })}
                </div>}
              </div>;
            })}
          </section>
        </nav>
        {(micError || realtimeError) && <div className="mic-error">{micError || realtimeError}</div>}
        {voiceChannel && <div className="voice-connection"><div><Radio className="signal-icon" size={17} /><strong>Voz conectada</strong><small>{voiceName} · WebRTC + Supabase</small></div><button onClick={leaveVoice} aria-label="Desconectar da voz"><PhoneOff size={15} /></button></div>}
        <div className="user-panel">
          <Link className="avatar-profile-button" href="/profile" aria-label="Abrir perfil" title="Abrir perfil"><Avatar name={user.name} color={user.color} imageUrl={user.avatarUrl} /></Link>
          <div className="user-copy"><strong style={{ color: memberNameColor(user.id, user.color) }}>{user.name}</strong><small>{voiceChannel ? "Na sala de voz" : "Online"}</small></div>
          <button className={muted ? "control-on" : ""} onClick={toggleMute} aria-label={muted ? "Ativar microfone" : "Silenciar microfone"}>{muted ? <MicOff size={15} /> : <Mic size={15} />}</button>
          <button className={deafened ? "control-on" : ""} onClick={() => setDeafened(!deafened)} aria-label={deafened ? "Ativar áudio" : "Silenciar áudio"}>{deafened ? <VolumeX size={15} /> : <Volume2 size={15} />}</button>
          <button className={screenSharing ? "control-on screen-on" : ""} onClick={() => screenSharing ? void stopScreenShare() : void startScreenShare()} aria-label={screenSharing ? "Parar transmissão de tela" : "Compartilhar tela"}>{screenSharing ? <Square size={14} /> : <MonitorUp size={15} />}</button>
          <button aria-label="Configurações de áudio e transmissão" title="Áudio e transmissão" onClick={() => setMediaSettingsOpen(true)}><Settings size={15} /></button>
        </div>
      </aside>

      <section className="chat-panel">
        <header className="chat-header">
          <button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Abrir canais"><Menu size={18} /></button>
          <span className="hash"><Hash size={16} /></span><strong>{currentChannel.name}</strong><i />
          <p>{activeCommunity.description || `Conversas em ${activeCommunity.name}`}</p>
          <div className="header-actions"><div className="header-online"><span />{onlineMembers.length} online</div><button aria-label="Notificações"><Bell size={16} /></button><label><Search size={14} /><input placeholder="Buscar no chat" /></label></div>
        </header>

        {(screenSharing || remoteScreenPeer) && !streamViewerOpen && <section className="screen-invite">
          <div className="screen-invite-preview"><MonitorUp size={25} /></div>
          <div><span>TRANSMISSÃO AO VIVO</span><strong>{screenSharing ? "Sua tela está sendo transmitida" : `${remoteScreenPeer?.name} está compartilhando a tela`}</strong><small>720p · 30 FPS · conexão ativada somente para espectadores</small></div>
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
            <div><b>720P · 30 FPS</b><button onClick={() => setStreamViewerOpen(false)} aria-label="Minimizar transmissão"><Minimize2 size={15} /></button><button onClick={() => screenSharing ? void stopScreenShare() : stopWatchingScreen()} aria-label={screenSharing ? "Encerrar transmissão" : "Sair da transmissão"}><X size={16} /></button></div>
          </header>
          <div className="screen-player">
            {activeScreenStream ? <ScreenVideo stream={activeScreenStream} /> : <div className="screen-loading"><span /><strong>Conectando à transmissão</strong><small>O vídeo começa assim que a conexão direta estiver pronta.</small></div>}
          </div>
          <footer className="screen-controls">
            <div><span className="live-dot" /> AO VIVO</div>
            <div>
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
            const previous = visibleMessages[index - 1];
            const grouped = previous?.authorId === message.authorId;
            const repliedMessage = message.replyToId ? visibleMessages.find((item) => item.id === message.replyToId) ?? replySnapshots[message.replyToId] : undefined;
            return <article id={`message-${message.id}`} className={`message ${grouped ? "grouped" : ""} ${highlightedMessageId === message.id ? "message-highlighted" : ""}`} key={message.id} onContextMenu={(event) => { event.preventDefault(); setMessageMenu({ message, x: event.clientX, y: event.clientY }); }}>
              {!grouped && <button className="message-profile-trigger avatar-trigger" onClick={() => openMemberProfile(message.authorId)} aria-label={`Ver perfil de ${message.author}`}><Avatar name={message.author} color={message.color} imageUrl={message.avatarUrl} status={false} /></button>}
              <div>{message.replyToId && <MessageReplyPreview message={repliedMessage} missing={!repliedMessage} onJump={() => void jumpToMessage(message.replyToId!)} />}{!grouped && <header><button className="message-profile-trigger" style={{ color: memberNameColor(message.authorId, message.color) }} onClick={() => openMemberProfile(message.authorId)}>{message.author}</button><time>{message.time}</time></header>}
                {message.content && <p><MessageMentionText content={message.content} members={displayedCommunityMembers} onProfile={setSelectedProfile} /></p>}
                {message.linkPreview ? <MessageLinkPreview preview={message.linkPreview} /> : null}
                {message.attachment ? <MessageAttachment attachment={message.attachment} /> : null}
              </div>
              <button className="message-more" onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setMessageMenu({ message, x: rect.right - 198, y: rect.bottom + 4 }); }} aria-label="Ações da mensagem"><MoreHorizontal size={16} /></button>
            </article>;
          })}
        </div>
        {activeTypingNames.length > 0 && <div className="typing-indicator"><i><span /><span /><span /></i><strong>{activeTypingNames.length === 1 ? activeTypingNames[0] : activeTypingNames.length === 2 ? `${activeTypingNames[0]} e ${activeTypingNames[1]}` : `${activeTypingNames[0]}, ${activeTypingNames[1]} e mais ${activeTypingNames.length - 2}`}</strong><small>{activeTypingNames.length === 1 ? "está digitando…" : "estão digitando…"}</small></div>}
        {replyTarget && <ReplyComposerPreview message={replyTarget} onClose={() => setReplyTarget(null)} />}
        <MessageComposer attachment={attachment} channelName={currentChannel.name} draft={draft} realtimeConnected={realtimeConnected} sending={sending} uploadProgress={uploadProgress} members={mentionMembers} canMentionEveryone={currentAccess.isAdmin} onAttachment={chooseAttachment} onDraft={handleDraftChange} onRemoveAttachment={() => setAttachment(null)} linkUrl={draftLinkUrl} linkPreviewRemoved={Boolean(draftLinkUrl && removedLinkPreviewUrl === draftLinkUrl)} onRemoveLinkPreview={() => setRemovedLinkPreviewUrl(draftLinkUrl)} onRestoreLinkPreview={() => setRemovedLinkPreviewUrl(null)} onSubmit={sendMessage} />
      </section>

      <aside className="members-panel">
        <div className="prototype-tag"><Radio size={11} /> {activeCommunity.name.toUpperCase()}</div>
        <div className="members-hero"><div className="orbit-ring"><Headphones size={25} /><i /><b /></div><strong>{voiceChannel ? voiceName : "Canal de voz"}</strong><small>{voiceChannel ? `${currentVoiceMembers.length} na conversa` : "Entre para conversar em tempo real"}</small><button onClick={() => voiceChannel ? leaveVoice() : voiceChannels[0] && void joinVoice(voiceChannels[0].id)} disabled={!voiceChannels.length}>{voiceChannel ? <><PhoneOff size={14} /> Sair da voz</> : <><Headphones size={14} /> Entrar na voz</>}</button></div>
        <div className="members-heading"><h3><Users size={12} /> MEMBROS — {displayedCommunityMembers.length}</h3><button onClick={() => setMembersOpen(true)}>Ver todos</button></div>
        {displayedCommunityMembers.map((member) => <button className="member member-button" key={member.id} onClick={() => setSelectedProfile(member)}><div className="member-presence-avatar"><Avatar name={member.display_name} color={member.accent_color} imageUrl={member.avatar_url} /><i className={member.online ? "online" : "offline"} /></div><div><strong style={{ color: memberNameColor(member.id, member.accent_color) }}>{member.display_name}{member.id === user.id && <span>VOCÊ</span>}{member.isOwner && <Crown size={11} />}</strong><small>{member.online ? "Online agora" : "Offline"}</small></div></button>)}
      </aside>
      {createCommunityOpen && <CreateCommunityModal open onClose={() => setCreateCommunityOpen(false)} onCreated={(id) => void handleCommunityCreated(id)} />}
      {channelModalType && <CreateChannelModal communityId={activeCommunity.id} communityName={activeCommunity.name} initialType={channelModalType} onClose={() => setChannelModalType(null)} onCreated={(id, type) => void handleChannelCreated(id, type)} />}
      {editingChannel && <CreateChannelModal communityId={activeCommunity.id} communityName={activeCommunity.name} initialType={editingChannel.type as "text" | "voice"} channel={editingChannel} onClose={() => setEditingChannel(null)} onCreated={(id, type) => void handleChannelCreated(id, type)} />}
      {connectionsTab && <ConnectionsModal community={activeCommunity} currentUserId={user.id} initialTab={connectionsTab} onClose={() => setConnectionsTab(null)} onMembershipChanged={() => void loadWorkspace()} onCommunityChanged={() => void loadWorkspace(activeCommunity.id, activeChannel ?? undefined)} onViewProfile={(profile) => setSelectedProfile(displayedCommunityMembers.find((member) => member.id === profile.id) ?? profile)} />}
      {membersOpen && <CommunityMembersModal communityId={activeCommunity.id} communityName={activeCommunity.name} currentUserId={user.id} members={displayedCommunityMembers} roles={communityRoles} assignments={memberRoleAssignments} access={currentAccess} onViewProfile={setSelectedProfile} onClose={() => setMembersOpen(false)} onChanged={() => void loadCommunityPeople(activeCommunity.id)} />}
      {communitySettingsOpen && <CommunitySettingsModal community={activeCommunity} onClose={() => setCommunitySettingsOpen(false)} onChanged={() => void loadWorkspace(activeCommunity.id, activeChannel ?? undefined)} />}
      {selectedProfile && <MemberProfileModal profile={selectedProfile} onClose={() => setSelectedProfile(null)} />}
      {messageMenu && <MessageActionsMenu state={messageMenu} canDelete={messageMenu.message.authorId === user.id || (currentAccess.manageMessages && (currentAccess.isOwner || messageMenu.message.authorId !== activeCommunity.owner_id))} onReply={() => { setReplyTarget(messageMenu.message); setMessageMenu(null); }} onMention={() => mentionMessageAuthor(messageMenu.message)} onDelete={() => void deleteSelectedMessage(messageMenu.message)} onClose={() => setMessageMenu(null)} />}
      {mentionNotice && <button className="mention-notice" onClick={() => { setActiveChannel(mentionNotice.channelId); setMentionNotice(null); }}><Bell size={15} /><span><strong>{mentionNotice.author} mencionou @todos</strong><small>Abrir #{mentionNotice.channelName}</small></span><X size={14} /></button>}
      {mediaSettingsOpen && <MediaSettingsModal audioInputs={audioInputs} selectedAudioInput={selectedAudioInput} onAudioInput={(deviceId) => void changeAudioInput(deviceId)} noiseSuppression={noiseSuppression} noiseSuppressionSupported={noiseSuppressionSupported} echoCancellation={echoCancellation} autoGainControl={autoGainControl} onProcessing={(setting, enabled) => void updateAudioProcessing(setting, enabled)} screenPreset={screenPreset} onScreenPreset={setScreenPreset} onClose={() => setMediaSettingsOpen(false)} />}
    </main>
  );
}
