"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Bell, ChevronRight, Home, Menu, MessageCircle, Plus, Users, X } from "lucide-react";
import type { Community } from "@/lib/supabase/database.types";
import type { MemberProfile } from "@/components/community/member-profile-modal";
import { createClient } from "@/lib/supabase/client";
import styles from "./home-dashboard.module.css";

type Friend = Pick<MemberProfile, "id" | "username" | "display_name" | "bio" | "avatar_url" | "banner_url" | "accent_color" | "created_at">;

export function HomeDashboard({ currentUserId, communities, unreadCounts, onOpenCommunity, onOpenFriends, onOpenMessages, onOpenProfile, onCreateCommunity }: { currentUserId: string; communities: Community[]; unreadCounts: Record<string, number>; onOpenCommunity: (communityId: string) => void; onOpenFriends: () => void; onOpenMessages: () => void; onOpenProfile: (profile: MemberProfile) => void; onCreateCommunity: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [allCommunitiesOpen, setAllCommunitiesOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.from("friendships").select("user_a, user_b").eq("status", "accepted").or(`user_a.eq.${currentUserId},user_b.eq.${currentUserId}`).then(async ({ data }) => {
      const friendIds = (data ?? []).map((friendship) => friendship.user_a === currentUserId ? friendship.user_b : friendship.user_a);
      if (!friendIds.length) { if (active) setFriends([]); return; }
      const { data: profiles } = await supabase.from("profiles").select("id, username, display_name, bio, avatar_url, banner_url, accent_color, created_at").in("id", friendIds).order("display_name");
      if (active) setFriends((profiles ?? []) as Friend[]);
    });
    return () => { active = false; };
  }, [currentUserId, supabase]);

  const visibleCommunities = communities.slice(0, 5);
  const communityButton = (community: Community, closePicker = false) => <button key={community.id} className={styles.community} onClick={() => { if (closePicker) setAllCommunitiesOpen(false); onOpenCommunity(community.id); }}><span className={styles.communityAvatar} style={{ backgroundColor: community.accent_color, backgroundImage: community.avatar_url ? `url(${community.avatar_url})` : undefined }}>{community.avatar_url ? "" : community.name.slice(0, 2).toUpperCase()}</span><span className={styles.communityCopy}><strong>{community.name}</strong><small>{community.description || "Comunidade no FYNEX"}</small></span>{(unreadCounts[community.id] ?? 0) > 0 ? <b>{unreadCounts[community.id] > 99 ? "99+" : unreadCounts[community.id]}</b> : <ArrowUpRight size={16} />}</button>;

  return <section className={styles.home} aria-label="Início">
    <header className={styles.mobileHeader}><button onClick={() => setAllCommunitiesOpen(true)} aria-label="Abrir comunidades"><Menu size={19}/></button><strong>FYNEX</strong><button onClick={onOpenMessages} aria-label="Abrir mensagens"><MessageCircle size={18}/></button></header>
    <section className={styles.friends}><div className={styles.sectionHeading}><h2>Amigos</h2><button onClick={onOpenFriends}>Ver todos <ChevronRight size={15} /></button></div><div className={styles.friendRail}>{friends.map((friend) => <button key={friend.id} className={styles.friend} onClick={() => onOpenProfile({ ...friend, online: false, roles: [] })} aria-label={`Ver perfil de ${friend.display_name}`}><span className={styles.friendAvatar} style={{ backgroundColor: friend.accent_color, backgroundImage: friend.avatar_url ? `url(${friend.avatar_url})` : undefined }}>{friend.avatar_url ? "" : friend.display_name.slice(0, 2).toUpperCase()}</span><strong>{friend.display_name}</strong></button>)}{!friends.length && <button className={styles.emptyFriends} onClick={onOpenFriends}><span><Users size={18} /></span><strong>Encontre amigos</strong><small>Adicione pessoas para vê-las aqui.</small></button>}</div></section>
    <section className={styles.communities}><div className={styles.sectionHeading}><h2>Comunidades</h2><button onClick={() => setAllCommunitiesOpen(true)}>Ver todas <ChevronRight size={15} /></button></div><div className={styles.communityList}>{visibleCommunities.map((community) => communityButton(community))}{!communities.length && <button className={styles.emptyCommunity} onClick={onCreateCommunity}><Plus size={18} /><span><strong>Crie sua primeira comunidade</strong><small>Organize conversas, canais de texto e voz.</small></span></button>}</div></section>
    <nav className={styles.mobileNav} aria-label="Navegação principal"><button className={styles.active}><Home size={18}/><span>Início</span></button><button onClick={onOpenMessages}><MessageCircle size={18}/><span>Mensagens</span></button><button onClick={() => setAllCommunitiesOpen(true)}><Users size={18}/><span>Comunidades</span></button><button onClick={onOpenFriends}><Bell size={18}/><span>Amigos</span></button></nav>
    {allCommunitiesOpen && <div className={styles.allBackdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setAllCommunitiesOpen(false)}><section className={styles.allCommunities} role="dialog" aria-modal="true" aria-label="Todas as comunidades"><header><div><h2>Comunidades</h2><small>{communities.length} no seu espaço</small></div><button onClick={() => setAllCommunitiesOpen(false)} aria-label="Fechar"><X size={18}/></button></header><div>{communities.map((community) => communityButton(community, true))}<button className={styles.newCommunity} onClick={() => { setAllCommunitiesOpen(false); onCreateCommunity(); }}><Plus size={16}/>Criar comunidade</button></div></section></div>}
  </section>;
}
