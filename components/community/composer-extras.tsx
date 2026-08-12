"use client";

import { ImagePlus, ListChecks, Plus, Sticker, X } from "lucide-react";
import NextImage from "next/image";
import { useEffect, useRef, useState } from "react";
import type { CommunitySticker } from "@/lib/supabase/database.types";
import styles from "./composer-extras.module.css";

export type PollDraft = { question: string; options: string[] };

export function ComposerExtras({ disabled, stickers, onMedia, onCreatePoll, onSendSticker }: {
  disabled: boolean;
  stickers: CommunitySticker[];
  onMedia: () => void;
  onCreatePoll: (poll: PollDraft) => void;
  onSendSticker: (stickerId: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);

  useEffect(() => {
    if (!menuOpen && !stickersOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
        setStickersOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [menuOpen, stickersOpen]);

  const submitPoll = () => {
    const cleanQuestion = question.trim();
    const cleanOptions = options.map((option) => option.trim()).filter(Boolean);
    if (!cleanQuestion || cleanOptions.length < 2) return;
    onCreatePoll({ question: cleanQuestion, options: cleanOptions });
    setQuestion("");
    setOptions(["", ""]);
    setPollOpen(false);
  };

  return <div className={styles.root} ref={rootRef}>
    <button className={styles.addButton} type="button" disabled={disabled} aria-label="Abrir opções da mensagem" aria-expanded={menuOpen} onClick={() => { setMenuOpen((open) => !open); setStickersOpen(false); }}><Plus size={18} /></button>
    {menuOpen ? <div className={styles.menu} role="menu">
      <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onMedia(); }}><ImagePlus size={17} /><span><strong>Foto ou vídeo</strong><small>Imagem até 8 MB · vídeo até 20 MB</small></span></button>
      <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setPollOpen(true); }}><ListChecks size={17} /><span><strong>Criar enquete</strong><small>De 2 a 6 opções</small></span></button>
      <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setStickersOpen(true); }}><Sticker size={17} /><span><strong>Figurinhas da comunidade</strong><small>{stickers.length ? `${stickers.length} disponíveis` : "Nenhuma adicionada"}</small></span></button>
    </div> : null}
    {stickersOpen ? <div className={styles.stickerPicker} role="dialog" aria-label="Escolher figurinha">
      <header><span><strong>FIGURINHAS DA COMUNIDADE</strong><small>Só podem ser usadas neste servidor</small></span><button type="button" onClick={() => setStickersOpen(false)} aria-label="Fechar figurinhas"><X size={14} /></button></header>
      {stickers.length ? <div>{stickers.map((sticker) => <button key={sticker.id} type="button" aria-label={`Enviar figurinha ${sticker.name}`} onClick={() => { onSendSticker(sticker.id); setStickersOpen(false); }}><NextImage unoptimized src={sticker.image_url} alt="" width={72} height={72}/><small>{sticker.name}</small></button>)}</div> : <div className={styles.emptyStickers}><Sticker size={24}/><strong>Nenhuma figurinha</strong><small>Adicione imagens nas configurações desta comunidade.</small></div>}
    </div> : null}
    {pollOpen ? <div className={styles.backdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPollOpen(false)}>
      <section className={styles.pollModal} role="dialog" aria-modal="true" aria-labelledby="new-poll-title">
        <header><div><small>ENQUETE</small><h2 id="new-poll-title">Faça uma pergunta</h2></div><button type="button" onClick={() => setPollOpen(false)} aria-label="Fechar"><X size={17} /></button></header>
        <label>Pergunta<input value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={160} autoFocus placeholder="O que você quer perguntar?" /></label>
        <div className={styles.options}><span>OPÇÕES</span>{options.map((option, index) => <label key={index}><i>{index + 1}</i><input value={option} onChange={(event) => setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} maxLength={80} placeholder={`Opção ${index + 1}`} />{options.length > 2 ? <button type="button" onClick={() => setOptions((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remover opção ${index + 1}`}><X size={13} /></button> : null}</label>)}</div>
        {options.length < 6 ? <button className={styles.addOption} type="button" onClick={() => setOptions((current) => [...current, ""])}><Plus size={14} />Adicionar opção</button> : null}
        <footer><button type="button" onClick={() => setPollOpen(false)}>Cancelar</button><button className={styles.primary} type="button" disabled={disabled || !question.trim() || options.filter((option) => option.trim()).length < 2} onClick={submitPoll}>Publicar enquete</button></footer>
      </section>
    </div> : null}
  </div>;
}
