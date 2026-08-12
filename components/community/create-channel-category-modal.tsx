"use client";

import { useActionState, useEffect } from "react";
import { FolderPlus, Trash2, X } from "lucide-react";
import type { ChannelCategory } from "@/lib/supabase/database.types";
import { createChannelCategoryAction, deleteChannelCategoryAction } from "@/app/actions/community";

export function CreateChannelCategoryModal({ communityId, category, onClose, onCreated }: { communityId: string; category?: ChannelCategory; onClose: () => void; onCreated: () => void }) {
  const [state, action, pending] = useActionState(createChannelCategoryAction, {});
  const [deleteState, deleteAction, deleting] = useActionState(deleteChannelCategoryAction, {});
  useEffect(() => { if (state.categoryId) { onCreated(); onClose(); } }, [onClose, onCreated, state.categoryId]);
  useEffect(() => { if (deleteState.categoryId) { onCreated(); onClose(); } }, [deleteState.categoryId, onClose, onCreated]);

  if (category) return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="channel-modal" role="dialog" aria-modal="true" aria-labelledby="category-modal-title"><button className="modal-close" type="button" onClick={onClose} aria-label="Fechar"><X size={18}/></button><span className="auth-eyebrow">ORGANIZAÇÃO</span><h2 id="category-modal-title">{category.name}</h2><p>Excluir esta categoria não exclui os canais: eles ficam fora de categoria.</p><form action={deleteAction} className="community-form"><input type="hidden" name="communityId" value={communityId}/><input type="hidden" name="categoryId" value={category.id}/>{deleteState.error && <p className="form-message error">{deleteState.error}</p>}<button className="auth-submit danger" disabled={deleting}><Trash2 size={17}/>{deleting ? "Excluindo…" : "Excluir categoria"}</button></form></section></div>;

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="channel-modal" role="dialog" aria-modal="true" aria-labelledby="category-modal-title"><button className="modal-close" type="button" onClick={onClose} aria-label="Fechar"><X size={18}/></button><span className="auth-eyebrow">ORGANIZAÇÃO</span><h2 id="category-modal-title">Criar categoria</h2><p>Use categorias para reunir canais de texto e voz no mesmo espaço.</p><form action={action} className="community-form"><input type="hidden" name="communityId" value={communityId}/><label>Nome da categoria<input name="name" minLength={1} maxLength={32} placeholder="Ex.: PROJETOS" required autoFocus/></label>{state.error && <p className="form-message error">{state.error}</p>}<button className="auth-submit" disabled={pending}><FolderPlus size={17}/>{pending ? "Criando…" : "Criar categoria"}</button></form></section></div>;
}
