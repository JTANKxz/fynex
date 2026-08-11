"use client";

import { AtSign, CalendarDays, Crown, ShieldCheck, X } from "lucide-react";
import type { CommunityRole, Profile } from "@/lib/supabase/database.types";
import { ProfileSongCard } from "@/components/profile/profile-song-card";
import { presenceLabels } from "@/lib/presence";
import { songFromProfile } from "@/lib/spotify";
import styles from "./member-profile-modal.module.css";

export type MemberProfile = Pick<Profile, "id" | "username" | "display_name" | "bio" | "avatar_url" | "banner_url" | "accent_color" | "created_at"> & Partial<Pick<Profile, "presence_status" | "profile_song_id" | "profile_song_name" | "profile_song_artist" | "profile_song_cover_url" | "profile_song_preview_url" | "profile_song_spotify_url">> & {
  joinedAt?: string;
  online?: boolean;
  isOwner?: boolean;
  roles?: CommunityRole[];
};

export function MemberProfileModal({ profile, onClose }: { profile: MemberProfile; onClose: () => void }) {
  const initials = profile.display_name.slice(0, 2).toUpperCase();
  const shownStatus = profile.online ? profile.presence_status ?? "online" : "invisible";
  const song = songFromProfile(profile);
  return <div className={styles.backdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className={styles.modal} role="dialog" aria-modal="true" aria-label={`Perfil de ${profile.display_name}`} style={{ "--member-accent": profile.accent_color } as React.CSSProperties}>
      <button className={styles.close} onClick={onClose} aria-label="Fechar perfil"><X size={18} /></button>
      <div className={styles.banner} style={profile.banner_url ? { backgroundImage: `linear-gradient(to bottom, transparent, rgba(4,3,7,.55)), url(${profile.banner_url})` } : undefined} />
      <div className={styles.identity}>
        <div className={styles.avatar} style={profile.avatar_url ? { backgroundImage: `url(${profile.avatar_url})` } : undefined}>{!profile.avatar_url && initials}<i className={styles[shownStatus]} /></div>
        <div><div className={styles.nameLine}><h2>{profile.display_name}</h2>{profile.isOwner && <Crown size={17} aria-label="Criador da comunidade" />}</div><span><AtSign size={13} />{profile.username} · {presenceLabels[shownStatus]}</span></div>
      </div>
      <div className={styles.content}>
        <section><h3>SOBRE MIM</h3><p>{profile.bio || "Este usuário ainda não escreveu uma descrição."}</p></section>
        {song && <ProfileSongCard song={song} compact />}
        <section><h3>CARGOS</h3><div className={styles.roles}>{profile.isOwner && <span style={{ "--role-color": "#f5c451" } as React.CSSProperties}><Crown size={11} />Criador</span>}{profile.roles?.map((role) => <span key={role.id} style={{ "--role-color": role.color } as React.CSSProperties}><ShieldCheck size={11} />{role.name}</span>)}{!profile.isOwner && !profile.roles?.length && <small>Membro</small>}</div></section>
        <section className={styles.dates}><div><CalendarDays size={15} /><span><small>NO FYNEX DESDE</small>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(profile.created_at))}</span></div>{profile.joinedAt && <div><ShieldCheck size={15} /><span><small>NA COMUNIDADE DESDE</small>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(profile.joinedAt))}</span></div>}</section>
      </div>
    </section>
  </div>;
}
