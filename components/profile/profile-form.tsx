"use client";

import { useActionState, useEffect } from "react";
import { Save, X } from "lucide-react";
import { updateProfileAction } from "@/app/actions/profile";
import type { Profile } from "@/lib/supabase/database.types";

export function ProfileForm({ profile, onSaved, onCancel }: { profile: Profile; onSaved?: () => void; onCancel?: () => void }) {
  const [state, action, pending] = useActionState(updateProfileAction, {});

  useEffect(() => {
    if (!state.success || !onSaved) return;
    const timer = window.setTimeout(onSaved, 450);
    return () => window.clearTimeout(timer);
  }, [onSaved, state.success]);

  return <form action={action} className="profile-form">
    <input name="accentColor" type="hidden" value={profile.accent_color} />
    <div className="auth-form-row"><label>Nome de exibição<input name="displayName" defaultValue={profile.display_name} minLength={2} maxLength={50} required /></label><label>Nome de usuário<input name="username" defaultValue={profile.username} minLength={3} maxLength={24} pattern="[a-z0-9_]+" required /></label></div>
    <label>Sobre você<textarea name="bio" defaultValue={profile.bio} maxLength={190} placeholder="Conte um pouco sobre você…" /></label>
    {state.error && <p className="form-message error">{state.error}</p>}{state.success && <p className="form-message success">{state.success}</p>}
    <div className="profile-form-actions">{onCancel && <button type="button" className="secondary-button" onClick={onCancel}><X size={16} />Cancelar</button>}<button className="auth-submit" disabled={pending}><Save size={16} />{pending ? "Salvando…" : "Salvar alterações"}</button></div>
  </form>;
}
