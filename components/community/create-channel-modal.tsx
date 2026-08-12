"use client";

import { useActionState, useEffect, useState } from "react";
import { Hash, Plus, Radio, Save, Trash2, Users, X } from "lucide-react";
import { createChannelAction, deleteChannelAction, updateChannelAction } from "@/app/actions/community";
import type { Channel } from "@/lib/supabase/database.types";
import type { ChannelCategory } from "@/lib/supabase/database.types";
import { FynexSelect } from "@/components/ui/fynex-select";

type ChannelType = "text" | "voice";

export function CreateChannelModal({ communityId, communityName, initialType, initialCategoryId, channel, onClose, onCreated, onDeleted, categories }: {
  communityId: string;
  communityName: string;
  initialType: ChannelType;
  initialCategoryId?: string | null;
  channel?: Channel | null;
  onClose: () => void;
  onCreated: (channelId: string, type: ChannelType) => void;
  onDeleted?: (channelId: string) => void;
  categories?: ChannelCategory[];
}) {
  const [state, action, pending] = useActionState(channel ? updateChannelAction : createChannelAction, {});
  const [deleteState, deleteAction, deletePending] = useActionState(deleteChannelAction, {});
  const [type, setType] = useState<ChannelType>((channel?.type as ChannelType | undefined) ?? initialType);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [categoryId, setCategoryId] = useState(channel?.category_id ?? initialCategoryId ?? "");

  useEffect(() => {
    if (state.channelId && state.channelType) onCreated(state.channelId, state.channelType);
  }, [onCreated, state.channelId, state.channelType]);
  useEffect(() => {
    if (channel && deleteState.channelId === channel.id) onDeleted?.(channel.id);
  }, [channel, deleteState.channelId, onDeleted]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="channel-modal" role="dialog" aria-modal="true" aria-labelledby="channel-modal-title">
      <button className="modal-close" type="button" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
      <span className="auth-eyebrow">{communityName.toUpperCase()}</span>
      <h2 id="channel-modal-title">{channel ? "Editar canal" : "Criar um canal"}</h2>
      <p>{channel ? "Renomeie o canal, ajuste a capacidade ou exclua este espaço." : "Escolha como as pessoas vão participar deste espaço."}</p>
      <form action={action} className="community-form">
        <input type="hidden" name="communityId" value={communityId} />
        <input type="hidden" name="type" value={type} />
        {channel && <input type="hidden" name="channelId" value={channel.id} />}
        {!channel && <fieldset className="channel-type-picker">
          <legend>Tipo do canal</legend>
          <button type="button" className={type === "text" ? "selected" : ""} onClick={() => setType("text")}><Hash size={19} /><span><strong>Texto</strong><small>Mensagens, links e arquivos persistentes</small></span></button>
          <button type="button" className={type === "voice" ? "selected" : ""} onClick={() => setType("voice")}><Radio size={19} /><span><strong>Voz</strong><small>Conversa ao vivo e compartilhamento de tela</small></span></button>
        </fieldset>}
        <label>Nome do canal<div className="channel-name-field">{type === "text" ? <Hash size={16} /> : <Radio size={16} />}<input name="name" minLength={1} maxLength={32} defaultValue={channel?.name} placeholder={type === "text" ? "projetos" : "jogatina"} required autoFocus /></div></label>
        {type === "voice" && <label>Limite de pessoas<div className="channel-name-field"><Users size={16} /><input name="userLimit" type="number" min={1} max={10} defaultValue={channel?.user_limit ?? 10} required /></div><small className="field-hint">De 1 a 10 pessoas simultâneas.</small></label>}
        <label>Categoria <FynexSelect name="categoryId" value={categoryId} onChange={setCategoryId} ariaLabel="Escolher categoria do canal" placeholder="Sem categoria" options={[{ value: "", label: "Sem categoria", detail: "Exibir na lista principal" }, ...(categories ?? []).map((category) => ({ value: category.id, label: category.name }))]} /></label>
        {state.error && <p className="form-message error">{state.error}</p>}
        <button className="auth-submit" disabled={pending}>{channel ? <Save size={17} /> : <Plus size={17} />}{pending ? "Salvando…" : channel ? "Salvar canal" : `Criar canal de ${type === "text" ? "texto" : "voz"}`}</button>
      </form>
      {channel && <section className="channel-danger-zone">
        {!confirmDelete ? <button type="button" onClick={() => setConfirmDelete(true)}><Trash2 size={14} />Excluir canal</button> : <form action={deleteAction}>
          <input type="hidden" name="communityId" value={communityId} />
          <input type="hidden" name="channelId" value={channel.id} />
          <p>Excluir <strong>{channel.type === "text" ? "#" : ""}{channel.name}</strong>? O histórico deste canal será apagado.</p>
          {deleteState.error && <small>{deleteState.error}</small>}
          <div><button type="button" onClick={() => setConfirmDelete(false)}>Cancelar</button><button type="submit" disabled={deletePending}><Trash2 size={13} />{deletePending ? "Excluindo…" : "Excluir"}</button></div>
        </form>}
      </section>}
    </section>
  </div>;
}
