"use client";

import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Link2, MessageCircle, Search, UserPlus, Users, X } from "lucide-react";
import type { Community } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";
import type { MemberProfile } from "@/components/community/member-profile-modal";
import { FynexSelect } from "@/components/ui/fynex-select";
import {
  inviteFriendAction,
  createCommunityInviteLinkAction,
  respondCommunityInviteAction,
  respondFriendRequestAction,
  reviewJoinRequestAction,
  sendFriendRequestAction,
  updateJoinPolicyAction,
  type SocialActionState,
} from "@/app/actions/social";

type Person = Pick<MemberProfile, "id" | "username" | "display_name" | "bio" | "avatar_url" | "banner_url" | "accent_color" | "created_at">;
type Friendship = { user_a: string; user_b: string; requested_by: string; status: string };
type IncomingInvite = { id: string; community_id: string; communityName: string; communityAvatar?: string | null; communityColor?: string };
type JoinRequest = { id: string; user_id: string; person?: Person };
type SocialAction = (state: SocialActionState, formData: FormData) => Promise<SocialActionState>;

function InlineResponse({ action, fields, acceptLabel = "Aceitar", declineLabel = "Recusar", onDone }: { action: SocialAction; fields: Record<string, string>; acceptLabel?: string; declineLabel?: string; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(action, {});
  useEffect(() => { if (state.success) onDone(); }, [onDone, state.success]);
  return <div className="inline-response">
    <form action={formAction}>{Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}<button name="decision" value={fields.requestId ? "approved" : "accepted"} disabled={pending}><Check size={13} />{acceptLabel}</button></form>
    <form action={formAction}>{Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}<button className="decline" name="decision" value={fields.requestId ? "declined" : "declined"} disabled={pending}><X size={13} />{declineLabel}</button></form>
    {state.error && <small>{state.error}</small>}
  </div>;
}

export type ConnectionsTab = "friends" | "community";
type FriendsView = "friends" | "received" | "sent";

export function ConnectionsModal({ community, currentUserId, initialTab = "friends", onClose, onMembershipChanged, onCommunityChanged, onViewProfile, onMessage }: { community: Community; currentUserId: string; initialTab?: ConnectionsTab; onClose: () => void; onMembershipChanged: () => void; onCommunityChanged: () => void; onViewProfile?: (profile: MemberProfile) => void; onMessage?: (profile: MemberProfile) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const manageMode = initialTab === "community";
  const [friendsView, setFriendsView] = useState<FriendsView>("friends");
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [invites, setInvites] = useState<IncomingInvite[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteUsername, setInviteUsername] = useState("");
  const [friendQuery, setFriendQuery] = useState("");
  const [friendResults, setFriendResults] = useState<Person[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Person | null>(null);
  const [friendSearchLoading, setFriendSearchLoading] = useState(false);
  const [joinPolicy, setJoinPolicy] = useState(community.join_policy);
  const [inviteToken, setInviteToken] = useState("");
  const [friendState, friendAction, friendPending] = useActionState(sendFriendRequestAction, {});
  const [inviteState, inviteAction, invitePending] = useActionState(inviteFriendAction, {});
  const [policyState, policyAction, policyPending] = useActionState(updateJoinPolicyAction, {});
  const [linkState, linkAction, linkPending] = useActionState(createCommunityInviteLinkAction, {});
  const effectiveInviteToken = linkState.inviteToken ?? inviteToken;
  const inviteLink = effectiveInviteToken && typeof window !== "undefined" ? `${window.location.origin}/invite/${effectiveInviteToken}` : "";

  const refresh = useCallback(async () => {
    const [friendResult, inviteResult, requestResult, linkResult] = await Promise.all([
      supabase.from("friendships").select("user_a, user_b, requested_by, status"),
      supabase.from("community_invitations").select("id, community_id").eq("invitee_id", currentUserId).eq("status", "pending"),
      supabase.from("community_join_requests").select("id, user_id").eq("community_id", community.id).eq("status", "pending"),
      manageMode ? supabase.from("community_invite_links").select("token").eq("community_id", community.id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const friendRows = friendResult.data ?? [];
    const inviteRows = inviteResult.data ?? [];
    const requestRows = requestResult.data ?? [];
    const profileIds = new Set<string>();
    friendRows.forEach((row) => { profileIds.add(row.user_a); profileIds.add(row.user_b); });
    requestRows.forEach((row) => profileIds.add(row.user_id));
    profileIds.delete(currentUserId);
    const communityIds = [...new Set(inviteRows.map((row) => row.community_id))];
    const [profilesResult, communitiesResult] = await Promise.all([
      profileIds.size ? supabase.from("profiles").select("id, username, display_name, bio, avatar_url, banner_url, accent_color, created_at").in("id", [...profileIds]) : Promise.resolve({ data: [] as Person[] }),
      communityIds.length ? supabase.from("communities").select("id, name, avatar_url, accent_color").in("id", communityIds) : Promise.resolve({ data: [] as { id: string; name: string; avatar_url: string | null; accent_color: string }[] }),
    ]);
    const profileMap = Object.fromEntries((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
    const communityMap = Object.fromEntries((communitiesResult.data ?? []).map((space) => [space.id, space.name]));
    setPeople(profileMap);
    setFriendships(friendRows);
    setInvites(inviteRows.map((invite) => { const space = (communitiesResult.data ?? []).find((community) => community.id === invite.community_id); return { ...invite, communityName: communityMap[invite.community_id] ?? "Comunidade", communityAvatar: space?.avatar_url, communityColor: space?.accent_color }; }));
    setJoinRequests(requestRows.map((request) => ({ ...request, person: profileMap[request.user_id] })));
    setInviteToken(linkResult.data?.token ?? "");
    setLoading(false);
  }, [community.id, currentUserId, manageMode, supabase]);

  useEffect(() => {
    const task = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(task);
  }, [refresh]);
  useEffect(() => {
    if (!friendState.success && !inviteState.success && !policyState.success && !linkState.success) return;
    const task = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(task);
  }, [friendState.success, inviteState.success, linkState.success, policyState.success, refresh]);
  useEffect(() => { if (policyState.success) onCommunityChanged(); }, [onCommunityChanged, policyState.success]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  useEffect(() => {
    const query = friendQuery.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
    if (query.length < 2 || selectedFriend?.username === query) {
      return;
    }
    let disposed = false;
    const task = window.setTimeout(() => {
      void supabase.from("profiles")
        .select("id, username, display_name, bio, avatar_url, banner_url, accent_color, created_at")
        .ilike("username", `${query}%`)
        .neq("id", currentUserId)
        .limit(8)
        .then(({ data }) => {
          if (disposed) return;
          const connectedIds = new Set(friendships.filter((friendship) => friendship.status !== "declined").flatMap((friendship) => [friendship.user_a, friendship.user_b]));
          setFriendResults((data ?? []).filter((person) => !connectedIds.has(person.id)));
          setFriendSearchLoading(false);
        });
    }, 280);
    return () => { disposed = true; window.clearTimeout(task); };
  }, [currentUserId, friendQuery, friendships, selectedFriend?.username, supabase]);
  useEffect(() => {
    if (!friendState.success) return;
    const task = window.setTimeout(() => {
      setFriendQuery("");
      setSelectedFriend(null);
      setFriendResults([]);
    }, 0);
    return () => window.clearTimeout(task);
  }, [friendState.success]);

  const acceptedFriends = friendships.filter((friendship) => friendship.status === "accepted").map((friendship) => people[friendship.user_a === currentUserId ? friendship.user_b : friendship.user_a]).filter(Boolean);
  const incomingRequests = friendships.filter((friendship) => friendship.status === "pending" && friendship.requested_by !== currentUserId);
  const outgoingRequests = friendships.filter((friendship) => friendship.status === "pending" && friendship.requested_by === currentUserId);

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="connections-modal" role="dialog" aria-modal="true" aria-labelledby="connections-title">
      <header><div><span className="auth-eyebrow">{manageMode ? "ADMINISTRAÇÃO" : "CONEXÕES"}</span><h2 id="connections-title">{manageMode ? `Gerenciar ${community.name}` : "Amigos"}</h2></div><button className="modal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button></header>
      {!manageMode && <nav className="connections-tabs" aria-label="Listas de amizade"><button className={friendsView === "friends" ? "active" : ""} onClick={() => setFriendsView("friends")}><Users size={15} />Amigos <b>{acceptedFriends.length}</b></button><button className={friendsView === "received" ? "active" : ""} onClick={() => setFriendsView("received")}><UserPlus size={15} />Recebidos <b>{incomingRequests.length}</b></button><button className={friendsView === "sent" ? "active" : ""} onClick={() => setFriendsView("sent")}><Link2 size={15} />Enviados <b>{outgoingRequests.length}</b></button></nav>}

      <div className="connections-body">
        {!manageMode && <>
          <form action={friendAction} className="social-form friend-search-form"><input type="hidden" name="username" value={selectedFriend?.username ?? ""} /><label>Adicionar amigo<div className="friend-search-input"><Search size={14} /><input value={friendQuery} onChange={(event) => { setFriendQuery(event.target.value); setSelectedFriend(null); setFriendResults([]); setFriendSearchLoading(event.target.value.trim().length >= 2); }} placeholder="Busque pelo @usuário" autoComplete="off" /></div>{friendSearchLoading ? <small className="friend-search-status">Buscando…</small> : null}{friendResults.length ? <div className="friend-search-results" role="listbox" aria-label="Resultados da busca">{friendResults.map((person) => <button type="button" role="option" aria-selected={selectedFriend?.id === person.id} key={person.id} onClick={() => { setSelectedFriend(person); setFriendQuery(person.username); setFriendResults([]); setFriendSearchLoading(false); }}><span className="person-color" style={{ backgroundColor: person.accent_color, backgroundImage: person.avatar_url ? `url(${person.avatar_url})` : undefined }} /><span><strong>{person.display_name}</strong><small>@{person.username}</small></span></button>)}</div> : friendQuery.trim().length >= 2 && !friendSearchLoading && !selectedFriend ? <small className="friend-search-status">Nenhum usuário disponível com esse nome.</small> : null}</label><button disabled={friendPending || !selectedFriend}><UserPlus size={15} />{selectedFriend ? `Adicionar ${selectedFriend.display_name}` : "Escolha um usuário"}</button></form>
          {(friendState.error || friendState.success) && <p className={`form-message ${friendState.error ? "error" : "success"}`}>{friendState.error ?? friendState.success}</p>}

          {friendsView === "friends" && <section className="connection-list"><h3>SEUS AMIGOS — {acceptedFriends.length}</h3>{acceptedFriends.map((person) => <article key={person.id} className="clickable-person"><button className="connection-person-main" onClick={() => onViewProfile?.({ ...person, online: false, roles: [] })}><span className="person-color" style={{ backgroundColor: person.accent_color, backgroundImage: person.avatar_url ? `url(${person.avatar_url})` : undefined }} /><span><strong>{person.display_name}</strong><small>@{person.username} · visualizar perfil</small></span></button><button className="connection-message" onClick={() => onMessage?.({ ...person, online: false, roles: [] })}><MessageCircle size={14} />Mensagem</button></article>)}{!acceptedFriends.length && <p>Sua lista de amigos ainda está vazia.</p>}</section>}
          {friendsView === "received" && <><section className="connection-list"><h3>PEDIDOS RECEBIDOS — {incomingRequests.length}</h3>{incomingRequests.map((request) => { const person = people[request.user_a === currentUserId ? request.user_b : request.user_a]; return <article key={`${request.user_a}-${request.user_b}`}><span className="person-color" style={{ backgroundColor: person?.accent_color, backgroundImage: person?.avatar_url ? `url(${person.avatar_url})` : undefined }} /><div><strong>{person?.display_name ?? "Usuário"}</strong><small>@{person?.username}</small></div><InlineResponse action={respondFriendRequestAction} fields={{ userA: request.user_a, userB: request.user_b }} onDone={() => void refresh()} /></article>; })}{!incomingRequests.length && <p>Nenhum pedido aguardando você.</p>}</section>{invites.length > 0 && <section className="connection-list"><h3>CONVITES DE COMUNIDADE — {invites.length}</h3>{invites.map((invite) => <article key={invite.id}><span className="person-color community-invite-avatar" style={{ backgroundColor: invite.communityColor, backgroundImage: invite.communityAvatar ? `url(${invite.communityAvatar})` : undefined }} /><div><strong>{invite.communityName}</strong><small>Você foi convidado</small></div><InlineResponse action={respondCommunityInviteAction} fields={{ invitationId: invite.id }} onDone={() => { void refresh(); onMembershipChanged(); }} /></article>)}</section>}</>}
          {friendsView === "sent" && <section className="connection-list"><h3>PEDIDOS ENVIADOS PENDENTES — {outgoingRequests.length}</h3>{outgoingRequests.map((request) => { const person = people[request.user_a === currentUserId ? request.user_b : request.user_a]; return <article key={`${request.user_a}-${request.user_b}`}><span className="person-color" style={{ backgroundColor: person?.accent_color, backgroundImage: person?.avatar_url ? `url(${person.avatar_url})` : undefined }} /><div><strong>{person?.display_name ?? "Usuário"}</strong><small>@{person?.username}</small></div><span className="request-pending">Pendente</span></article>; })}{!outgoingRequests.length && <p>Você não tem pedidos enviados aguardando resposta.</p>}</section>}
        </>}

        {manageMode && <>
          <div className="community-invite-link"><div><small>LINK PERMANENTE DA COMUNIDADE</small><strong>{inviteLink || "Crie uma vez e compartilhe sempre o mesmo endereço"}</strong></div>{inviteLink ? <button onClick={() => navigator.clipboard?.writeText(inviteLink)}><Copy size={14} />Copiar link</button> : <form action={linkAction}><input type="hidden" name="communityId" value={community.id} /><button disabled={linkPending}><Link2 size={14} />{linkPending ? "Criando…" : "Criar link fixo"}</button></form>}</div>
          {(linkState.error || linkState.success) && <p className={`form-message ${linkState.error ? "error" : "success"}`}>{linkState.error ?? linkState.success}</p>}
          <form action={inviteAction} className="social-form"><input type="hidden" name="communityId" value={community.id} /><label>Convidar um amigo<FynexSelect name="username" value={inviteUsername} onChange={setInviteUsername} ariaLabel="Escolher amigo para convidar" placeholder="Escolha uma pessoa" options={acceptedFriends.map((friend) => ({ value: friend.username, label: friend.display_name, detail: `@${friend.username}`, imageUrl: friend.avatar_url, color: friend.accent_color, initials: friend.display_name.slice(0, 2).toUpperCase() }))} /></label><button disabled={invitePending || !acceptedFriends.length || !inviteUsername}><UserPlus size={15} />Convidar</button></form>
          {(inviteState.error || inviteState.success) && <p className={`form-message ${inviteState.error ? "error" : "success"}`}>{inviteState.error ?? inviteState.success}</p>}
          <form action={policyAction} className="join-policy-form"><input type="hidden" name="communityId" value={community.id} /><label>Quem pode entrar?<FynexSelect name="joinPolicy" value={joinPolicy} onChange={(value) => setJoinPolicy(value as Community["join_policy"])} ariaLabel="Escolher regra de entrada" options={[{ value: "open", label: "Entrada automática", detail: "Qualquer pessoa com o link entra" }, { value: "admin_approval", label: "Aprovação do administrador", detail: "Um administrador precisa aceitar" }, { value: "member_approval", label: "Aprovação de qualquer membro", detail: "Qualquer membro pode aceitar" }]} /></label><button disabled={policyPending}>Salvar regra</button></form>
          {(policyState.error || policyState.success) && <p className={`form-message ${policyState.error ? "error" : "success"}`}>{policyState.error ?? policyState.success}</p>}
          <section className="connection-list"><h3>SOLICITAÇÕES DE ENTRADA — {joinRequests.length}</h3>{joinRequests.map((request) => <article key={request.id}><span className="person-color" style={{ backgroundColor: request.person?.accent_color, backgroundImage: request.person?.avatar_url ? `url(${request.person.avatar_url})` : undefined }} /><div><strong>{request.person?.display_name ?? "Usuário"}</strong><small>@{request.person?.username}</small></div><InlineResponse action={reviewJoinRequestAction} fields={{ requestId: request.id }} acceptLabel="Aprovar" onDone={() => void refresh()} /></article>)}{!joinRequests.length && <p>Nenhuma solicitação pendente.</p>}</section>
        </>}
        {loading && <p className="connections-loading">Atualizando conexões…</p>}
      </div>
    </section>
  </div>;
}
