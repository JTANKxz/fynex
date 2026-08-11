"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Camera, ImagePlus, LoaderCircle, Save, Trash2, Upload, X } from "lucide-react";
import { updateCommunityAction } from "@/app/actions/community";
import { removeCommunityMediaAction, saveCommunityMediaAction } from "@/app/actions/community-media";
import { cropImageToWebp } from "@/lib/media/crop-image";
import { uploadToImageKit, type ImageKitUploadToken } from "@/lib/media/imagekit-client";
import type { Community } from "@/lib/supabase/database.types";
import styles from "./community-settings-modal.module.css";

type MediaKind = "avatar" | "banner";

function imageSize(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const source = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { resolve({ width: image.naturalWidth, height: image.naturalHeight }); URL.revokeObjectURL(source); };
    image.onerror = () => { reject(new Error("Não foi possível ler a imagem.")); URL.revokeObjectURL(source); };
    image.src = source;
  });
}

async function prepareImage(file: File, kind: MediaKind) {
  const size = await imageSize(file);
  const aspect = kind === "avatar" ? 1 : 16 / 5;
  const current = size.width / size.height;
  const width = current > aspect ? size.height * aspect : size.width;
  const height = current > aspect ? size.height : size.width / aspect;
  return cropImageToWebp(file, { x: (size.width - width) / 2, y: (size.height - height) / 2, width, height }, kind);
}

export function CommunitySettingsModal({ community, onClose, onChanged }: { community: Community; onClose: () => void; onChanged: () => void }) {
  const avatarInputId = useId();
  const bannerInputId = useId();
  const [state, action, pending] = useActionState(updateCommunityAction, {});
  const [color, setColor] = useState(community.accent_color);
  const [busy, setBusy] = useState<MediaKind | null>(null);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const notifiedSuccess = useRef<string | null>(null);

  useEffect(() => {
    if (!state.success || notifiedSuccess.current === state.success) return;
    notifiedSuccess.current = state.success;
    onChanged();
  }, [onChanged, state.success]);

  const upload = async (kind: MediaKind, file?: File) => {
    if (!file) return;
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type) || file.size > 8 * 1024 * 1024) {
      setNotice({ type: "error", text: "Use JPG, PNG ou WebP com no máximo 8 MB." });
      return;
    }
    setBusy(kind);
    setProgress(2);
    setNotice(null);
    try {
      const prepared = await prepareImage(file, kind);
      const response = await fetch("/api/imagekit/upload-token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: `community-${kind}`, communityId: community.id }) });
      const token = await response.json() as ImageKitUploadToken;
      if (!response.ok || !token.token) throw new Error(token.error ?? "Não foi possível autorizar a imagem.");
      const uploaded = await uploadToImageKit(prepared, token, setProgress);
      const result = await saveCommunityMediaAction({ communityId: community.id, kind, ...uploaded });
      if (result.error) throw new Error(result.error);
      setNotice({ type: "success", text: result.success ?? "Imagem atualizada." });
      onChanged();
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Não foi possível enviar a imagem." });
    } finally {
      setBusy(null);
      setProgress(0);
    }
  };

  const remove = async (kind: MediaKind) => {
    setBusy(kind);
    const result = await removeCommunityMediaAction(community.id, kind);
    setBusy(null);
    setNotice({ type: result.error ? "error" : "success", text: result.error ?? result.success ?? "Imagem removida." });
    if (!result.error) onChanged();
  };

  return <div className={styles.backdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="community-settings-title">
      <header><div><span>PERSONALIZAÇÃO</span><h2 id="community-settings-title">Configurar comunidade</h2><p>Nome, identidade visual e apresentação do seu espaço.</p></div><button type="button" onClick={onClose} aria-label="Fechar"><X size={18} /></button></header>
      <div className={styles.media}>
        <article className={styles.bannerCard}><div className={styles.mediaPreview} style={community.banner_url ? { backgroundImage: `url(${community.banner_url})` } : { background: community.accent_color }}><ImagePlus size={19} /></div><span><strong>Banner</strong><small>Recorte panorâmico automático</small></span><label htmlFor={bannerInputId}>{busy === "banner" ? <LoaderCircle className="spin" size={14} /> : <Upload size={14} />}{community.banner_url ? "Trocar" : "Adicionar"}</label>{community.banner_url && <button type="button" onClick={() => void remove("banner")} disabled={!!busy} aria-label="Remover banner"><Trash2 size={14} /></button>}<input id={bannerInputId} type="file" accept="image/jpeg,image/png,image/webp" disabled={!!busy} onChange={(event) => { void upload("banner", event.target.files?.[0]); event.target.value = ""; }} /></article>
        <article className={styles.avatarCard}><div className={styles.mediaPreview} style={community.avatar_url ? { backgroundImage: `url(${community.avatar_url})` } : { background: community.accent_color }}><Camera size={18} /></div><span><strong>Foto da comunidade</strong><small>Recorte quadrado automático</small></span><label htmlFor={avatarInputId}>{busy === "avatar" ? <LoaderCircle className="spin" size={14} /> : <Camera size={14} />}{community.avatar_url ? "Trocar" : "Adicionar"}</label>{community.avatar_url && <button type="button" onClick={() => void remove("avatar")} disabled={!!busy} aria-label="Remover foto"><Trash2 size={14} /></button>}<input id={avatarInputId} type="file" accept="image/jpeg,image/png,image/webp" disabled={!!busy} onChange={(event) => { void upload("avatar", event.target.files?.[0]); event.target.value = ""; }} /></article>
      </div>
      {busy && <div className={styles.progress}><i style={{ width: `${progress}%` }} /><small>Processando imagem… {progress}%</small></div>}
      {notice && <p className={`${styles.notice} ${styles[notice.type]}`}>{notice.text}</p>}
      <form action={action} className={styles.form}>
        <input type="hidden" name="communityId" value={community.id} />
        <label>Nome da comunidade<input name="name" defaultValue={community.name} minLength={2} maxLength={50} required /></label>
        <label>Descrição<textarea name="description" defaultValue={community.description} maxLength={190} /></label>
        <label>Cor da comunidade<div className={styles.colorPicker} style={{ "--selected-color": color } as React.CSSProperties}><input name="accentColor" type="color" value={color} onChange={(event) => setColor(event.target.value)} aria-label="Escolher cor da comunidade" /><span /></div></label>
        {state.error && <p className={`${styles.notice} ${styles.error}`}>{state.error}</p>}{state.success && <p className={`${styles.notice} ${styles.success}`}>{state.success}</p>}
        <button className={styles.save} disabled={pending}><Save size={15} />{pending ? "Salvando…" : "Salvar comunidade"}</button>
      </form>
    </section>
  </div>;
}
