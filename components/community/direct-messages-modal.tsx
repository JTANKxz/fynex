"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, LoaderCircle, MessageCircle, PencilLine, Search, Send, UserRound, X } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { openDirectConversationAction } from "@/app/actions/social";
import type { DirectConversation, DirectMessage } from "@/lib/supabase/database.types";
import type { MemberProfile } from "./member-profile-modal";
import styles from "./direct-messages-modal.module.css";

type Friend = Pick<MemberProfile, "id" | "username" | "display_name" | "avatar_url" | "accent_color">;
type InboxConversation = { conversation: DirectConversation; friend: Friend; latest: DirectMessage; unread: boolean };
const personFromProfile = (profile: Friend) => profile;
const formatTime = (value: string) => new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));

export function DirectMessagesModal({ currentUserId, initialProfile, onClose, onViewProfile }: { currentUserId: string; initialProfile?: MemberProfile | null; onClose: () => void; onViewProfile?: (profile: MemberProfile) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [inbox, setInbox] = useState<InboxConversation[]>([]);
  const [selected, setSelected] = useState<Friend | null>(initialProfile ? personFromProfile(initialProfile) : null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [query, setQuery] = useState("");
  const [friendSearchOpen, setFriendSearchOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const messageEnd = useRef<HTMLDivElement>(null);
  const typingChannel = useRef<RealtimeChannel | null>(null);
  const typingStopTimer = useRef<number | null>(null);
  const typingSentAt = useRef(0);

  const markRead = useCallback(async (targetConversationId: string) => {
    await supabase.from("direct_message_reads").upsert({ conversation_id: targetConversationId, user_id: currentUserId, last_read_at: new Date().toISOString() }, { onConflict: "conversation_id,user_id" });
  }, [currentUserId, supabase]);

  const loadInbox = useCallback(async () => {
    const { data: friendshipRows } = await supabase.from("friendships").select("user_a, user_b").eq("status", "accepted").or(`user_a.eq.${currentUserId},user_b.eq.${currentUserId}`);
    const friendIds = (friendshipRows ?? []).map((row) => row.user_a === currentUserId ? row.user_b : row.user_a).filter((id) => id !== currentUserId);
    if (!friendIds.length) { setFriends([]); setInbox([]); setLoading(false); return; }
    const [{ data: profiles }, { data: conversations }] = await Promise.all([
      supabase.from("profiles").select("id, username, display_name, avatar_url, accent_color").in("id", friendIds),
      supabase.from("direct_conversations").select("*").or(`user_a.eq.${currentUserId},user_b.eq.${currentUserId}`).order("updated_at", { ascending: false }),
    ]);
    const people = (profiles ?? []) as Friend[];
    setFriends(people);
    const conversationRows = conversations ?? [];
    if (!conversationRows.length) { setInbox([]); setLoading(false); return; }
    const ids = conversationRows.map((conversation) => conversation.id);
    const [{ data: messageRows }, { data: readRows }] = await Promise.all([
      supabase.from("direct_messages").select("*").in("conversation_id", ids).order("created_at", { ascending: false }).limit(1000),
      supabase.from("direct_message_reads").select("conversation_id, last_read_at").eq("user_id", currentUserId).in("conversation_id", ids),
    ]);
    const latestByConversation = new Map<string, DirectMessage>();
    (messageRows ?? []).forEach((message) => { if (!latestByConversation.has(message.conversation_id)) latestByConversation.set(message.conversation_id, message); });
    const readByConversation = new Map((readRows ?? []).map((read) => [read.conversation_id, read.last_read_at]));
    const peopleById = new Map(people.map((person) => [person.id, person]));
    const nextInbox = conversationRows.flatMap((conversation) => {
      const latest = latestByConversation.get(conversation.id);
      const friend = peopleById.get(conversation.user_a === currentUserId ? conversation.user_b : conversation.user_a);
      if (!latest || !friend) return [];
      return [{ conversation, friend, latest, unread: latest.author_id !== currentUserId && new Date(latest.created_at) > new Date(readByConversation.get(conversation.id) ?? 0) }];
    }).sort((a, b) => new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime());
    setInbox(nextInbox);
    setLoading(false);
  }, [currentUserId, supabase]);

  useEffect(() => { const task = window.setTimeout(() => void loadInbox(), 0); return () => window.clearTimeout(task); }, [loadInbox]);

  const openConversation = useCallback(async (friend: Friend) => {
    setSelected(friend); setFriendSearchOpen(false); setConversationId(null); setMessages([]); setError(""); setRemoteTyping(false);
    const result = await openDirectConversationAction(friend.id);
    if (!result.conversationId) { setError(result.error ?? "Não foi possível abrir a conversa."); return; }
    setConversationId(result.conversationId);
    const { data, error: loadError } = await supabase.from("direct_messages").select("*").eq("conversation_id", result.conversationId).order("created_at").limit(300);
    if (loadError) setError("Não foi possível carregar esta conversa.");
    setMessages(data ?? []);
    await markRead(result.conversationId);
    void loadInbox();
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [loadInbox, markRead, supabase]);

  useEffect(() => { if (!initialProfile) return; const task = window.setTimeout(() => void openConversation(personFromProfile(initialProfile)), 0); return () => window.clearTimeout(task); }, [initialProfile, openConversation]);

  useEffect(() => {
    const channel = supabase.channel(`direct-inbox:${currentUserId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, (payload) => {
      const message = payload.new as DirectMessage;
      if (message.conversation_id === conversationId) {
        setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
        if (message.author_id !== currentUserId) void markRead(message.conversation_id);
      }
      void loadInbox();
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [conversationId, currentUserId, loadInbox, markRead, supabase]);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase.channel(`direct-typing:${conversationId}`)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.userId !== currentUserId) { setRemoteTyping(Boolean(payload?.active)); }
      }).subscribe();
    typingChannel.current = channel;
    return () => { typingChannel.current = null; if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current); void supabase.removeChannel(channel); };
  }, [conversationId, currentUserId, supabase]);

  useEffect(() => { messageEnd.current?.scrollIntoView({ block: "end" }); }, [messages, remoteTyping]);

  const notifyTyping = (value: string) => {
    const now = Date.now();
    if (value.trim() && now - typingSentAt.current > 900) { typingSentAt.current = now; void typingChannel.current?.send({ type: "broadcast", event: "typing", payload: { userId: currentUserId, active: true } }); }
    if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
    typingStopTimer.current = window.setTimeout(() => void typingChannel.current?.send({ type: "broadcast", event: "typing", payload: { userId: currentUserId, active: false } }), 1400);
  };

  const send = async (event: FormEvent) => {
    event.preventDefault(); const content = draft.trim();
    if (!conversationId || !content || sending) return;
    setSending(true); setError("");
    const { data, error: sendError } = await supabase.from("direct_messages").insert({ conversation_id: conversationId, author_id: currentUserId, content }).select("*").single();
    setSending(false);
    if (sendError || !data) { setError("Não foi possível enviar. Verifique se esta pessoa bloqueou a conversa."); return; }
    setMessages((current) => current.some((item) => item.id === data.id) ? current : [...current, data]);
    setDraft(""); void typingChannel.current?.send({ type: "broadcast", event: "typing", payload: { userId: currentUserId, active: false } }); void markRead(conversationId); void loadInbox(); inputRef.current?.focus();
  };

  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const filteredInbox = inbox.filter(({ friend }) => `${friend.display_name} ${friend.username}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery));
  const filteredFriends = friends.filter((friend) => `${friend.display_name} ${friend.username}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery));
  return <div className={styles.backdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className={styles.modal} role="dialog" aria-modal="true" aria-label="Mensagens privadas">
      <aside className={`${styles.people} ${selected ? styles.hasSelection : ""}`}>
        <header><div><MessageCircle size={17} /><strong>Mensagens</strong></div><button onClick={() => setFriendSearchOpen((open) => !open)} aria-label="Iniciar nova conversa" title="Nova conversa"><PencilLine size={16} /></button><button onClick={onClose} aria-label="Fechar"><X size={17} /></button></header>
        <label className={styles.search}><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={friendSearchOpen ? "Buscar um amigo" : "Buscar conversas"} /></label>
        {friendSearchOpen ? <><div className={styles.listHeading}><strong>INICIAR CONVERSA</strong><small>{filteredFriends.length}</small></div><div className={styles.friendList}>{filteredFriends.map((friend) => <button key={friend.id} onClick={() => void openConversation(friend)}><i style={{ backgroundColor: friend.accent_color, backgroundImage: friend.avatar_url ? `url(${friend.avatar_url})` : undefined }}>{friend.avatar_url ? "" : friend.display_name.slice(0, 2).toUpperCase()}</i><span><strong>{friend.display_name}</strong></span></button>)}{!loading && !filteredFriends.length && <p>Nenhum amigo encontrado.</p>}</div></> : <><div className={styles.listHeading}><strong>CONVERSAS</strong><small>{filteredInbox.length}</small></div><div className={styles.friendList}>{loading ? <p>Carregando…</p> : filteredInbox.map(({ conversation, friend, latest, unread }) => <button className={`${selected?.id === friend.id ? styles.active : ""} ${unread ? styles.unread : ""}`} key={conversation.id} onClick={() => void openConversation(friend)}><i style={{ backgroundColor: friend.accent_color, backgroundImage: friend.avatar_url ? `url(${friend.avatar_url})` : undefined }}>{friend.avatar_url ? "" : friend.display_name.slice(0, 2).toUpperCase()}</i><span><strong>{friend.display_name}</strong><small>{latest.author_id === currentUserId ? "Você: " : ""}{latest.content}</small></span><time>{formatTime(latest.created_at)}</time>{unread && <b aria-label="Mensagem não lida" />}</button>)}{!loading && !filteredInbox.length && <div className={styles.noConversations}><MessageCircle size={22} /><strong>Nenhuma conversa ainda</strong><p>Use o botão acima para iniciar uma conversa com um amigo.</p></div>}</div></>}
      </aside>
      <main className={`${styles.chat} ${selected ? styles.open : ""}`}>
        {selected ? <><header><button className={styles.back} onClick={() => { setSelected(null); setConversationId(null); }} aria-label="Voltar"><ArrowLeft size={17} /></button><button className={styles.identity} onClick={() => initialProfile?.id === selected.id && onViewProfile?.(initialProfile)}><i style={{ backgroundColor: selected.accent_color, backgroundImage: selected.avatar_url ? `url(${selected.avatar_url})` : undefined }} /><span><strong>{selected.display_name}</strong>{remoteTyping && <small>digitando…</small>}</span></button><button onClick={onClose} aria-label="Fechar"><X size={17} /></button></header><div className={styles.messages}>{messages.length ? messages.map((message) => <article className={message.author_id === currentUserId ? styles.mine : ""} key={message.id}><span>{message.content}</span><time>{formatTime(message.created_at)}</time></article>) : conversationId && <div className={styles.empty}><UserRound size={28} /><strong>Comece a conversa com {selected.display_name}</strong><small>As mensagens ficam visíveis apenas para vocês.</small></div>}{remoteTyping && <div className={styles.typing}><i /><i /><i /><span>{selected.display_name} está digitando</span></div>}<div ref={messageEnd} /></div>{error && <p className={styles.error}>{error}</p>}<form onSubmit={send}><input ref={inputRef} value={draft} onChange={(event) => { setDraft(event.target.value); notifyTyping(event.target.value); }} maxLength={2000} placeholder={`Mensagem para ${selected.display_name}`} /><button disabled={!conversationId || !draft.trim() || sending} aria-label="Enviar mensagem">{sending ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />}</button></form></> : <div className={styles.blank}><MessageCircle size={34} /><strong>Suas conversas privadas</strong><p>Escolha uma conversa ou comece uma nova.</p></div>}
      </main>
    </section>
  </div>;
}
