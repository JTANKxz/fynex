import { ExternalLink } from "lucide-react";
import type { LinkPreview } from "@/lib/links";
import styles from "./message-link-preview.module.css";

export function MessageLinkPreview({ preview }: { preview: LinkPreview }) {
  return <a className={styles.card} href={preview.url} target="_blank" rel="noopener noreferrer" title={`Abrir ${preview.siteName}`}>
    <span className={styles.accent} />
    <span className={styles.content}>
      <small>{preview.siteName}<ExternalLink size={11} /></small>
      <strong>{preview.title}</strong>
      {preview.description ? <p>{preview.description}</p> : null}
    </span>
  </a>;
}
