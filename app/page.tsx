"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Copy, Eye, EyeOff, Gift, Hash, Headphones, Maximize2, Menu, MessageCircle, Mic, MicOff, Minimize2, MonitorUp, PhoneOff, Plus, Radio, Search, Send, Settings, Smile, Square, Users, Volume2, VolumeX, X } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { MessageRow } from "./lib/database.types";
import { getSupabaseBrowserClient } from "./lib/supabase";

type User = { id: string; name: string; color: string };
type Message = { id: string; channel: string; author: string; authorId: string; color: string; content: string; time: string };
type VoicePeer = { id: string; name: string; muted: boolean; speaking: boolean; stream?: MediaStream; screenStream?: MediaStream; screenSharing?: boolean };
type PresenceUser = User & {
  onlineAt: string;
  voiceChannel?: string | null;
  muted?: boolean;
};
type Signal = {
  type: "announce" | "offer" | "answer" | "ice" | "leave" | "voice-state" | "screen-state" | "screen-watch";
  from: string;
  to?: string;
  channel?: string;
  name?: string;
  color?: string;
  muted?: boolean;
  speaking?: boolean;
  screenSharing?: boolean;
  watching?: boolean;
  payload?: RTCSessionDescriptionInit | RTCIceCandidateInit;
};

const colors = ["#8b7cff", "#44d7b6", "#ffad66", "#ff7597", "#70a8ff"];
const channels = [
  { id: "geral", label: "Chat global", icon: "#", description: "Uma conversa aberta para todo mundo que estiver online" },
];
const voiceChannels = [
  { id: "voice-geral", label: "Voz global" },
];

const seedMessages: Message[] = [];

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

function messageFromRow(row: MessageRow): Message {
  return {
    id: row.id,
    channel: row.channel,
    author: row.username,
    authorId: row.session_id,
    color: row.color,
    content: row.content,
    time: new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(row.created_at)),
  };
}

function Avatar({ name, color, status = true, small = false }: { name: string; color: string; status?: boolean; small?: boolean }) {
  return (
    <span className={`avatar ${small ? "avatar-small" : ""}`} style={{ background: color }}>
      {initials(name)}
      {status && <span className="status-dot" />}
    </span>
  );
}

function RemoteAudio({ stream, muted }: { stream?: MediaStream; muted: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    audio.srcObject = stream ?? null;
    if (stream && !muted) void audio.play().catch(() => undefined);
  }, [stream, muted]);
  return <audio ref={ref} autoPlay playsInline muted={muted} />;
}

function ScreenVideo({ stream, muted = true }: { stream: MediaStream; muted?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
    return () => { video.srcObject = null; };
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} />;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [activeChannel, setActiveChannel] = useState("geral");
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
    queueMicrotask(() => {
      if (cancelled) return;
      const saved = sessionStorage.getItem("fynex:user") ?? sessionStorage.getItem("nexo:user");
      if (saved) {
        const parsed = JSON.parse(saved) as User;
        setUser(parsed);
        userRef.current = parsed;
      }
    });
    return () => { cancelled = true; };
  }, []);

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
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },
          frameRate: { ideal: 30, max: 30 },
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
  }, [post, stopScreenShare]);

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
    if (!user) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      queueMicrotask(() => setRealtimeError("Supabase não configurado neste ambiente."));
      return;
    }

    let disposed = false;
    const addMessage = (row: MessageRow) => {
      const incoming = messageFromRow(row);
      setMessages((old) => old.some((item) => item.id === incoming.id)
        ? old
        : [...old, incoming].slice(-150));
      const wasSentInThisTab = ownMessageIds.current.delete(row.id);
      if (!wasSentInThisTab && row.session_id !== user.id) playSound(receivedMessageSound.current);
    };

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
      .channel("fynex:global", {
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
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: "channel=eq.geral" },
        ({ new: row }) => addMessage(row as MessageRow),
      )
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

    void supabase
      .from("messages")
      .select("id, channel, session_id, username, color, content, created_at")
      .eq("channel", "geral")
      .order("created_at", { ascending: false })
      .limit(150)
      .then(({ data, error }) => {
        if (disposed) return;
        if (error) {
          setRealtimeError("Não foi possível carregar as mensagens.");
          return;
        }
        setMessages((data ?? []).reverse().map(messageFromRow));
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
  }, [user, closePeer, makePeer, playSound, post, renegotiatePeer]);

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

  const enter = (event: FormEvent) => {
    event.preventDefault();
    const clean = name.trim().slice(0, 24);
    if (!clean) return;
    const created: User = { id: crypto.randomUUID(), name: clean, color: colors[Math.floor(Math.random() * colors.length)] };
    sessionStorage.setItem("fynex:user", JSON.stringify(created));
    setUser(created);
  };

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
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
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
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
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

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim().slice(0, 2000);
    const supabase = getSupabaseBrowserClient();
    if (!content || !user || !supabase || sending) return;

    setSending(true);
    setRealtimeError("");
    const messageId = crypto.randomUUID();
    ownMessageIds.current.add(messageId);
    window.setTimeout(() => ownMessageIds.current.delete(messageId), 30000);
    const { data, error } = await supabase
      .from("messages")
      .insert({
        id: messageId,
        channel: activeChannel,
        session_id: user.id,
        username: user.name,
        color: user.color,
        content,
      })
      .select("id, channel, session_id, username, color, content, created_at")
      .single();

    setSending(false);
    if (error) {
      ownMessageIds.current.delete(messageId);
      setRealtimeError("A mensagem não foi enviada. Tente novamente.");
      return;
    }

    const sent = messageFromRow(data);
    setMessages((old) => old.some((item) => item.id === sent.id) ? old : [...old, sent].slice(-150));
    playSound(sentMessageSound.current);
    setDraft("");
  };

  const visibleMessages = useMemo(() => messages.filter((message) => message.channel === activeChannel), [messages, activeChannel]);
  const currentChannel = channels.find((channel) => channel.id === activeChannel)!;
  const voiceName = voiceChannels.find((channel) => channel.id === voiceChannel)?.label;
  const onlineMembers = user ? [user, ...Object.values(onlineUsers).filter((onlineUser) => onlineUser.id !== user.id)] : [];
  const globalVoiceMembers = Object.values(voiceMembers)
    .filter((member) => member.voiceChannel === "voice-geral")
    .filter((member) => member.id !== user?.id || voiceChannel === "voice-geral")
    .filter((member, index, all) => all.findIndex((candidate) => candidate.id === member.id) === index);
  if (user && voiceChannel === "voice-geral" && !globalVoiceMembers.some((member) => member.id === user.id)) {
    globalVoiceMembers.unshift({ ...user, onlineAt: new Date().toISOString(), voiceChannel, muted });
  }
  const remoteScreenPeer = Object.values(voicePeers).find((peer) => peer.screenSharing);
  const watchedScreenPeer = watchingScreenId ? voicePeers[watchingScreenId] : undefined;
  const activeScreenStream = screenSharing ? localScreenPreview : watchedScreenPeer?.screenStream;
  const screenPresenter = screenSharing ? user?.name : watchedScreenPeer?.name ?? remoteScreenPeer?.name;

  if (!user) {
    return (
      <main className="welcome-shell">
        <div className="welcome-glow glow-one" /><div className="welcome-glow glow-two" />
        <section className="welcome-card">
          <div className="brand-mark large">F</div>
          <span className="eyebrow">FYNEX · ACESSO ANTECIPADO</span>
          <h1>Encontre seu ritmo.<br /><span>Fique por perto.</span></h1>
          <p>Um lugar mais leve para conversar, criar e ouvir quem importa. Entre sem conta e comece agora.</p>
          <form onSubmit={enter} className="name-form">
            <label htmlFor="display-name">Como devemos chamar você?</label>
            <div className="name-row">
              <input id="display-name" autoFocus maxLength={24} value={name} onChange={(event) => setName(event.target.value)} placeholder="Digite seu nome" />
              <button type="submit" disabled={!name.trim()} aria-label="Entrar no FYNEX">→</button>
            </div>
          </form>
          <div className="session-note"><span>◷</span><div><strong>Sessão temporária</strong><small>Seu nome desaparece quando você fecha esta aba.</small></div></div>
        </section>
        <footer className="welcome-footer">FYNEX LAB · Seus dados ficam neste navegador</footer>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="server-rail" aria-label="Barra principal">
        <button className="server active" aria-label="FYNEX"><span>FYNEX</span><i /></button>
        <div className="global-badge"><Radio size={14} /><span>Espaço global</span></div>
        <div className="rail-spacer" />
        <div className="top-online"><Users size={15} /><strong>{onlineMembers.length}</strong><span>online</span></div>
        <Avatar name={user.name} color={user.color} small />
      </aside>

      <button className={`mobile-backdrop ${mobileNav ? "visible" : ""}`} onClick={() => setMobileNav(false)} aria-label="Fechar menu de canais" aria-hidden={!mobileNav} tabIndex={mobileNav ? 0 : -1} />

      <aside className={`channel-sidebar ${mobileNav ? "mobile-open" : ""}`}>
        <header className="community-header"><div><span className="community-dot">F</span><strong>FYNEX Global</strong></div><button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Fechar menu"><X size={17} /></button></header>
        <div className="invite-card"><Copy size={15} /><div><strong>Convide alguém</strong><small>Abra o link em outra aba</small></div><button onClick={() => navigator.clipboard?.writeText(location.href)}>Copiar</button></div>
        <nav className="channel-nav">
          <section>
            <div className="section-title"><span>CONVERSA</span></div>
            {channels.map((channel) => <button key={channel.id} className={`channel ${activeChannel === channel.id ? "selected" : ""}`} onClick={() => { setActiveChannel(channel.id); setMobileNav(false); }}><MessageCircle size={16} />{channel.label}<i>{onlineMembers.length}</i></button>)}
          </section>
          <section className="voice-section">
            <div className="section-title"><span>ÁUDIO EM TEMPO REAL</span></div>
            {voiceChannels.map((channel) => (
              <div key={channel.id}>
                <button className={`channel voice-channel ${voiceChannel === channel.id ? "selected" : ""}`} onClick={() => void joinVoice(channel.id)}><Radio size={16} />{channel.label}{voiceChannel === channel.id ? <b className="live-pill">CONECTADO</b> : globalVoiceMembers.length > 0 && <i>{globalVoiceMembers.length}</i>}</button>
                {globalVoiceMembers.length > 0 && <div className="voice-list">
                  {globalVoiceMembers.map((member) => {
                    const isCurrentUser = member.id === user.id;
                    const peer = voicePeers[member.id];
                    const memberSpeaking = isCurrentUser ? speaking : !!peer?.speaking;
                    const memberMuted = isCurrentUser ? muted : (peer?.muted ?? member.muted ?? false);
                    return <div className={`voice-user ${memberSpeaking ? "speaking" : ""}`} key={member.id}><Avatar name={member.name} color={member.color} small status={false} /><span>{member.name}{isCurrentUser ? " (você)" : ""}</span>{!isCurrentUser && <small className={peer?.stream ? "audio-ready" : ""}>{peer?.stream ? "áudio ativo" : "conectando"}</small>}{memberMuted && <MicOff size={12} />}{!isCurrentUser && <RemoteAudio stream={peer?.stream} muted={deafened} />}</div>;
                  })}
                </div>}
              </div>
            ))}
          </section>
        </nav>
        {(micError || realtimeError) && <div className="mic-error">{micError || realtimeError}</div>}
        {voiceChannel && audioInputs.length > 0 && <label className="device-picker"><Mic size={13} /><span>Entrada</span><select aria-label="Microfone de entrada" value={selectedAudioInput} onChange={(event) => void changeAudioInput(event.target.value)}>{audioInputs.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microfone ${index + 1}`}</option>)}</select></label>}
        {voiceChannel && <div className="voice-connection"><div><Radio className="signal-icon" size={17} /><strong>Voz conectada</strong><small>{voiceName} · WebRTC + Supabase</small></div><button onClick={leaveVoice} aria-label="Desconectar da voz"><PhoneOff size={15} /></button></div>}
        <div className="user-panel">
          <Avatar name={user.name} color={user.color} />
          <div className="user-copy"><strong>{user.name}</strong><small>{voiceChannel ? "Na sala de voz" : "Online"}</small></div>
          <button className={muted ? "control-on" : ""} onClick={toggleMute} aria-label={muted ? "Ativar microfone" : "Silenciar microfone"}>{muted ? <MicOff size={15} /> : <Mic size={15} />}</button>
          <button className={deafened ? "control-on" : ""} onClick={() => setDeafened(!deafened)} aria-label={deafened ? "Ativar áudio" : "Silenciar áudio"}>{deafened ? <VolumeX size={15} /> : <Volume2 size={15} />}</button>
          <button className={screenSharing ? "control-on screen-on" : ""} onClick={() => screenSharing ? void stopScreenShare() : void startScreenShare()} aria-label={screenSharing ? "Parar transmissão de tela" : "Compartilhar tela"}>{screenSharing ? <Square size={14} /> : <MonitorUp size={15} />}</button>
          <button aria-label="Configurações"><Settings size={15} /></button>
        </div>
      </aside>

      <section className="chat-panel">
        <header className="chat-header">
          <button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Abrir canais"><Menu size={18} /></button>
          <span className="hash"><Hash size={16} /></span><strong>{currentChannel.label}</strong><i />
          <p>{currentChannel.description}</p>
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
          <div className="channel-intro"><div><MessageCircle size={21} /></div><h2>Chat global</h2><p>Todo mundo conversa aqui em tempo real. Teste em outro navegador ou celular.</p></div>
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
          <input maxLength={2000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={realtimeConnected ? "Escreva no chat global" : "Conectando ao chat..."} />
          <button type="button" aria-label="Enviar presente"><Gift size={16} /></button><button type="button" aria-label="Emoji"><Smile size={17} /></button><button className="send-button" type="submit" disabled={sending || !draft.trim()} aria-label="Enviar mensagem" onMouseDown={(event) => event.preventDefault()}><Send size={15} /></button>
        </form>
      </section>

      <aside className="members-panel">
        <div className="prototype-tag"><Radio size={11} /> SALA GLOBAL</div>
        <div className="members-hero"><div className="orbit-ring"><Headphones size={25} /><i /><b /></div><strong>Voz global</strong><small>{voiceChannel ? `${voiceName} · conectado` : "Sala aberta para testes"}</small><button onClick={() => voiceChannel ? leaveVoice() : void joinVoice("voice-geral")}>{voiceChannel ? <><PhoneOff size={14} /> Sair da voz</> : <><Headphones size={14} /> Entrar na voz</>}</button></div>
        <h3><Users size={12} /> PESSOAS ONLINE — {onlineMembers.length}</h3>
        {onlineMembers.map((member, index) => <div className="member" key={member.id}><Avatar name={member.name} color={member.color} /><div><strong>{member.name}{index === 0 && <span>VOCÊ</span>}</strong><small>{index === 0 ? "Nesta aba" : "Online agora"}</small></div></div>)}
        {onlineMembers.length === 1 && <div className="alone-note"><Users size={18} /><strong>Só você por enquanto</strong><small>Abra o FYNEX em outra aba e escolha outro nome para testar.</small></div>}
      </aside>
    </main>
  );
}
