"use client";

import NextImage from "next/image";
import { FileQuestion, ImageIcon, Reply, Video } from "lucide-react";
import type { CommunityMessage } from "@/features/community/model";
import styles from "./message-reply-preview.module.css";

function MediaPreview({ message }: { message: CommunityMessage }) {
  const attachment = message.attachment;
  if (!attachment) return null;
  return <span className={styles.media}>
    {attachment.kind === "image"
      ? <NextImage unoptimized src={attachment.url} alt="" fill sizes="36px" />
      : <video src={attachment.url} muted playsInline preload="metadata" />}
    <i>{attachment.kind === "image" ? <ImageIcon size={10} /> : <Video size={10} />}</i>
  </span>;
}

export function MessageReplyPreview({ message, missing = false, onJump }: { message?: CommunityMessage; missing?: boolean; onJump: () => void }) {
  return <button className={styles.preview} type="button" onClick={onJump}>
    <Reply size={12} />
    {message ? <><MediaPreview message={message} /><span className={styles.copy}><strong>{message.author}</strong><small>{message.content || message.attachment?.name || "Anexo"}</small></span></> : <><span className={styles.fallback}><FileQuestion size={13} /></span><span className={styles.copy}><strong>Mensagem original</strong><small>{missing ? "Não está mais disponível" : "Carregando prévia…"}</small></span></>}
  </button>;
}

export function ReplyComposerPreview({ message, onClose }: { message: CommunityMessage; onClose: () => void }) {
  return <div className={styles.composerPreview}>
    <Reply size={14} />
    <MediaPreview message={message} />
    <span className={styles.copy}><small>Respondendo a</small><strong>{message.author}</strong><em>{message.content || message.attachment?.name || "Anexo"}</em></span>
    <button type="button" onClick={onClose} aria-label="Cancelar resposta">×</button>
  </div>;
}
