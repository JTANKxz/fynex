import NextImage from "next/image";
import { FileVideo, ImageIcon } from "lucide-react";
import type { MessageAttachment as Attachment } from "@/features/community/model";
import { formatFileSize } from "@/lib/media/chat-attachments";
import styles from "./message-attachment.module.css";

export function MessageAttachment({ attachment }: { attachment: Attachment }) {
  if (attachment.kind === "image") return <a className={styles.media} href={attachment.url} target="_blank" rel="noreferrer" aria-label={`Abrir ${attachment.name}`}>
    <NextImage className={styles.image} unoptimized src={attachment.url} alt={attachment.name} width={attachment.width ?? 1280} height={attachment.height ?? 960} sizes="(max-width: 700px) 78vw, 520px" />
    <small><ImageIcon size={13} /> <span>{attachment.name}</span><b>{formatFileSize(attachment.size)}</b></small>
  </a>;

  return <div className={styles.media}>
    <video className={styles.video} controls playsInline preload="metadata" src={attachment.url}>Seu navegador não consegue reproduzir este vídeo.</video>
    <small><FileVideo size={13} /> <span>{attachment.name}</span><b>{formatFileSize(attachment.size)}</b></small>
  </div>;
}
