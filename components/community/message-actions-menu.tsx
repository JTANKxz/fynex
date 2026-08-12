"use client";

import { useState } from "react";
import { AtSign, Ban, Reply, Trash2, X } from "lucide-react";
import type { CommunityMessage } from "@/features/community/model";
import styles from "./message-actions-menu.module.css";

const quickReactions = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export type MessageMenuState = { message: CommunityMessage; x: number; y: number };

export function MessageActionsMenu({ state, canDelete, canBan, onReply, onMention, onReaction, onDelete, onBan, onClose }: {
  state: MessageMenuState;
  canDelete: boolean;
  canBan: boolean;
  onReply: () => void;
  onMention: () => void;
  onReaction: (emoji: string) => void;
  onDelete: () => void;
  onBan: () => void;
  onClose: () => void;
}) {
  const [confirmingBan, setConfirmingBan] = useState(false);
  const viewportWidth = typeof window === "undefined" ? state.x + 220 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? state.y + 240 : window.innerHeight;
  return <>
    <button className={styles.dismiss} aria-label="Fechar ações da mensagem" onClick={onClose} />
    <div className={styles.menu} role="menu" style={{ left: Math.max(7, Math.min(state.x, viewportWidth - 321)), top: Math.max(7, Math.min(state.y, viewportHeight - 515)) }}>
      <header><span>Ações da mensagem</span><button onClick={onClose} aria-label="Fechar"><X size={13} /></button></header>
      <div className={styles.quickReactions} aria-label="Reações rápidas">{quickReactions.map((emoji) => <button type="button" key={emoji} onClick={() => onReaction(emoji)} aria-label={`Reagir com ${emoji}`}>{emoji}</button>)}</div>
      <button role="menuitem" onClick={onReply}><Reply size={15} /><span><strong>Responder</strong><small>Vincular sua resposta</small></span></button>
      <button role="menuitem" onClick={onMention}><AtSign size={15} /><span><strong>Mencionar</strong><small>@{state.message.author}</small></span></button>
      {canDelete && <button role="menuitem" className={styles.danger} onClick={onDelete}><Trash2 size={15} /><span><strong>Apagar para todos</strong><small>Remove definitivamente</small></span></button>}
      {canBan && <button role="menuitem" className={styles.danger} onClick={() => confirmingBan ? onBan() : setConfirmingBan(true)}><Ban size={15} /><span><strong>{confirmingBan ? "Confirmar banimento" : "Banir da comunidade"}</strong><small>{confirmingBan ? `Banir @${state.message.author} definitivamente` : "Remove e impede uma nova entrada"}</small></span></button>}
    </div>
  </>;
}
