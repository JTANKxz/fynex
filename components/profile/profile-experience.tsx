"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { CalendarDays, Edit3, Palette, ShieldCheck, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { ProfileForm } from "@/components/profile/profile-form";
import type { Profile } from "@/lib/supabase/database.types";

export function ProfileExperience({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const initials = profile.display_name.slice(0, 2).toUpperCase();
  const style = { "--profile-accent": profile.accent_color } as CSSProperties;

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
      <div className="profile-cover"><span>FYNEX IDENTITY</span><Sparkles size={22} /></div>
      <div className="profile-identity-row">
        <div className="profile-avatar-large">{initials}</div>
        <div><span className="profile-status"><i /> DISPONÍVEL</span><h1>{profile.display_name}</h1><strong>@{profile.username}</strong></div>
        <button className="profile-edit-button" onClick={() => setEditing(true)}><Edit3 size={16} />Editar perfil</button>
      </div>
      <div className="profile-content-grid">
        <article className="profile-about"><span>SOBRE MIM</span><p>{profile.bio || "Este espaço está esperando uma descrição que tenha a sua cara."}</p></article>
        <aside className="profile-details">
          <div><CalendarDays size={17} /><span><small>MEMBRO DESDE</small>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(profile.created_at))}</span></div>
          <div><Palette size={17} /><span><small>COR DO CARD</small><b className="profile-color-dot" />{profile.accent_color.toUpperCase()}</span></div>
          <div><ShieldCheck size={17} /><span><small>CONTA</small>Perfil autenticado</span></div>
        </aside>
      </div>
    </section>

    {editing && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setEditing(false)}>
      <section className="profile-edit-modal" role="dialog" aria-modal="true" aria-labelledby="profile-edit-title" style={style}>
        <header><div><span className="auth-eyebrow">PERSONALIZAÇÃO</span><h2 id="profile-edit-title">Editar seu perfil</h2><p>As mudanças aparecem no seu card e nas conversas.</p></div><button onClick={() => setEditing(false)} aria-label="Fechar"><X size={19} /></button></header>
        <ProfileForm profile={profile} onSaved={saved} onCancel={() => setEditing(false)} />
      </section>
    </div>}
  </>;
}
