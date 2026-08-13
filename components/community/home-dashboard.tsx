"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Bell, ChevronRight, Home, Menu, MessageCircle, Plus, UserPlus, Users, X } from "lucide-react";
import type { Community } from "@/lib/supabase/database.types";
import type { MemberProfile } from "@/components/community/member-profile-modal";
import { createClient } from "@/lib/supabase/client";
import styles from "./home-dashboard.module.css";

type Friend = Pick<MemberProfile, "id" | "username" | "display_name" | "bio" | "avatar_url" | "banner_url" | "accent_color" | "created_at">;
type CommunityStat = { members: number; online: number };

export function HomeDashboard({ currentUserId, profile, onlineUserIds, communities, unreadCounts, onOpenCommunity, onOpenFriends, onOpenMessages, onOpenNotifications, onOpenProfile, onOpenProfilePage, onCreateCommunity }: { currentUserId: string; profile: { name: string; color: string; avatarUrl: string | null }; onlineUserIds: string[]; communities: Community[]; unreadCounts: Record<string, number>; onOpenCommunity: (communityId: string) => void; onOpenFriends: () => void; onOpenMessages: () => void; onOpenNotifications: () => void; onOpenProfile: (profile: MemberProfile) => void; onOpenProfilePage: () => void; onCreateCommunity: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [communitiesOpen, setCommunitiesOpen] = useState(false);
  const [stats, setStats] = useState<Record<string, CommunityStat>>({});

  useEffect(() => {
    let active = true;
    void supabase.from("friendships").select("user_a, user_b").eq("status", "accepted").or(`user_a.eq.${currentUserId},user_b.eq.${currentUserId}`).then(async ({ data }) => {
      const ids = (data ?? []).map((row) => row.user_a === currentUserId ? row.user_b : row.user_a);
      if (!ids.length) { if (active) setFriends([]); return; }
      const { data: profiles } = await supabase.from("profiles").select("id, username, display_name, bio, avatar_url, banner_url, accent_color, created_at").in("id", ids).order("display_name");
      if (active) setFriends((profiles ?? []) as Friend[]);
    });
    return () => { active = false; };
  }, [currentUserId, supabase]);

  useEffect(() => {
    const ids = communities.map((community) => community.id);
    if (!ids.length) return;
    let active = true;
    const online = new Set(onlineUserIds);
    void supabase.from("community_members").select("community_id, user_id").in("community_id", ids).then(({ data }) => {
      if (!active) return;
      const next = Object.fromEntries(ids.map((id) => [id, { members: 0, online: 0 }])) as Record<string, CommunityStat>;
      (data ?? []).forEach((member) => {
        next[member.community_id].members += 1;
        if (online.has(member.user_id)) next[member.community_id].online += 1;
      });
      setStats(next);
    });
    return () => { active = false; };
  }, [communities, onlineUserIds, supabase]);

  const communityButton = (community: Community, fullScreen = false) => <button key={community.id} className={styles.community} onClick={() => { if (fullScreen) setCommunitiesOpen(false); onOpenCommunity(community.id); }}><span className={styles.communityAvatar} style={{ backgroundColor: community.accent_color, backgroundImage: community.avatar_url ? `url(${community.avatar_url})` : undefined }}>{community.avatar_url ? "" : community.name.slice(0, 2).toUpperCase()}</span><span className={styles.communityCopy}><strong>{community.name}</strong><small>{stats[community.id]?.online ?? 0} online · {stats[community.id]?.members ?? 0} membros</small></span>{(unreadCounts[community.id] ?? 0) > 0 ? <b>{unreadCounts[community.id] > 99 ? "99+" : unreadCounts[community.id]}</b> : <ArrowUpRight size={16} />}</button>;

  return <section className={styles.home} aria-label="Início">
    <header className={styles.mobileHeader}><button onClick={() => setCommunitiesOpen(true)} aria-label="Abrir comunidades"><Menu size={19}/></button><div className={styles.mobileBrand}><span className="brand-mark">F</span><strong>FYNEX</strong></div><button className={styles.mobileProfile} onClick={onOpenProfilePage} aria-label="Abrir perfil"><i style={{ backgroundColor: profile.color, backgroundImage: profile.avatarUrl ? `url(${profile.avatarUrl})` : undefined }}>{profile.avatarUrl ? "" : profile.name.slice(0, 2).toUpperCase()}</i></button></header>
    <section className={styles.friends}><div className={styles.sectionHeading}><h2>Amigos</h2><button onClick={onOpenFriends}>Ver todos <ChevronRight size={15}/></button></div><div className={styles.friendRail}>{friends.map((friend) => <button key={friend.id} className={styles.friend} onClick={() => onOpenProfile({ ...friend, online: false, roles: [] })}><span className={styles.friendAvatar} style={{ backgroundColor: friend.accent_color, backgroundImage: friend.avatar_url ? `url(${friend.avatar_url})` : undefined }}>{friend.avatar_url ? "" : friend.display_name.slice(0, 2).toUpperCase()}</span><strong>{friend.display_name}</strong></button>)}{!friends.length && <button className={styles.emptyFriends} onClick={onOpenFriends}><Users size={18}/><span><strong>Encontre amigos</strong><small>Adicione pessoas para vê-las aqui.</small></span></button>}</div></section>
    <section className={styles.communities}><div className={styles.sectionHeading}><h2>Comunidades</h2><button onClick={() => setCommunitiesOpen(true)}>Ver todas <ChevronRight size={15}/></button></div><div className={styles.communityList}>{communities.slice(0, 5).map((community) => communityButton(community))}{!communities.length && <button className={styles.emptyCommunity} onClick={onCreateCommunity}><Plus size={18}/><span><strong>Crie sua primeira comunidade</strong><small>Organize conversas, canais de texto e voz.</small></span></button>}</div></section>
    <nav className={styles.mobileNav} aria-label="Navegação principal"><button className={styles.active}><Home size={18}/><span>Início</span></button><button onClick={onOpenMessages}><MessageCircle size={18}/><span>Mensagens</span></button><button onClick={onOpenFriends}><UserPlus size={18}/><span>Amigos</span></button><button onClick={onOpenNotifications}><Bell size={18}/><span>Notificações</span></button></nav>
    {communitiesOpen && <section className={styles.communityScreen} role="dialog" aria-modal="true" aria-label="Comunidades"><header><button onClick={() => setCommunitiesOpen(false)} aria-label="Fechar"><X size={19}/></button><strong>Comunidades</strong><button onClick={onCreateCommunity} aria-label="Criar comunidade"><Plus size={18}/></button></header><div className={styles.communityScreenList}>{communities.map((community) => <article key={community.id}>{communityButton(community, true)}</article>)}</div></section>}
  </section>;
}
