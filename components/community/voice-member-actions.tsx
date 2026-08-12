"use client";

import { MicOff, MoreHorizontal, PhoneOff, X } from "lucide-react";
import { useEffect, useRef } from "react";
import styles from "./voice-member-actions.module.css";

export type VoiceMemberMenuState = { memberId: string; channelId: string; name: string; x: number; y: number };

export function VoiceMemberActions({ name, onOpen }: { name: string; onOpen: (x: number, y: number) => void }) {
  return <span className={styles.actions} onClick={(event) => event.stopPropagation()}>
    <button type="button" onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); onOpen(rect.right - 210, rect.bottom + 5); }} aria-label={`Abrir ações de ${name}`} title="Ações do participante"><MoreHorizontal size={14} /></button>
  </span>;
}

export function VoiceMemberMenu({ state, onMute, onDisconnect, onClose }: { state: VoiceMemberMenuState; onMute: () => void; onDisconnect: () => void; onClose: () => void }) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) onClose(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("pointerdown", close);
    window.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); window.removeEventListener("keydown", escape); };
  }, [onClose]);

  return <div ref={menuRef} className={styles.menu} role="menu" style={{ left: Math.max(8, Math.min(state.x, window.innerWidth - 228)), top: Math.max(8, Math.min(state.y, window.innerHeight - 150)) }}>
    <header><span><small>MODERAR NA CHAMADA</small><strong>{state.name}</strong></span><button type="button" onClick={onClose} aria-label="Fechar"><X size={13} /></button></header>
    <button type="button" role="menuitem" onClick={onMute}><MicOff size={15} /><span><strong>Silenciar na chamada</strong><small>Desativa o microfone para todos</small></span></button>
    <button className={styles.danger} type="button" role="menuitem" onClick={onDisconnect}><PhoneOff size={15} /><span><strong>Remover da chamada</strong><small>Desconecta este participante</small></span></button>
  </div>;
}
