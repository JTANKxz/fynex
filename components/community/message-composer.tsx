"use client";

import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { AtSign, ExternalLink, Link2Off, LoaderCircle, Megaphone, RotateCcw, Send, Smile, X } from "lucide-react";
import NextImage from "next/image";
import { CHAT_ATTACHMENT_ACCEPT, formatFileSize, type ChatAttachmentDraft } from "@/lib/media/chat-attachments";
import type { MemberProfile } from "./member-profile-modal";
import type { LinkPreview } from "@/lib/links";
import styles from "./message-composer.module.css";
import { ComposerExtras, type PollDraft } from "./composer-extras";
import { FynexEmojiPicker } from "@/components/ui/fynex-emoji-picker";
import type { CommunitySticker } from "@/lib/supabase/database.types";
import { ImageCropDialog } from "@/components/ui/image-crop-dialog";

type MessageComposerProps = {
  attachment: ChatAttachmentDraft | null;
  channelName: string;
  draft: string;
  realtimeConnected: boolean;
  sending: boolean;
  uploadProgress: number;
  members: MemberProfile[];
  stickers: CommunitySticker[];
  canMentionEveryone: boolean;
  focusRequestKey?: string | null;
  onAttachment: (file?: File) => void;
  onDraft: (value: string) => void;
  onRemoveAttachment: () => void;
  linkUrl: string | null;
  linkPreviewRemoved: boolean;
  onRemoveLinkPreview: () => void;
  onRestoreLinkPreview: () => void;
  onCreatePoll: (poll: PollDraft) => void;
  onSendSticker: (stickerId: string) => void;
  onSubmit: (event: FormEvent) => void;
};

export function MessageComposer({ attachment, channelName, draft, realtimeConnected, sending, uploadProgress, members, stickers, canMentionEveryone, focusRequestKey, onAttachment, onDraft, onRemoveAttachment, linkUrl, linkPreviewRemoved, onRemoveLinkPreview, onRestoreLinkPreview, onCreatePoll, onSendSticker, onSubmit }: MessageComposerProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const textInput = useRef<HTMLTextAreaElement>(null);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [linkPreviewResult, setLinkPreviewResult] = useState<{ requestedUrl: string; preview: LinkPreview } | null>(null);
  const [linkPreviewLoading, setLinkPreviewLoading] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const mentionMatch = draft.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);
  const mentionQuery = mentionMatch?.[1].toLowerCase() ?? null;
  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const people = members
      .filter((member) => member.username.toLowerCase().includes(mentionQuery) || member.display_name.toLowerCase().includes(mentionQuery))
      .slice(0, canMentionEveryone ? 7 : 8)
      .map((member) => ({ id: member.id, username: member.username, label: member.display_name, avatarUrl: member.avatar_url, color: member.accent_color, everyone: false }));
    return canMentionEveryone && "todos".includes(mentionQuery)
      ? [{ id: "everyone", username: "todos", label: "Notificar todos", avatarUrl: null, color: "#a855f7", everyone: true }, ...people]
      : people;
  }, [canMentionEveryone, members, mentionQuery]);
  const selectMention = (username: string) => {
    onDraft(draft.replace(/(^|\s)@[a-zA-Z0-9_]*$/, `$1@${username} `));
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      setActiveSuggestion((current) => (current + (event.key === "ArrowDown" ? 1 : -1) + suggestions.length) % suggestions.length);
    } else if (suggestions.length && (event.key === "Enter" || event.key === "Tab")) {
      event.preventDefault();
      selectMention(suggestions[activeSuggestion]?.username ?? suggestions[0].username);
    } else if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); }
  };

  useEffect(() => {
    if (!linkUrl || linkPreviewRemoved || linkPreviewResult?.requestedUrl === linkUrl) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLinkPreviewLoading(true);
      void fetch("/api/link-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: linkUrl }),
        signal: controller.signal,
      }).then(async (response) => {
        const result = await response.json() as { preview?: LinkPreview | null };
        if (!controller.signal.aborted && result.preview) setLinkPreviewResult({ requestedUrl: linkUrl, preview: result.preview });
      }).catch(() => undefined).finally(() => {
        if (!controller.signal.aborted) setLinkPreviewLoading(false);
      });
    }, 550);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [linkPreviewRemoved, linkPreviewResult?.requestedUrl, linkUrl]);

  const visibleLinkPreview = !linkPreviewRemoved && linkPreviewResult?.requestedUrl === linkUrl ? linkPreviewResult.preview : null;

  useEffect(() => {
    if (!focusRequestKey) return;
    textInput.current?.focus();
  }, [focusRequestKey]);

  useEffect(() => {
    const textarea = textInput.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, 24), 150);
    textarea.style.height = `${nextHeight}px`;
  }, [draft]);

  return <><form className={styles.composer} onSubmit={onSubmit}>
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

    {linkUrl && linkPreviewRemoved ? <div className={styles.removedLink}><Link2Off size={14} /><span>Prévia do link removida</span><button type="button" onClick={onRestoreLinkPreview}><RotateCcw size={12} />Restaurar</button></div> : null}
    {linkUrl && !linkPreviewRemoved && (visibleLinkPreview || linkPreviewLoading) ? <div className={styles.selectedLink}>
      <ExternalLink size={16} />
      <span>{visibleLinkPreview ? <><small>{visibleLinkPreview.siteName}</small><strong>{visibleLinkPreview.title}</strong></> : <><small>CARREGANDO PRÉVIA</small><strong>{new URL(linkUrl).hostname}</strong></>}</span>
      <button type="button" onClick={onRemoveLinkPreview} aria-label="Remover prévia do link"><X size={15} /></button>
    </div> : null}

    {suggestions.length ? <div className={styles.mentions} role="listbox" aria-label="Pessoas disponíveis para mencionar">
      <header><AtSign size={13} /><span>MENÇÕES</span><small>Enter para escolher</small></header>
      {suggestions.map((suggestion, index) => <button className={index === activeSuggestion ? styles.activeMention : ""} type="button" role="option" aria-selected={index === activeSuggestion} key={suggestion.id} onMouseDown={(event) => event.preventDefault()} onClick={() => selectMention(suggestion.username)}>
        <i style={{ backgroundColor: suggestion.color, backgroundImage: suggestion.avatarUrl ? `url(${suggestion.avatarUrl})` : undefined }}>{suggestion.everyone ? <Megaphone size={14} /> : !suggestion.avatarUrl && suggestion.label.slice(0, 2).toUpperCase()}</i>
        <span><strong>@{suggestion.username}</strong><small>{suggestion.label}</small></span>
        {suggestion.everyone ? <em>ADM</em> : null}
      </button>)}
    </div> : null}

    <div className={styles.inputBar}>
      <ComposerExtras disabled={sending} stickers={stickers} onMedia={() => fileInput.current?.click()} onCreatePoll={onCreatePoll} onSendSticker={onSendSticker} />
      <input ref={fileInput} className={styles.fileInput} type="file" accept={CHAT_ATTACHMENT_ACCEPT} disabled={sending} onChange={(event) => { const file = event.target.files?.[0]; if (file?.type.startsWith("image/") && file.type !== "image/gif") setCropFile(file); else onAttachment(file); event.target.value = ""; }} />
      <textarea ref={textInput} className={styles.textInput} maxLength={2000} rows={1} value={draft} onChange={(event) => onDraft(event.target.value)} onKeyDown={handleKeyDown} placeholder={realtimeConnected ? `Mensagem em #${channelName}` : "Conectando ao chat..."} />
      <div className={styles.emojiRoot}><button className={styles.toolButton} type="button" aria-label="Abrir emojis" aria-expanded={emojiOpen} onClick={() => setEmojiOpen((open) => !open)}><Smile size={17} /></button>{emojiOpen ? <div className={styles.emojiPicker} role="dialog" aria-label="Teclado de emojis"><FynexEmojiPicker onEmoji={(emoji) => onDraft(`${draft}${emoji}`)} /></div> : null}</div>
      <button className={styles.sendButton} type="submit" disabled={sending || (!draft.trim() && !attachment)} aria-label="Enviar mensagem" onMouseDown={(event) => event.preventDefault()}>
        {sending ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />}
      </button>
    </div>
  </form>{cropFile && <ImageCropDialog file={cropFile} kind="chat" onCancel={() => setCropFile(null)} onConfirm={(blob) => { const original = cropFile; setCropFile(null); onAttachment(new File([blob], original.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" })); }} />}</>;
}
