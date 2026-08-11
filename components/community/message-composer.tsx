"use client";

import { type FormEvent, useRef } from "react";
import { Gift, LoaderCircle, Send, Smile, X } from "lucide-react";
import NextImage from "next/image";
import { CHAT_ATTACHMENT_ACCEPT, formatFileSize, type ChatAttachmentDraft } from "@/lib/media/chat-attachments";
import styles from "./message-composer.module.css";

type MessageComposerProps = {
  attachment: ChatAttachmentDraft | null;
  channelName: string;
  draft: string;
  realtimeConnected: boolean;
  sending: boolean;
  uploadProgress: number;
  onAttachment: (file?: File) => void;
  onDraft: (value: string) => void;
  onRemoveAttachment: () => void;
  onSubmit: (event: FormEvent) => void;
};

export function MessageComposer({ attachment, channelName, draft, realtimeConnected, sending, uploadProgress, onAttachment, onDraft, onRemoveAttachment, onSubmit }: MessageComposerProps) {
  const fileInput = useRef<HTMLInputElement>(null);

  return <form className={styles.composer} onSubmit={onSubmit}>
    {attachment ? <div className={styles.selectedFile}>
      <div className={styles.preview}>
        {attachment.kind === "image"
          ? <NextImage unoptimized src={attachment.previewUrl} alt="Prévia do anexo selecionado" fill sizes="72px" />
          : <video src={attachment.previewUrl} muted playsInline preload="metadata" />}
      </div>
      <div className={styles.fileInfo}>
        <span>{attachment.kind === "image" ? "IMAGEM SELECIONADA" : "VÍDEO SELECIONADO"}</span>
        <strong title={attachment.file.name}>{attachment.file.name}</strong>
        <small>{formatFileSize(attachment.file.size)} · pronto para enviar</small>
        {sending ? <div className={styles.progress} aria-label={`Enviando ${uploadProgress}%`}><i style={{ width: `${uploadProgress}%` }} /></div> : null}
      </div>
      <button className={styles.removeButton} type="button" onClick={onRemoveAttachment} disabled={sending} aria-label="Remover anexo"><X size={16} /></button>
    </div> : null}

    <div className={styles.inputBar}>
      <button className={styles.addButton} type="button" onClick={() => fileInput.current?.click()} disabled={sending} aria-label="Adicionar foto ou vídeo"><span aria-hidden="true">+</span></button>
      <input ref={fileInput} className={styles.fileInput} type="file" accept={CHAT_ATTACHMENT_ACCEPT} disabled={sending} onChange={(event) => { onAttachment(event.target.files?.[0]); event.target.value = ""; }} />
      <input className={styles.textInput} maxLength={2000} value={draft} onChange={(event) => onDraft(event.target.value)} placeholder={realtimeConnected ? `Mensagem em #${channelName}` : "Conectando ao chat..."} />
      <button className={styles.toolButton} type="button" aria-label="Enviar presente"><Gift size={16} /></button>
      <button className={styles.toolButton} type="button" aria-label="Emoji"><Smile size={17} /></button>
      <button className={styles.sendButton} type="submit" disabled={sending || (!draft.trim() && !attachment)} aria-label="Enviar mensagem" onMouseDown={(event) => event.preventDefault()}>
        {sending ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />}
      </button>
    </div>
  </form>;
}
