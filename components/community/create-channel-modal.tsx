"use client";

import { useActionState, useEffect, useState } from "react";
import { Hash, Plus, Radio, X } from "lucide-react";
import { createChannelAction } from "@/app/actions/community";

type ChannelType = "text" | "voice";

export function CreateChannelModal({ communityId, communityName, initialType, onClose, onCreated }: { communityId: string; communityName: string; initialType: ChannelType; onClose: () => void; onCreated: (channelId: string, type: ChannelType) => void }) {
  const [state, action, pending] = useActionState(createChannelAction, {});
  const [type, setType] = useState<ChannelType>(initialType);

  useEffect(() => {
    if (state.channelId && state.channelType) onCreated(state.channelId, state.channelType);
  }, [onCreated, state.channelId, state.channelType]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="channel-modal" role="dialog" aria-modal="true" aria-labelledby="channel-modal-title">
      <button className="modal-close" type="button" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
      <span className="auth-eyebrow">{communityName.toUpperCase()}</span>
      <h2 id="channel-modal-title">Criar um canal</h2>
      <p>Escolha como as pessoas vão participar deste espaço.</p>
      <form action={action} className="community-form">
        <input type="hidden" name="communityId" value={communityId} />
        <input type="hidden" name="type" value={type} />
        <fieldset className="channel-type-picker">
          <legend>Tipo do canal</legend>
          <button type="button" className={type === "text" ? "selected" : ""} onClick={() => setType("text")}><Hash size={19} /><span><strong>Texto</strong><small>Mensagens, links e arquivos persistentes</small></span></button>
          <button type="button" className={type === "voice" ? "selected" : ""} onClick={() => setType("voice")}><Radio size={19} /><span><strong>Voz</strong><small>Conversa ao vivo e compartilhamento de tela</small></span></button>
        </fieldset>
        <label>Nome do canal<div className="channel-name-field">{type === "text" ? <Hash size={16} /> : <Radio size={16} />}<input name="name" minLength={1} maxLength={32} placeholder={type === "text" ? "projetos" : "jogatina"} required autoFocus /></div></label>
        {state.error && <p className="form-message error">{state.error}</p>}
        <button className="auth-submit" disabled={pending}><Plus size={17} />{pending ? "Criando…" : `Criar canal de ${type === "text" ? "texto" : "voz"}`}</button>
      </form>
    </section>
  </div>;
}
