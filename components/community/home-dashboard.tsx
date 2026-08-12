"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ChevronRight, MessageCircle, Plus, Users } from "lucide-react";
import type { Community } from "@/lib/supabase/database.types";
import type { MemberProfile } from "@/components/community/member-profile-modal";
import { createClient } from "@/lib/supabase/client";
import styles from "./home-dashboard.module.css";

type Friend = Pick<MemberProfile, "id" | "username" | "display_name" | "bio" | "avatar_url" | "banner_url" | "accent_color" | "created_at">;

export function HomeDashboard({ currentUserId, communities, unreadCounts, onOpenCommunity, onOpenFriends, onOpenProfile, onCreateCommunity }: { currentUserId: string; communities: Community[]; unreadCounts: Record<string, number>; onOpenCommunity: (communityId: string) => void; onOpenFriends: () => void; onOpenProfile: (profile: MemberProfile) => void; onCreateCommunity: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [friends, setFriends] = useState<Friend[]>([]);

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

  return <section className={styles.home} aria-label="Início">
    <header className={styles.header}><div><span>SEU ESPAÇO</span><h1>Início</h1><p>Amigos, comunidades e novidades em um só lugar.</p></div><button onClick={onOpenFriends}><Users size={16} />Ver todos os amigos</button></header>
    <section className={styles.friends}><div className={styles.sectionHeading}><div><h2>Amigos</h2><p>Em breve, este espaço também terá Stories.</p></div><button onClick={onOpenFriends}>Ver todos <ChevronRight size={15} /></button></div><div className={styles.friendRail}>{friends.map((friend) => <button key={friend.id} className={styles.friend} onClick={() => onOpenProfile({ ...friend, online: false, roles: [] })} aria-label={`Ver perfil de ${friend.display_name}`}><span className={styles.friendAvatar} style={{ backgroundColor: friend.accent_color, backgroundImage: friend.avatar_url ? `url(${friend.avatar_url})` : undefined }}>{friend.avatar_url ? "" : friend.display_name.slice(0, 2).toUpperCase()}</span><strong>{friend.display_name}</strong></button>)}{!friends.length && <button className={styles.emptyFriends} onClick={onOpenFriends}><span><Users size={18} /></span><strong>Encontre amigos</strong><small>Adicione pessoas para vê-las aqui.</small></button>}</div></section>
    <section className={styles.communities}><div className={styles.sectionHeading}><div><h2>Suas comunidades</h2><p>Abra uma comunidade para acessar seus canais e chamadas.</p></div><button className={styles.create} onClick={onCreateCommunity}><Plus size={15} />Criar comunidade</button></div><div className={styles.communityList}>{communities.map((community) => <button key={community.id} className={styles.community} onClick={() => onOpenCommunity(community.id)}><span className={styles.communityAvatar} style={{ backgroundColor: community.accent_color, backgroundImage: community.avatar_url ? `url(${community.avatar_url})` : undefined }}>{community.avatar_url ? "" : community.name.slice(0, 2).toUpperCase()}</span><span className={styles.communityCopy}><strong>{community.name}</strong><small>{community.description || "Comunidade no FYNEX"}</small></span>{(unreadCounts[community.id] ?? 0) > 0 ? <b>{unreadCounts[community.id] > 99 ? "99+" : unreadCounts[community.id]}</b> : <ArrowUpRight size={16} />}</button>)}{!communities.length && <button className={styles.emptyCommunity} onClick={onCreateCommunity}><Plus size={18} /><span><strong>Crie sua primeira comunidade</strong><small>Organize conversas, canais de texto e voz.</small></span></button>}</div></section>
    <section className={styles.channels}><MessageCircle size={17} /><div><h2>Canais</h2><p>Em breve: siga canais de conteúdo e receba novidades no estilo Telegram.</p></div><span>EM BREVE</span></section>
  </section>;
}
