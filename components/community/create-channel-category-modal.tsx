"use client";

import { useActionState, useEffect } from "react";
import { FolderPlus, X } from "lucide-react";
import { createChannelCategoryAction } from "@/app/actions/community";

export function CreateChannelCategoryModal({ communityId, onClose, onCreated }: { communityId: string; onClose: () => void; onCreated: () => void }) {
  const [state, action, pending] = useActionState(createChannelCategoryAction, {});
  useEffect(() => { if (state.categoryId) { onCreated(); onClose(); } }, [onClose, onCreated, state.categoryId]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="channel-modal" role="dialog" aria-modal="true" aria-labelledby="category-modal-title"><button className="modal-close" type="button" onClick={onClose} aria-label="Fechar"><X size={18}/></button><span className="auth-eyebrow">ORGANIZAÇÃO</span><h2 id="category-modal-title">Criar categoria</h2><p>Use categorias para reunir canais de texto e voz no mesmo espaço.</p><form action={action} className="community-form"><input type="hidden" name="communityId" value={communityId}/><label>Nome da categoria<input name="name" minLength={1} maxLength={32} placeholder="Ex.: PROJETOS" required autoFocus/></label>{state.error && <p className="form-message error">{state.error}</p>}<button className="auth-submit" disabled={pending}><FolderPlus size={17}/>{pending ? "Criando…" : "Criar categoria"}</button></form></section></div>;
}
