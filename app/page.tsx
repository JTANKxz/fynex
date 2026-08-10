"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Copy, Gift, Hash, Headphones, Menu, MessageCircle, Mic, MicOff, PhoneOff, Plus, Radio, Search, Send, Settings, Smile, Users, Volume2, VolumeX } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { MessageRow } from "./lib/database.types";
import { getSupabaseBrowserClient } from "./lib/supabase";

type User = { id: string; name: string; color: string };
type Message = { id: string; channel: string; author: string; authorId: string; color: string; content: string; time: string };
type VoicePeer = { id: string; name: string; muted: boolean; speaking: boolean; stream?: MediaStream };
type PresenceUser = User & { onlineAt: string };
type Signal = {
  type: "announce" | "offer" | "answer" | "ice" | "leave" | "voice-state";
  from: string;
  to?: string;
  channel?: string;
  name?: string;
  color?: string;
  muted?: boolean;
  speaking?: boolean;
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
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);
  return <audio ref={ref} autoPlay playsInline muted={muted} />;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [activeChannel, setActiveChannel] = useState("geral");
  const [messages, setMessages] = useState<Message[]>(seedMessages);
  const [draft, setDraft] = useState("");
  const [voiceChannel, setVoiceChannel] = useState<string | null>(null);
  const [voicePeers, setVoicePeers] = useState<Record<string, VoicePeer>>({});
  const [onlineUsers, setOnlineUsers] = useState<Record<string, PresenceUser>>({});
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [micError, setMicError] = useState("");
  const [realtimeError, setRealtimeError] = useState("");
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const voiceRef = useRef<string | null>(null);
  const userRef = useRef<User | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const peers = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const realtime = useRef<RealtimeChannel | null>(null);
  const messagesContainer = useRef<HTMLDivElement>(null);

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
  useEffect(() => { userRef.current = user; }, [user]);
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
      if (event.candidate) post({ type: "ice", to: id, payload: event.candidate.toJSON() });
    };
    pc.ontrack = (event) => {
      setVoicePeers((old) => ({ ...old, [id]: { ...(old[id] ?? { id, name: peerName, muted: false, speaking: false }), stream: event.streams[0] } }));
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) closePeer(id);
    };
    peers.current.set(id, pc);
    setVoicePeers((old) => ({ ...old, [id]: old[id] ?? { id, name: peerName, muted: false, speaking: false } }));
    return pc;
  }, [closePeer, post]);

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
    };

    const handleSignal = async (data: Signal) => {
      const me = userRef.current;
      if (!me) return;
      if (data.from === me.id || (data.to && data.to !== me.id)) return;
      if (data.type === "leave") { closePeer(data.from); return; }
      if (!voiceRef.current || data.channel !== voiceRef.current) return;
      try {
        if (data.type === "announce") {
          const pc = makePeer(data.from, data.name ?? "Visitante");
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          post({ type: "offer", to: data.from, channel: voiceRef.current, name: me.name, payload: offer });
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
        Object.values(state).flat().forEach((presence) => {
          if (presence.id && presence.id !== user.id) next[presence.id] = presence;
        });
        setOnlineUsers(next);
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
          await channel.track({ ...user, onlineAt: new Date().toISOString() });
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
      realtime.current = null;
      setRealtimeConnected(false);
      setOnlineUsers({});
    };
  }, [user, closePeer, makePeer, post]);

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
    const tick = () => {
      analyser.getByteFrequencyData(values);
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      const active = !muted && average > 18;
      setSpeaking(active);
      if (active !== last) {
        post({ type: "voice-state", channel: voiceChannel, name: user.name, muted, speaking: active });
        last = active;
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(frame); source.disconnect(); void context.close(); };
  }, [voiceChannel, muted, user, post]);

  useEffect(() => {
    if (!voiceChannel || !user) return;
    post({ type: "voice-state", channel: voiceChannel, name: user.name, muted, speaking });
  }, [muted, voiceChannel, user, speaking, post]);

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
      localStream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      voiceRef.current = channel;
      setVoiceChannel(channel);
      setTimeout(() => post({ type: "announce", channel, name: userRef.current?.name, muted: false, speaking: false }), 120);
    } catch {
      setMicError("Não foi possível acessar o microfone. Verifique a permissão do navegador.");
    }
  };

  const leaveVoice = () => {
    if (voiceRef.current) post({ type: "leave", channel: voiceRef.current });
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
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim().slice(0, 2000);
    const supabase = getSupabaseBrowserClient();
    if (!content || !user || !supabase || sending) return;

    setSending(true);
    setRealtimeError("");
    const { data, error } = await supabase
      .from("messages")
      .insert({
        id: crypto.randomUUID(),
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
      setRealtimeError("A mensagem não foi enviada. Tente novamente.");
      return;
    }

    const sent = messageFromRow(data);
    setMessages((old) => old.some((item) => item.id === sent.id) ? old : [...old, sent].slice(-150));
    setDraft("");
  };

  const visibleMessages = useMemo(() => messages.filter((message) => message.channel === activeChannel), [messages, activeChannel]);
  const currentChannel = channels.find((channel) => channel.id === activeChannel)!;
  const voiceName = voiceChannels.find((channel) => channel.id === voiceChannel)?.label;
  const onlineMembers = user ? [user, ...Object.values(onlineUsers).filter((onlineUser) => onlineUser.id !== user.id)] : [];

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

      <aside className={`channel-sidebar ${mobileNav ? "mobile-open" : ""}`}>
        <header className="community-header"><div><span className="community-dot">F</span><strong>FYNEX Global</strong></div></header>
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
                <button className={`channel voice-channel ${voiceChannel === channel.id ? "selected" : ""}`} onClick={() => void joinVoice(channel.id)}><Radio size={16} />{channel.label}{voiceChannel === channel.id && <b className="live-pill">CONECTADO</b>}</button>
                {voiceChannel === channel.id && <div className="voice-list">
                  <div className={`voice-user ${speaking ? "speaking" : ""}`}><Avatar name={user.name} color={user.color} small status={false} /><span>{user.name}</span>{muted && <MicOff size={12} />}</div>
                  {Object.values(voicePeers).map((peer) => <div className={`voice-user ${peer.speaking ? "speaking" : ""}`} key={peer.id}><Avatar name={peer.name} color="#70a8ff" small status={false} /><span>{peer.name}</span>{peer.muted && <MicOff size={12} />}<RemoteAudio stream={peer.stream} muted={deafened} /></div>)}
                </div>}
              </div>
            ))}
          </section>
        </nav>
        {(micError || realtimeError) && <div className="mic-error">{micError || realtimeError}</div>}
        {voiceChannel && <div className="voice-connection"><div><Radio className="signal-icon" size={17} /><strong>Voz conectada</strong><small>{voiceName} · WebRTC + Supabase</small></div><button onClick={leaveVoice} aria-label="Desconectar da voz"><PhoneOff size={15} /></button></div>}
        <div className="user-panel">
          <Avatar name={user.name} color={user.color} />
          <div className="user-copy"><strong>{user.name}</strong><small>{voiceChannel ? "Na sala de voz" : "Online"}</small></div>
          <button className={muted ? "control-on" : ""} onClick={toggleMute} aria-label={muted ? "Ativar microfone" : "Silenciar microfone"}>{muted ? <MicOff size={15} /> : <Mic size={15} />}</button>
          <button className={deafened ? "control-on" : ""} onClick={() => setDeafened(!deafened)} aria-label={deafened ? "Ativar áudio" : "Silenciar áudio"}>{deafened ? <VolumeX size={15} /> : <Volume2 size={15} />}</button>
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
