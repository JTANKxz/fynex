"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { CalendarDays, Edit3, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { ProfileForm } from "@/components/profile/profile-form";
import { ProfileMediaEditor } from "@/components/profile/profile-media-editor";
import { ProfileSongCard } from "@/components/profile/profile-song-card";
import { presenceLabels } from "@/lib/presence";
import { songFromProfile } from "@/lib/spotify";
import type { Profile } from "@/lib/supabase/database.types";

export function ProfileExperience({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const initials = profile.display_name.slice(0, 2).toUpperCase();
  const style = { "--profile-accent": profile.accent_color } as CSSProperties;
  const song = songFromProfile(profile);

  useEffect(() => {
    if (!editing) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setEditing(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [editing]);

  const saved = () => {
    setEditing(false);
    router.refresh();
  };

  return <>
    <section className="profile-stage" style={style}>
      <div className="profile-ambient" />
      <div className={`profile-cover ${profile.banner_url ? "has-image" : ""}`} style={profile.banner_url ? { backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,.08), rgba(0,0,0,.45)), url("${profile.banner_url}")` } : undefined} />
      <div className="profile-identity-row">
        <div className={`profile-avatar-large ${profile.avatar_url ? "has-image" : ""}`} style={profile.avatar_url ? { backgroundImage: `url("${profile.avatar_url}")` } : undefined}>{profile.avatar_url ? null : initials}<i className={`profile-presence status-${profile.presence_status}`} /></div>
        <div><h1>{profile.display_name}</h1><strong>@{profile.username}</strong><span className={`profile-status-label status-${profile.presence_status}`}>{presenceLabels[profile.presence_status]}</span></div>
        <button className="profile-edit-button" onClick={() => setEditing(true)}><Edit3 size={16} />Editar perfil</button>
      </div>
      <div className="profile-content-grid">
        <article className="profile-about"><span>SOBRE MIM</span><p>{profile.bio || "Este espaço está esperando uma descrição que tenha a sua cara."}</p>{song && <ProfileSongCard song={song} />}</article>
        <aside className="profile-details">
          <div><CalendarDays size={17} /><span><small>MEMBRO DESDE</small>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(profile.created_at))}</span></div>
        </aside>
      </div>
    </section>

    {editing && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setEditing(false)}>
      <section className="profile-edit-modal" role="dialog" aria-modal="true" aria-labelledby="profile-edit-title" style={style}>
        <header><div><span className="auth-eyebrow">PERSONALIZAÇÃO</span><h2 id="profile-edit-title">Editar seu perfil</h2><p>As mudanças aparecem no seu card e nas conversas.</p></div><button onClick={() => setEditing(false)} aria-label="Fechar"><X size={19} /></button></header>
        <ProfileMediaEditor profile={profile} onChanged={() => router.refresh()} />
        <ProfileForm profile={profile} onSaved={saved} onCancel={() => setEditing(false)} />
      </section>
    </div>}
  </>;
}
