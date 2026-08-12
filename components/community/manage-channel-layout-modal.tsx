"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, FolderPlus, GripVertical, Layers3, Radio, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FynexSelect } from "@/components/ui/fynex-select";
import type { Channel, ChannelCategory } from "@/lib/supabase/database.types";
import styles from "./manage-channel-layout-modal.module.css";

type Props = { communityId: string; categories: ChannelCategory[]; channels: Channel[]; onClose: () => void; onChanged: () => void; onCreateCategory: () => void; onDeleteCategory: (category: ChannelCategory) => void };

export function ManageChannelLayoutModal({ communityId, categories: initialCategories, channels, onClose, onChanged, onCreateCategory, onDeleteCategory }: Props) {
  const supabase = createClient();
  const [categories, setCategories] = useState(initialCategories);
  const [dragCategoryId, setDragCategoryId] = useState<string | null>(null);
  const [dragChannelId, setDragChannelId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const persistOrder = async (next: ChannelCategory[]) => { setCategories(next); setSaving(true); await Promise.all(next.map((category, position) => supabase.from("channel_categories").update({ position }).eq("id", category.id).eq("community_id", communityId))); setSaving(false); onChanged(); };
  const moveCategory = (id: string, delta: number) => { const from = categories.findIndex((category) => category.id === id); const to = from + delta; if (from < 0 || to < 0 || to >= categories.length) return; const next = [...categories]; const [item] = next.splice(from, 1); next.splice(to, 0, item); void persistOrder(next); };
  const assignChannel = async (channelId: string, categoryId: string) => { setSaving(true); await supabase.from("channels").update({ category_id: categoryId || null }).eq("id", channelId).eq("community_id", communityId); setSaving(false); onChanged(); };
  const rename = async (category: ChannelCategory, name: string) => { const trimmed = name.trim(); if (!trimmed || trimmed === category.name) return; setSaving(true); await supabase.from("channel_categories").update({ name: trimmed }).eq("id", category.id).eq("community_id", communityId); setSaving(false); onChanged(); };
  const dropInto = (categoryId: string) => { if (dragChannelId) { void assignChannel(dragChannelId, categoryId); setDragChannelId(null); } if (dragCategoryId && dragCategoryId !== categoryId) { const from = categories.findIndex((category) => category.id === dragCategoryId); const to = categories.findIndex((category) => category.id === categoryId); const next = [...categories]; const [item] = next.splice(from, 1); next.splice(to, 0, item); void persistOrder(next); setDragCategoryId(null); } };
  const ungrouped = channels.filter((channel) => !channel.category_id);

  return <div className={styles.backdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="channel-layout-title"><header><div><span>ORGANIZAÇÃO</span><h2 id="channel-layout-title">Canais e categorias</h2><p>Arraste no computador. No celular, use os controles de posição e categoria.</p></div><button onClick={onClose} aria-label="Fechar"><X size={18}/></button></header><div className={styles.toolbar}><button onClick={onCreateCategory}><FolderPlus size={15}/>Nova categoria</button><small>{saving ? "Salvando…" : "As alterações são aplicadas na hora"}</small></div><div className={styles.content}><section className={styles.categoryList}>{categories.map((category, index) => <article key={category.id} draggable onDragStart={() => setDragCategoryId(category.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => dropInto(category.id)}><header><GripVertical size={15}/><input aria-label="Nome da categoria" defaultValue={category.name} maxLength={32} onBlur={(event) => void rename(category, event.target.value)}/><span><button disabled={index === 0} onClick={() => moveCategory(category.id, -1)} aria-label="Mover categoria para cima"><ArrowUp size={13}/></button><button disabled={index === categories.length - 1} onClick={() => moveCategory(category.id, 1)} aria-label="Mover categoria para baixo"><ArrowDown size={13}/></button><button onClick={() => onDeleteCategory(category)} aria-label={`Excluir categoria ${category.name}`} title="Excluir categoria"><Trash2 size={13}/></button></span></header><div className={styles.dropZone}>{channels.filter((channel) => channel.category_id === category.id).map((channel) => <ChannelRow key={channel.id} channel={channel} categories={categories} onAssign={assignChannel} onDrag={() => setDragChannelId(channel.id)}/>) }{!channels.some((channel) => channel.category_id === category.id) && <p>Solte um canal aqui</p>}</div></article>)}</section><aside className={styles.ungrouped} onDragOver={(event) => event.preventDefault()} onDrop={() => dragChannelId && void assignChannel(dragChannelId, "")}><h3><Layers3 size={15}/>SEM CATEGORIA</h3>{ungrouped.map((channel) => <ChannelRow key={channel.id} channel={channel} categories={categories} onAssign={assignChannel} onDrag={() => setDragChannelId(channel.id)}/>) }{!ungrouped.length && <p>Todos os canais foram organizados.</p>}</aside></div></section></div>;
}

function ChannelRow({ channel, categories, onAssign, onDrag }: { channel: Channel; categories: ChannelCategory[]; onAssign: (channelId: string, categoryId: string) => Promise<void>; onDrag: () => void }) {
  const [value, setValue] = useState(channel.category_id ?? "");
  return <div className={styles.channelRow} draggable onDragStart={onDrag}><span>{channel.type === "voice" ? <Radio size={14}/> : "#"}{channel.name}</span><FynexSelect value={value} onChange={(next) => { setValue(next); void onAssign(channel.id, next); }} ariaLabel={`Categoria de ${channel.name}`} options={[{ value: "", label: "Sem categoria" }, ...categories.map((category) => ({ value: category.id, label: category.name }))]}/></div>;
}
