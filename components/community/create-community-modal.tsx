"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Sparkles, X } from "lucide-react";
import { createCommunityAction } from "@/app/actions/community";

export function CreateCommunityModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (communityId: string) => void }) {
  const [state, action, pending] = useActionState(createCommunityAction, {});
  const [color, setColor] = useState("#8b5cf6");

  useEffect(() => {
    if (state.communityId) onCreated(state.communityId);
  }, [onCreated, state.communityId]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose, open]);

  if (!open) return null;
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="community-modal" role="dialog" aria-modal="true" aria-labelledby="community-modal-title">
      <button className="modal-close" type="button" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
      <span className="modal-icon" style={{ background: color }}><Sparkles size={21} /></span>
      <span className="auth-eyebrow">NOVO ESPAÇO</span>
      <h2 id="community-modal-title">Crie sua comunidade</h2>
      <p>Um espaço independente para conversar, reunir grupos e abrir canais de voz.</p>
      <form action={action} className="community-form">
        <label>Nome da comunidade<input name="name" minLength={2} maxLength={50} placeholder="Ex.: Estúdio Aurora" required autoFocus /></label>
        <label>Descrição<textarea name="description" maxLength={190} placeholder="Sobre o que vocês conversam?" /></label>
        <label>Cor do espaço<div className="color-field"><input name="accentColor" type="color" value={color} onChange={(event) => setColor(event.target.value)} /><span>{color}</span></div></label>
        {state.error && <p className="form-message error">{state.error}</p>}
        <button className="auth-submit" disabled={pending}><Plus size={17} />{pending ? "Criando…" : "Criar comunidade"}</button>
      </form>
    </section>
  </div>;
}
