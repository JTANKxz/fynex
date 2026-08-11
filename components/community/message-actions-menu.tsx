"use client";

import { AtSign, Reply, Trash2, X } from "lucide-react";
import type { CommunityMessage } from "@/features/community/model";
import styles from "./message-actions-menu.module.css";

export type MessageMenuState = { message: CommunityMessage; x: number; y: number };

export function MessageActionsMenu({ state, canDelete, onReply, onMention, onDelete, onClose }: { state: MessageMenuState; canDelete: boolean; onReply: () => void; onMention: () => void; onDelete: () => void; onClose: () => void }) {
  const viewportWidth = typeof window === "undefined" ? state.x + 220 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? state.y + 200 : window.innerHeight;
  return <>
    <button className={styles.dismiss} aria-label="Fechar ações da mensagem" onClick={onClose} />
    <div className={styles.menu} role="menu" style={{ left: Math.max(7, Math.min(state.x, viewportWidth - 205)), top: Math.max(7, Math.min(state.y, viewportHeight - 190)) }}>
      <header><span>Ações da mensagem</span><button onClick={onClose} aria-label="Fechar"><X size={13} /></button></header>
      <button role="menuitem" onClick={onReply}><Reply size={15} /><span><strong>Responder</strong><small>Vincular sua resposta</small></span></button>
      <button role="menuitem" onClick={onMention}><AtSign size={15} /><span><strong>Mencionar</strong><small>@{state.message.author}</small></span></button>
      {canDelete && <button role="menuitem" className={styles.danger} onClick={onDelete}><Trash2 size={15} /><span><strong>Apagar para todos</strong><small>Remove definitivamente</small></span></button>}
    </div>
  </>;
}
