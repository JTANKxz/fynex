"use client";

import NextImage from "next/image";
import { FileVideo, ImageIcon } from "lucide-react";
import { useState } from "react";
import type { MessageAttachment as Attachment } from "@/features/community/model";
import { formatFileSize } from "@/lib/media/chat-attachments";
import { MediaViewerModal } from "./media-viewer-modal";
import styles from "./message-attachment.module.css";

export function MessageAttachment({ attachment }: { attachment: Attachment }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  if (attachment.kind === "image") return <><button type="button" className={styles.media} onClick={() => setViewerOpen(true)} aria-label={`Abrir ${attachment.name}`}>
    <NextImage className={styles.image} unoptimized src={attachment.url} alt={attachment.name} width={attachment.width ?? 1280} height={attachment.height ?? 960} sizes="(max-width: 700px) 78vw, 520px" />
    <small><ImageIcon size={13} /> <span>{attachment.name}</span><b>{formatFileSize(attachment.size)}</b></small>
  </button>{viewerOpen && <MediaViewerModal attachment={attachment} onClose={() => setViewerOpen(false)} />}</>;

  return <><button type="button" className={styles.media} onClick={() => setViewerOpen(true)} aria-label={`Abrir ${attachment.name}`}>
    <video className={styles.video} muted playsInline preload="metadata" src={attachment.url}>Seu navegador não consegue reproduzir este vídeo.</video>
    <small><FileVideo size={13} /> <span>{attachment.name}</span><b>{formatFileSize(attachment.size)}</b></small>
  </button>{viewerOpen && <MediaViewerModal attachment={attachment} onClose={() => setViewerOpen(false)} />}</>;
}
