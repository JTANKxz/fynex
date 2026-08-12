"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { AtSign, Ban, CalendarDays, Crown, Heart, MessageCircle, Pencil, ShieldCheck, UserPlus, Users, X } from "lucide-react";
import type { CommunityRoleWithIcon, CommunityTag, Profile } from "@/lib/supabase/database.types";
import { ProfileSongCard } from "@/components/profile/profile-song-card";
import { songFromProfile } from "@/lib/spotify";
import styles from "./member-profile-modal.module.css";
import { blockUserAction, sendFriendRequestAction } from "@/app/actions/social";
import { createClient } from "@/lib/supabase/client";
import { RoleIcon } from "./role-icon";
import { FynexColorPicker } from "@/components/ui/fynex-color-picker";
import { respondCommunityPairRequestAction, sendCommunityPairRequestAction, updateServerProfileAction } from "@/app/actions/community-identity";

export type MemberProfile = Pick<Profile, "id" | "username" | "display_name" | "bio" | "avatar_url" | "banner_url" | "accent_color" | "created_at"> & Partial<Pick<Profile, "presence_status" | "profile_song_id" | "profile_song_name" | "profile_song_artist" | "profile_song_cover_url" | "profile_song_preview_url" | "profile_song_spotify_url" | "profile_song_duration_ms" | "profile_song_start_seconds">> & {
  joinedAt?: string;
  online?: boolean;
  isOwner?: boolean;
  roles?: CommunityRoleWithIcon[];
  tags?: CommunityTag[];
  nickname?: string | null;
  server_bio?: string | null;
  server_accent_color?: string | null;
  display_role_id?: string | null;
};

type MutualFriend = Pick<MemberProfile, "id" | "display_name" | "username" | "avatar_url" | "accent_color">;

export function MemberProfileModal({ profile, currentUserId, communityId, communityMembers = [], onClose, onMessage, onChanged }: { profile: MemberProfile; currentUserId?: string; communityId?: string; communityMembers?: MemberProfile[]; onClose: () => void; onMessage?: (profile: MemberProfile) => void; onChanged?: () => void }) {
  const initials = profile.display_name.slice(0, 2).toUpperCase();
  const shownStatus = profile.online ? profile.presence_status ?? "online" : "invisible";
  const song = songFromProfile(profile);
  const supabase = useMemo(() => createClient(), []);
  const [friendState, friendAction, friendPending] = useActionState(sendFriendRequestAction, {});
  const [blockState, blockAction, blockPending] = useActionState(blockUserAction, {});
  const [relationship, setRelationship] = useState<"none" | "pending" | "accepted">("none");
  const [blocked, setBlocked] = useState(false);
  const [editingServerProfile, setEditingServerProfile] = useState(false);
  const [pairPickerOpen, setPairPickerOpen] = useState(false);
  const [pairRequest, setPairRequest] = useState<{ id: string; requester_id: string; recipient_id: string; status: "pending" | "accepted" | "declined" } | null>(null);
  const [serverProfileState, setServerProfileState] = useState<{ error?: string; success?: string }>({});
  const [pairState, setPairState] = useState<{ error?: string; success?: string }>({});
  const [serverColor, setServerColor] = useState(profile.server_accent_color ?? profile.accent_color);
  const [mutualFriends, setMutualFriends] = useState<MutualFriend[]>([]);
  const [mutualFriendsOpen, setMutualFriendsOpen] = useState(false);
  const isCommunityContext = Boolean(communityId);
  const displayName = isCommunityContext ? profile.nickname || profile.display_name : profile.display_name;
  useEffect(() => {
    if (!currentUserId || currentUserId === profile.id) return;
    const [userA, userB] = [currentUserId, profile.id].sort();
    void Promise.all([
      supabase.from("friendships").select("status").eq("user_a", userA).eq("user_b", userB).maybeSingle(),
      supabase.from("user_blocks").select("blocked_id").eq("blocker_id", currentUserId).eq("blocked_id", profile.id).maybeSingle(),
    ]).then(([friendship, block]) => { setRelationship((friendship.data?.status as "pending" | "accepted") ?? "none"); setBlocked(Boolean(block.data)); });
  }, [currentUserId, profile.id, supabase]);
  useEffect(() => {
    if (!communityId || !currentUserId) return;
    void supabase.from("community_pairs").select("id, requester_id, recipient_id, status").eq("community_id", communityId).or(`requester_id.eq.${profile.id},recipient_id.eq.${profile.id}`).in("status", ["pending", "accepted"]).then(({ data }) => setPairRequest(data?.[0] ?? null));
  }, [communityId, currentUserId, profile.id, supabase]);
  useEffect(() => {
    if (!currentUserId || currentUserId === profile.id) {
      const timer = window.setTimeout(() => setMutualFriends([]), 0);
      return () => window.clearTimeout(timer);
    }
    let active = true;
    void supabase.rpc("get_mutual_friends", { target_user_id: profile.id }).then(({ data, error }) => {
      if (!active || error) return;
      setMutualFriends((data ?? []) as MutualFriend[]);
    });
    return () => { active = false; };
  }, [currentUserId, profile.id, supabase]);
  const shownRelationship = friendState.success ? "pending" : relationship;
  const shownBlocked = blockState.success ? !blocked : blocked;
  return <div className={styles.backdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className={styles.modal} role="dialog" aria-modal="true" aria-label={`Perfil de ${profile.display_name}`} style={{ "--member-accent": profile.accent_color } as React.CSSProperties}>
      <button className={styles.close} onClick={onClose} aria-label="Fechar perfil"><X size={18} /></button>
      <div className={styles.banner} style={profile.banner_url ? { backgroundImage: `linear-gradient(to bottom, transparent, rgba(4,3,7,.55)), url(${profile.banner_url})` } : undefined} />
      <div className={styles.identity}>
        <div className={styles.avatar} style={profile.avatar_url ? { backgroundImage: `url(${profile.avatar_url})` } : undefined}>{!profile.avatar_url && initials}<i className={styles[shownStatus]} /></div>
        <div><div className={styles.nameLine}><h2>{displayName}</h2>{isCommunityContext && profile.isOwner && <Crown size={17} aria-label="Criador da comunidade" />}{isCommunityContext && !profile.isOwner && profile.roles?.length ? <RoleIcon name={[...profile.roles].sort((a, b) => b.position - a.position)[0].icon} customUrl={[...profile.roles].sort((a, b) => b.position - a.position)[0].customIcon?.image_url} color={[...profile.roles].sort((a, b) => b.position - a.position)[0].color} size={16} /> : null}</div><span><AtSign size={13} />{profile.username}</span></div>
      </div>
      {currentUserId && currentUserId !== profile.id && <div className={styles.actions}>
        {shownRelationship === "accepted" && !shownBlocked ? <button onClick={() => onMessage?.(profile)}><MessageCircle size={15} />Mensagem</button> : shownRelationship === "none" && !shownBlocked ? <form action={friendAction}><input type="hidden" name="username" value={profile.username} /><button disabled={friendPending}><UserPlus size={15} />Adicionar amigo</button></form> : <span>{shownBlocked ? "Usuário bloqueado" : "Pedido de amizade pendente"}</span>}
        <form action={blockAction}><input type="hidden" name="targetUserId" value={profile.id} /><input type="hidden" name="blocked" value={shownBlocked ? "false" : "true"} /><button className={styles.block} disabled={blockPending}><Ban size={15} />{shownBlocked ? "Desbloquear" : "Bloquear"}</button></form>
      </div>}
      {(friendState.error || friendState.success || blockState.error || blockState.success) && <p className={styles.actionNotice}>{friendState.error ?? friendState.success ?? blockState.error ?? blockState.success}</p>}
      <div className={styles.content}>
        {currentUserId === profile.id && communityId && <section className={styles.serverProfile}><h3>PERFIL NESTA COMUNIDADE</h3><button className={styles.editServerProfile} onClick={() => setEditingServerProfile((open) => !open)}><Pencil size={14} />{editingServerProfile ? "Fechar edição" : "Editar perfil neste servidor"}</button>{editingServerProfile && <form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void updateServerProfileAction({ communityId, nickname: String(form.get("nickname") ?? ""), bio: String(form.get("bio") ?? ""), accentColor: serverColor }).then((state) => { setServerProfileState(state); if (state.success) onChanged?.(); }); }} className={styles.serverForm}><label>Apelido<input name="nickname" defaultValue={profile.nickname ?? ""} maxLength={32} placeholder="Usar nome do perfil" /></label><label>Bio neste servidor<textarea name="bio" defaultValue={profile.server_bio ?? ""} maxLength={190} placeholder="Uma descrição exclusiva para esta comunidade" /></label><div><small>Cor do perfil</small><FynexColorPicker compact name="accentColor" value={serverColor} onChange={setServerColor}/></div><button type="submit" className={styles.saveServerProfile}>Salvar alterações</button>{(serverProfileState.error || serverProfileState.success) && <p>{serverProfileState.error ?? serverProfileState.success}</p>}</form>}</section>}
        {communityId && <section className={styles.pairSection}><h3>PAR NESTA COMUNIDADE</h3>{pairRequest?.status === "accepted" ? <p className={styles.pairActive}><Heart size={15} fill="currentColor" />{(() => { const partnerId = pairRequest.requester_id === profile.id ? pairRequest.recipient_id : pairRequest.requester_id; const partner = communityMembers.find((member) => member.id === partnerId); return partner ? `${profile.nickname || profile.display_name} e ${partner.nickname || partner.display_name}` : "Par nesta comunidade"; })()}</p> : currentUserId === profile.id ? pairRequest?.status === "pending" ? <p>Pedido de par pendente.</p> : <><button className={styles.editServerProfile} onClick={() => setPairPickerOpen((open) => !open)}><Heart size={14} />Adicionar par</button>{pairPickerOpen && <div className={styles.pairPicker}>{communityMembers.filter((member) => member.id !== currentUserId).map((member) => <button key={member.id} onClick={() => void sendCommunityPairRequestAction({ communityId, recipientId: member.id }).then((state) => { setPairState(state); if (state.success) { setPairPickerOpen(false); onChanged?.(); } })}><span style={{ backgroundImage: member.avatar_url ? `url(${member.avatar_url})` : undefined }}>{!member.avatar_url && member.display_name.slice(0, 1)}</span>{member.nickname || member.display_name}<small>@{member.username}</small></button>)}</div>}</> : pairRequest?.status === "pending" && pairRequest.recipient_id === currentUserId ? <div className={styles.pairActions}><p>Este membro quer adicionar você como par.</p><button onClick={() => void respondCommunityPairRequestAction({ requestId: pairRequest.id, decision: "accepted" }).then((state) => { setPairState(state); if (state.success) { setPairRequest({ ...pairRequest, status: "accepted" }); onChanged?.(); } })}>Aceitar</button><button onClick={() => void respondCommunityPairRequestAction({ requestId: pairRequest.id, decision: "declined" }).then((state) => { setPairState(state); if (state.success) { setPairRequest(null); onChanged?.(); } })}>Recusar</button></div> : <p>Sem par nesta comunidade.</p>}{(pairState.error || pairState.success) && <p className={styles.actionNotice}>{pairState.error ?? pairState.success}</p>}</section>}
        <section><h3>SOBRE MIM</h3><p>{profile.bio || "Este usuário ainda não escreveu uma descrição."}</p></section>
        {song && <ProfileSongCard key={song.id} song={song} compact />}
        {currentUserId && currentUserId !== profile.id && <section className={styles.mutualFriends}><h3>AMIGOS EM COMUM</h3>{mutualFriends.length ? <button type="button" onClick={() => setMutualFriendsOpen(true)}><span className={styles.mutualAvatars}>{mutualFriends.slice(0, 2).map((friend) => <i key={friend.id} style={friend.avatar_url ? { backgroundImage: `url(${friend.avatar_url})` } : { backgroundColor: friend.accent_color }}>{!friend.avatar_url && friend.display_name.slice(0, 1)}</i>)}</span><span><strong>{mutualFriends.length} {mutualFriends.length === 1 ? "amigo em comum" : "amigos em comum"}</strong><small>Ver lista</small></span><Users size={15} /></button> : <p>Nenhum amigo em comum.</p>}</section>}
        {isCommunityContext && <section><h3>CARGOS</h3><div className={styles.roles}>{profile.isOwner && <span style={{ "--role-color": "#f5c451" } as React.CSSProperties}><Crown size={11} />Criador</span>}{profile.roles?.map((role) => <span key={role.id} style={{ "--role-color": role.color } as React.CSSProperties}><RoleIcon name={role.icon} customUrl={role.customIcon?.image_url} color={role.color} size={11} />{role.name}</span>)}{!profile.isOwner && !profile.roles?.length && <small>Membro</small>}</div></section>}
        {isCommunityContext && profile.tags?.length ? <section><h3>TAG DA COMUNIDADE</h3><div className={styles.roles}>{profile.tags.map((tag) => <span key={tag.id} style={{ "--role-color": tag.color } as React.CSSProperties}>#{tag.name}</span>)}</div></section> : null}
        <section className={styles.dates}><div><CalendarDays size={15} /><span><small>NO FYNEX DESDE</small>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(profile.created_at))}</span></div>{isCommunityContext && profile.joinedAt && <div><ShieldCheck size={15} /><span><small>NA COMUNIDADE DESDE</small>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(profile.joinedAt))}</span></div>}</section>
      </div>
    </section>
    {mutualFriendsOpen && <div className={styles.mutualBackdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setMutualFriendsOpen(false)}><section className={styles.mutualDialog} role="dialog" aria-modal="true" aria-label="Amigos em comum"><header><div><h3>Amigos em comum</h3><p>{mutualFriends.length} {mutualFriends.length === 1 ? "amigo" : "amigos"} em comum</p></div><button type="button" onClick={() => setMutualFriendsOpen(false)} aria-label="Fechar lista"><X size={17} /></button></header><div>{mutualFriends.map((friend) => <article key={friend.id}><span className={styles.mutualAvatar} style={friend.avatar_url ? { backgroundImage: `url(${friend.avatar_url})` } : { backgroundColor: friend.accent_color }}>{!friend.avatar_url && friend.display_name.slice(0, 1)}</span><span><strong>{friend.display_name}</strong><small>@{friend.username}</small></span></article>)}</div></section></div>}
  </div>;
}
