"use client";

import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Link2, ShieldCheck, UserPlus, Users, X } from "lucide-react";
import type { Community } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";
import type { MemberProfile } from "@/components/community/member-profile-modal";
import {
  inviteFriendAction,
  joinCommunityAction,
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

export type ConnectionsTab = "friends" | "community" | "join";

export function ConnectionsModal({ community, currentUserId, initialTab = "friends", onClose, onMembershipChanged, onCommunityChanged, onViewProfile }: { community: Community; currentUserId: string; initialTab?: ConnectionsTab; onClose: () => void; onMembershipChanged: () => void; onCommunityChanged: () => void; onViewProfile?: (profile: MemberProfile) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<ConnectionsTab>(initialTab);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [invites, setInvites] = useState<IncomingInvite[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [friendState, friendAction, friendPending] = useActionState(sendFriendRequestAction, {});
  const [inviteState, inviteAction, invitePending] = useActionState(inviteFriendAction, {});
  const [joinState, joinAction, joinPending] = useActionState(joinCommunityAction, {});
  const [policyState, policyAction, policyPending] = useActionState(updateJoinPolicyAction, {});

  const refresh = useCallback(async () => {
    const [friendResult, inviteResult, requestResult] = await Promise.all([
      supabase.from("friendships").select("user_a, user_b, requested_by, status"),
      supabase.from("community_invitations").select("id, community_id").eq("invitee_id", currentUserId).eq("status", "pending"),
      supabase.from("community_join_requests").select("id, user_id").eq("community_id", community.id).eq("status", "pending"),
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
    setLoading(false);
  }, [community.id, currentUserId, supabase]);

  useEffect(() => {
    const task = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(task);
  }, [refresh]);
  useEffect(() => {
    if (!friendState.success && !inviteState.success && !joinState.success && !policyState.success) return;
    const task = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(task);
  }, [friendState.success, inviteState.success, joinState.success, policyState.success, refresh]);
  useEffect(() => { if (joinState.success) onMembershipChanged(); }, [joinState.success, onMembershipChanged]);
  useEffect(() => { if (policyState.success) onCommunityChanged(); }, [onCommunityChanged, policyState.success]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  const acceptedFriends = friendships.filter((friendship) => friendship.status === "accepted").map((friendship) => people[friendship.user_a === currentUserId ? friendship.user_b : friendship.user_a]).filter(Boolean);
  const incomingRequests = friendships.filter((friendship) => friendship.status === "pending" && friendship.requested_by !== currentUserId);
  const outgoingRequests = friendships.filter((friendship) => friendship.status === "pending" && friendship.requested_by === currentUserId);
  const isOwner = community.owner_id === currentUserId;

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="connections-modal" role="dialog" aria-modal="true" aria-labelledby="connections-title">
      <header><div><span className="auth-eyebrow">CONEXÕES</span><h2 id="connections-title">Pessoas e comunidades</h2></div><button className="modal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button></header>
      <nav className="connections-tabs"><button className={tab === "friends" ? "active" : ""} onClick={() => setTab("friends")}><Users size={15} />Amigos</button><button className={tab === "community" ? "active" : ""} onClick={() => setTab("community")}><ShieldCheck size={15} />Comunidade</button><button className={tab === "join" ? "active" : ""} onClick={() => setTab("join")}><Link2 size={15} />Entrar</button></nav>

      <div className="connections-body">
        {tab === "friends" && <>
          <form action={friendAction} className="social-form"><label>Adicionar pelo nome de usuário<div><span>@</span><input name="username" placeholder="nome_de_usuario" required /></div></label><button disabled={friendPending}><UserPlus size={15} />Adicionar amigo</button></form>
          {(friendState.error || friendState.success) && <p className={`form-message ${friendState.error ? "error" : "success"}`}>{friendState.error ?? friendState.success}</p>}
          <section className="connection-list"><h3>PEDIDOS RECEBIDOS — {incomingRequests.length}</h3>{incomingRequests.map((request) => { const person = people[request.user_a === currentUserId ? request.user_b : request.user_a]; return <article key={`${request.user_a}-${request.user_b}`}><span className="person-color" style={{ backgroundColor: person?.accent_color, backgroundImage: person?.avatar_url ? `url(${person.avatar_url})` : undefined }} /> <div><strong>{person?.display_name ?? "Usuário"}</strong><small>@{person?.username}</small></div><InlineResponse action={respondFriendRequestAction} fields={{ userA: request.user_a, userB: request.user_b }} onDone={() => void refresh()} /></article>; })}{!incomingRequests.length && <p>Nenhum pedido aguardando você.</p>}</section>
          <section className="connection-list"><h3>AMIGOS — {acceptedFriends.length}</h3>{acceptedFriends.map((person) => <article key={person.id} className="clickable-person" onClick={() => onViewProfile?.({ ...person, online: false, roles: [] })}><span className="person-color" style={{ backgroundColor: person.accent_color, backgroundImage: person.avatar_url ? `url(${person.avatar_url})` : undefined }} /><div><strong>{person.display_name}</strong><small>@{person.username} · visualizar perfil</small></div></article>)}{!acceptedFriends.length && <p>Sua lista de amigos ainda está vazia.</p>}{outgoingRequests.length > 0 && <small>{outgoingRequests.length} pedido(s) enviado(s) aguardando resposta.</small>}</section>
          {invites.length > 0 && <section className="connection-list"><h3>CONVITES DE COMUNIDADE — {invites.length}</h3>{invites.map((invite) => <article key={invite.id}><span className="person-color community-invite-avatar" style={{ backgroundColor: invite.communityColor, backgroundImage: invite.communityAvatar ? `url(${invite.communityAvatar})` : undefined }} /><div><strong>{invite.communityName}</strong><small>Você foi convidado</small></div><InlineResponse action={respondCommunityInviteAction} fields={{ invitationId: invite.id }} onDone={() => { void refresh(); onMembershipChanged(); }} /></article>)}</section>}
        </>}

        {tab === "community" && <>
          <div className="community-code"><div><small>CÓDIGO DA COMUNIDADE</small><strong>{community.id}</strong></div><button onClick={() => navigator.clipboard?.writeText(community.id)}><Copy size={14} />Copiar</button></div>
          <form action={inviteAction} className="social-form"><input type="hidden" name="communityId" value={community.id} /><label>Convidar um amigo<select name="username" required defaultValue=""><option value="" disabled>Escolha uma pessoa</option>{acceptedFriends.map((friend) => <option key={friend.id} value={friend.username}>{friend.display_name} (@{friend.username})</option>)}</select></label><button disabled={invitePending || !acceptedFriends.length}><UserPlus size={15} />Convidar</button></form>
          {(inviteState.error || inviteState.success) && <p className={`form-message ${inviteState.error ? "error" : "success"}`}>{inviteState.error ?? inviteState.success}</p>}
          {isOwner && <form action={policyAction} className="join-policy-form"><input type="hidden" name="communityId" value={community.id} /><label>Quem pode entrar?<select name="joinPolicy" defaultValue={community.join_policy}><option value="open">Entrada automática</option><option value="admin_approval">Aprovação do administrador</option><option value="member_approval">Aprovação de qualquer membro</option></select></label><button disabled={policyPending}>Salvar regra</button></form>}
          {(policyState.error || policyState.success) && <p className={`form-message ${policyState.error ? "error" : "success"}`}>{policyState.error ?? policyState.success}</p>}
          <section className="connection-list"><h3>SOLICITAÇÕES DE ENTRADA — {joinRequests.length}</h3>{joinRequests.map((request) => <article key={request.id}><span className="person-color" style={{ backgroundColor: request.person?.accent_color, backgroundImage: request.person?.avatar_url ? `url(${request.person.avatar_url})` : undefined }} /><div><strong>{request.person?.display_name ?? "Usuário"}</strong><small>@{request.person?.username}</small></div><InlineResponse action={reviewJoinRequestAction} fields={{ requestId: request.id }} acceptLabel="Aprovar" onDone={() => void refresh()} /></article>)}{!joinRequests.length && <p>Nenhuma solicitação pendente.</p>}</section>
        </>}

        {tab === "join" && <><div className="join-explainer"><Link2 size={20} /><div><strong>Entrar com código</strong><p>Se a entrada for livre, você entra na hora. Nos outros modos, um pedido é enviado para aprovação.</p></div></div><form action={joinAction} className="social-form vertical"><label>Código da comunidade<input name="communityId" placeholder="00000000-0000-0000-0000-000000000000" required /></label><button disabled={joinPending}>Solicitar entrada</button></form>{(joinState.error || joinState.success) && <p className={`form-message ${joinState.error ? "error" : "success"}`}>{joinState.error ?? joinState.success}</p>}</>}
        {loading && <p className="connections-loading">Atualizando conexões…</p>}
      </div>
    </section>
  </div>;
}
