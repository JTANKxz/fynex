"use client";

import { useActionState, useEffect, useState } from "react";
import { Circle, Moon, Save, X } from "lucide-react";
import { updateProfileAction } from "@/app/actions/profile";
import { ProfileMusicPicker } from "@/components/profile/profile-music-picker";
import { songFromProfile, type SpotifyTrack } from "@/lib/spotify";
import type { Profile } from "@/lib/supabase/database.types";

const palette = ["#8b5cf6", "#a855f7", "#6366f1", "#3b82f6", "#06b6d4", "#14b8a6", "#22c55e", "#eab308", "#f97316", "#ef4444", "#ec4899", "#f5f3ff"];
const statuses = [
  { value: "online", label: "Disponível", detail: "Mostra você online", icon: Circle },
  { value: "idle", label: "Ausente", detail: "Exibe uma lua", icon: Moon },
  { value: "dnd", label: "Não incomodar", detail: "Indicador vermelho", icon: Circle },
  { value: "invisible", label: "Invisível", detail: "Aparece offline", icon: Circle },
] as const;

function hueToHex(hue: number) {
  const f = (n: number) => { const k = (n + hue / 30) % 12; return .6 - .48 * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return `#${[f(0), f(8), f(4)].map((value) => Math.round(value * 255).toString(16).padStart(2, "0")).join("")}`;
}

export function ProfileForm({ profile, onSaved, onCancel }: { profile: Profile; onSaved?: () => void; onCancel?: () => void }) {
  const [state, action, pending] = useActionState(updateProfileAction, {});
  const [color, setColor] = useState(profile.accent_color);
  const [status, setStatus] = useState(profile.presence_status);
  const [song, setSong] = useState<SpotifyTrack | null>(() => songFromProfile(profile));

  useEffect(() => {
    if (!state.success || !onSaved) return;
    const timer = window.setTimeout(onSaved, 450);
    return () => window.clearTimeout(timer);
  }, [onSaved, state.success]);

  return <form action={action} className="profile-form">
    <div className="auth-form-row"><label>Nome de exibição<input name="displayName" defaultValue={profile.display_name} minLength={2} maxLength={50} required /></label><label>Nome de usuário<input name="username" defaultValue={profile.username} minLength={3} maxLength={24} pattern="[a-z0-9_]+" required /></label></div>
    <label>Sobre você<textarea name="bio" defaultValue={profile.bio} maxLength={190} placeholder="Conte um pouco sobre você…" /></label>
    <fieldset className="profile-status-picker"><legend>Privacidade e status</legend><div>{statuses.map((option) => { const Icon = option.icon; return <button type="button" key={option.value} className={`${status === option.value ? "selected" : ""} status-choice-${option.value}`} onClick={() => setStatus(option.value)}><i><Icon size={13} /></i><span><strong>{option.label}</strong><small>{option.detail}</small></span></button>; })}</div><input type="hidden" name="presenceStatus" value={status} /></fieldset>
    <fieldset className="profile-palette"><legend>Cor do perfil</legend><div className="profile-color-preview" style={{ background: color }} /><div className="profile-color-swatches">{palette.map((item) => <button type="button" key={item} className={color.toLowerCase() === item ? "selected" : ""} style={{ background: item }} onClick={() => setColor(item)} aria-label={`Usar cor ${item}`} />)}</div><label>Tom personalizado<input type="range" min="0" max="359" defaultValue="270" onChange={(event) => setColor(hueToHex(Number(event.target.value)))} /></label><input type="hidden" name="accentColor" value={color} /></fieldset>
    <ProfileMusicPicker value={song} onChange={setSong} />
    <input type="hidden" name="songId" value={song?.id ?? ""} /><input type="hidden" name="songName" value={song?.name ?? ""} /><input type="hidden" name="songArtist" value={song?.artist ?? ""} /><input type="hidden" name="songCoverUrl" value={song?.coverUrl ?? ""} /><input type="hidden" name="songPreviewUrl" value={song?.previewUrl ?? ""} /><input type="hidden" name="songSpotifyUrl" value={song?.spotifyUrl ?? ""} />
    {state.error && <p className="form-message error">{state.error}</p>}{state.success && <p className="form-message success">{state.success}</p>}
    <div className="profile-form-actions">{onCancel && <button type="button" className="secondary-button" onClick={onCancel}><X size={16} />Cancelar</button>}<button className="auth-submit" disabled={pending}><Save size={16} />{pending ? "Salvando…" : "Salvar alterações"}</button></div>
  </form>;
}
