"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Eye, EyeOff, Gift, Hash, Headphones, Maximize2, Menu, MessageCircle, Mic, MicOff, Minimize2, MonitorUp, PhoneOff, Plus, Radio, Search, Send, Settings, Smile, Square, UserPlus, Users, Volume2, VolumeX, X } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Message as MessageRow } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";
import { CreateChannelModal } from "@/components/community/create-channel-modal";
import { CreateCommunityModal } from "@/components/community/create-community-modal";
import { ConnectionsModal, type ConnectionsTab } from "@/components/community/connections-modal";
import { MediaSettingsModal, type ScreenPreset } from "@/components/community/media-settings-modal";
import { Avatar, RemoteAudio, ScreenVideo } from "@/features/community/media";
import { messageFromRow, type CommunityChannel, type CommunityMessage as Message, type CommunitySpace, type CommunityUser as User, type PresenceUser, type VoicePeer, type VoiceSignal as Signal } from "@/features/community/model";

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
  const [connectionsTab, setConnectionsTab] = useState<ConnectionsTab | null>(null);
  const [mediaSettingsOpen, setMediaSettingsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(seedMessages);
  const [draft, setDraft] = useState("");
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
  const [noiseSuppression, setNoiseSuppression] = useState(true);
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
  }, [activeCommunityId, supabase]);

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
      const { data: profile } = await supabase.from("profiles").select("id, display_name, accent_color").eq("id", authUser.id).single();
      if (cancelled) return;
      if (!profile) { await supabase.auth.signOut(); router.replace("/login?error=profile"); return; }
      const current = { id: profile.id, name: profile.display_name, color: profile.accent_color };
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
    if (!user || !activeCommunityId) return;
    // The authenticated browser client is created once for this page.
    if (!supabase) {
      queueMicrotask(() => setRealtimeError("Supabase não configurado neste ambiente."));
      return;
    }

    let disposed = false;
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
          presence: { key: user.id },
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
          if (presence.id !== user.id) next[presence.id] = presence;
          if (presence.voiceChannel) nextVoiceMembers[presence.id] = presence;
        });
        setOnlineUsers(next);
        setVoiceMembers(nextVoiceMembers);

        const currentVoiceChannel = voiceRef.current;
        if (!currentVoiceChannel) return;

        const connectedIds = new Set(
          presences
            .filter((presence) => presence.id !== user.id && presence.voiceChannel === currentVoiceChannel)
            .map((presence) => presence.id),
        );

        peers.current.forEach((_, id) => {
          if (!connectedIds.has(id)) closePeer(id);
        });

        presences.forEach((presence) => {
          if (
            presence.id === user.id
            || presence.voiceChannel !== currentVoiceChannel
            || peers.current.has(presence.id)
            || user.id > presence.id
          ) return;

          void (async () => {
            try {
              const pc = makePeer(presence.id, presence.name ?? "Visitante");
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              post({ type: "offer", to: presence.id, channel: currentVoiceChannel, name: user.name, payload: offer });
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
      .subscribe(async (status, error) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          realtime.current = channel;
          setRealtimeConnected(true);
          setRealtimeError("");
          await channel.track({ ...user, onlineAt: new Date().toISOString(), voiceChannel: voiceRef.current, muted: false });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeConnected(false);
          setRealtimeError(error?.message ?? "Não foi possível conectar ao tempo real.");
        }
      });

    return () => {
      disposed = true;
      if (voiceRef.current) {
        void channel.send({
          type: "broadcast",
          event: "voice-signal",
          payload: { type: "leave", from: user.id, channel: voiceRef.current } satisfies Signal,
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
  }, [activeCommunityId, user, closePeer, makePeer, post, renegotiatePeer, supabase]);

  useEffect(() => {
    if (!user || !activeChannel) return;

    let disposed = false;
    const addMessage = async (row: MessageRow) => {
      const { data: author } = await supabase.from("profiles").select("display_name, accent_color").eq("id", row.author_id).single();
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
      .select("id, channel_id, author_id, content, created_at, edited_at, profiles!messages_author_id_fkey(display_name, accent_color)")
      .eq("channel_id", activeChannel)
      .order("created_at", { ascending: false })
      .limit(150)
      .then(({ data, error }) => {
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
    if (setting === "noiseSuppression") setNoiseSuppression(enabled);
    if (setting === "echoCancellation") setEchoCancellation(enabled);
    if (setting === "autoGainControl") setAutoGainControl(enabled);
    const track = localStream.current?.getAudioTracks()[0];
    if (!track) return;
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

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim().slice(0, 2000);
    if (!content || !user || !activeChannel || sending) return;

    setSending(true);
    setRealtimeError("");
    const messageId = crypto.randomUUID();
    ownMessageIds.current.add(messageId);
    window.setTimeout(() => ownMessageIds.current.delete(messageId), 30000);
    const { data, error } = await supabase
      .from("messages")
      .insert({
        id: messageId,
        channel_id: activeChannel,
        author_id: user.id,
        content,
      })
      .select("id, channel_id, author_id, content, created_at, edited_at")
      .single();

    setSending(false);
    if (error) {
      ownMessageIds.current.delete(messageId);
      setRealtimeError("A mensagem não foi enviada. Tente novamente.");
      return;
    }

    const sent = messageFromRow(data, { display_name: user.name, accent_color: user.color });
    setMessages((old) => old.some((item) => item.id === sent.id) ? old : [...old, sent].slice(-150));
    playSound(sentMessageSound.current);
    setDraft("");
  };

  const activeCommunity = communities.find((community) => community.id === activeCommunityId);
  const textChannels = communityChannels.filter((channel) => channel.type === "text");
  const voiceChannels = communityChannels.filter((channel) => channel.type === "voice");
  const visibleMessages = useMemo(() => messages.filter((message) => message.channelId === activeChannel), [messages, activeChannel]);
  const currentChannel = textChannels.find((channel) => channel.id === activeChannel) ?? textChannels[0];
  const voiceName = voiceChannels.find((channel) => channel.id === voiceChannel)?.name;
  const onlineMembers = user ? [user, ...Object.values(onlineUsers).filter((onlineUser) => onlineUser.id !== user.id)] : [];
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
    await loadWorkspace(activeCommunityId ?? undefined, type === "text" ? channelId : activeChannel ?? undefined);
  };

  if (!user || !activeCommunity || !currentChannel) return <main className="auth-loading"><span className="brand-mark large">F</span><p>{authLoading ? "Preparando seu espaço…" : "Crie sua primeira comunidade para começar."}</p>{!authLoading && <button className="auth-submit compact" onClick={() => setCreateCommunityOpen(true)}><Plus size={16} />Criar comunidade</button>}{createCommunityOpen && <CreateCommunityModal open onClose={() => setCreateCommunityOpen(false)} onCreated={(id) => void handleCommunityCreated(id)} />}</main>;

  return (
    <main className="app-shell">
      <aside className="server-rail" aria-label="Barra principal">
        <button className="server brand-server" aria-label="Início do FYNEX"><span>FYNEX</span></button>
        <div className="rail-divider" />
        {communities.map((community) => <button key={community.id} className={`server community-server ${community.id === activeCommunityId ? "active" : ""}`} style={{ background: community.id === activeCommunityId ? community.accent_color : undefined }} onClick={() => void selectCommunity(community.id)} aria-label={community.name} title={community.name}><span>{community.name.slice(0, 2).toUpperCase()}</span><i /></button>)}
        <button className="server add-server" onClick={() => setCreateCommunityOpen(true)} aria-label="Criar comunidade" title="Criar comunidade"><Plus size={18} /></button>
        <div className="community-badge"><Radio size={14} /><span>{activeCommunity.name}</span></div>
        <div className="rail-spacer" />
        <div className="top-online"><Users size={15} /><strong>{onlineMembers.length}</strong><span>online</span></div>
        <button className="top-connections" onClick={() => setConnectionsTab("friends")} aria-label="Amigos e convites" title="Amigos e convites"><UserPlus size={16} /></button>
        <Link className="top-profile-button" href="/profile" aria-label="Abrir perfil" title="Abrir perfil"><Avatar name={user.name} color={user.color} small /></Link>
      </aside>

      <button className={`mobile-backdrop ${mobileNav ? "visible" : ""}`} onClick={() => setMobileNav(false)} aria-label="Fechar menu de canais" aria-hidden={!mobileNav} tabIndex={mobileNav ? 0 : -1} />

      <aside className={`channel-sidebar ${mobileNav ? "mobile-open" : ""}`}>
        <header className="community-header"><div><span className="community-dot" style={{ background: activeCommunity.accent_color }}>{activeCommunity.name.slice(0, 1).toUpperCase()}</span><strong>{activeCommunity.name}</strong></div><button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Fechar menu"><X size={17} /></button></header>
        <div className="invite-card"><UserPlus size={15} /><div><strong>Convide alguém</strong><small>Amigos, convites e entrada</small></div><button onClick={() => setConnectionsTab("community")}>Gerenciar</button></div>
        <nav className="channel-nav">
          <section>
            <div className="section-title"><span>CANAIS DE TEXTO</span><button onClick={() => setChannelModalType("text")} aria-label="Criar canal de texto" title="Criar canal de texto"><Plus size={14} /></button></div>
            {textChannels.map((channel) => <button key={channel.id} className={`channel ${activeChannel === channel.id ? "selected" : ""}`} onClick={() => { setActiveChannel(channel.id); setMobileNav(false); }}><MessageCircle size={16} />{channel.name}<i>{onlineMembers.length}</i></button>)}
          </section>
          <section className="voice-section">
            <div className="section-title"><span>CANAIS DE VOZ</span><button onClick={() => setChannelModalType("voice")} aria-label="Criar canal de voz" title="Criar canal de voz"><Plus size={14} /></button></div>
            {voiceChannels.map((channel) => {
              const channelMembers = getVoiceMembers(channel.id);
              return <div key={channel.id}>
                <button className={`channel voice-channel ${voiceChannel === channel.id ? "selected" : ""}`} onClick={() => void joinVoice(channel.id)}><Radio size={16} />{channel.name}{voiceChannel === channel.id ? <b className="live-pill">CONECTADO</b> : channelMembers.length > 0 && <i>{channelMembers.length}</i>}</button>
                {channelMembers.length > 0 && <div className="voice-list">
                  {channelMembers.map((member) => {
                    const isCurrentUser = member.id === user.id;
                    const peer = voicePeers[member.id];
                    const memberSpeaking = isCurrentUser ? speaking : !!peer?.speaking;
                    const memberMuted = isCurrentUser ? muted : (peer?.muted ?? member.muted ?? false);
                    return <div className={`voice-user ${memberSpeaking ? "speaking" : ""}`} key={member.id}><Avatar name={member.name} color={member.color} small status={false} /><span>{member.name}{isCurrentUser ? " (você)" : ""}</span>{!isCurrentUser && <small className={peer?.stream ? "audio-ready" : ""}>{peer?.stream ? "áudio ativo" : "conectando"}</small>}{memberMuted && <MicOff size={12} />}{!isCurrentUser && <RemoteAudio stream={peer?.stream} muted={deafened} />}</div>;
                  })}
                </div>}
              </div>;
            })}
          </section>
        </nav>
        {(micError || realtimeError) && <div className="mic-error">{micError || realtimeError}</div>}
        {voiceChannel && <div className="voice-connection"><div><Radio className="signal-icon" size={17} /><strong>Voz conectada</strong><small>{voiceName} · WebRTC + Supabase</small></div><button onClick={leaveVoice} aria-label="Desconectar da voz"><PhoneOff size={15} /></button></div>}
        <div className="user-panel">
          <Link className="avatar-profile-button" href="/profile" aria-label="Abrir perfil" title="Abrir perfil"><Avatar name={user.name} color={user.color} /></Link>
          <div className="user-copy"><strong>{user.name}</strong><small>{voiceChannel ? "Na sala de voz" : "Online"}</small></div>
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
            return <article className={`message ${grouped ? "grouped" : ""}`} key={message.id}>
              {!grouped && <Avatar name={message.author} color={message.color} status={false} />}
              <div>{!grouped && <header><strong style={{ color: message.color }}>{message.author}</strong><time>{message.time}</time></header>}<p>{message.content}</p></div>
            </article>;
          })}
        </div>
        <form className="message-box" onSubmit={sendMessage}>
          <button type="button" aria-label="Adicionar anexo"><Plus size={17} /></button>
          <input maxLength={2000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={realtimeConnected ? `Mensagem em #${currentChannel.name}` : "Conectando ao chat..."} />
          <button type="button" aria-label="Enviar presente"><Gift size={16} /></button><button type="button" aria-label="Emoji"><Smile size={17} /></button><button className="send-button" type="submit" disabled={sending || !draft.trim()} aria-label="Enviar mensagem" onMouseDown={(event) => event.preventDefault()}><Send size={15} /></button>
        </form>
      </section>

      <aside className="members-panel">
        <div className="prototype-tag"><Radio size={11} /> {activeCommunity.name.toUpperCase()}</div>
        <div className="members-hero"><div className="orbit-ring"><Headphones size={25} /><i /><b /></div><strong>{voiceChannel ? voiceName : "Canal de voz"}</strong><small>{voiceChannel ? `${currentVoiceMembers.length} na conversa` : "Entre para conversar em tempo real"}</small><button onClick={() => voiceChannel ? leaveVoice() : voiceChannels[0] && void joinVoice(voiceChannels[0].id)} disabled={!voiceChannels.length}>{voiceChannel ? <><PhoneOff size={14} /> Sair da voz</> : <><Headphones size={14} /> Entrar na voz</>}</button></div>
        <h3><Users size={12} /> PESSOAS ONLINE — {onlineMembers.length}</h3>
        {onlineMembers.map((member, index) => <div className="member" key={member.id}><Avatar name={member.name} color={member.color} /><div><strong>{member.name}{index === 0 && <span>VOCÊ</span>}</strong><small>{index === 0 ? "Nesta aba" : "Online agora"}</small></div></div>)}
        {onlineMembers.length === 1 && <div className="alone-note"><Users size={18} /><strong>Só você por enquanto</strong><small>Abra o FYNEX em outra aba e escolha outro nome para testar.</small></div>}
      </aside>
      {createCommunityOpen && <CreateCommunityModal open onClose={() => setCreateCommunityOpen(false)} onCreated={(id) => void handleCommunityCreated(id)} />}
      {channelModalType && <CreateChannelModal communityId={activeCommunity.id} communityName={activeCommunity.name} initialType={channelModalType} onClose={() => setChannelModalType(null)} onCreated={(id, type) => void handleChannelCreated(id, type)} />}
      {connectionsTab && <ConnectionsModal community={activeCommunity} currentUserId={user.id} initialTab={connectionsTab} onClose={() => setConnectionsTab(null)} onMembershipChanged={() => void loadWorkspace()} onCommunityChanged={() => void loadWorkspace(activeCommunity.id, activeChannel ?? undefined)} />}
      {mediaSettingsOpen && <MediaSettingsModal audioInputs={audioInputs} selectedAudioInput={selectedAudioInput} onAudioInput={(deviceId) => void changeAudioInput(deviceId)} noiseSuppression={noiseSuppression} echoCancellation={echoCancellation} autoGainControl={autoGainControl} onProcessing={(setting, enabled) => void updateAudioProcessing(setting, enabled)} screenPreset={screenPreset} onScreenPreset={setScreenPreset} onClose={() => setMediaSettingsOpen(false)} />}
    </main>
  );
}
