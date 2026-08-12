"use client";

import NextImage from "next/image";
import { useActionState, useEffect, useId, useState } from "react";
import { Badge, ImagePlus, LoaderCircle, Plus, Sticker, Tag, Trash2, Upload } from "lucide-react";
import { createCommunityTagAction, deleteCommunityRoleIconAction, deleteCommunityStickerAction, deleteCommunityTagAction, saveCommunityStickerAction } from "@/app/actions/community-identity";
import { FynexColorPicker } from "@/components/ui/fynex-color-picker";
import { uploadToImageKit, type ImageKitUploadToken } from "@/lib/media/imagekit-client";
import { prepareStickerImage } from "@/lib/media/crop-image";
import type { CommunityRoleIcon, CommunitySticker, CommunityTag } from "@/lib/supabase/database.types";
import styles from "./community-library-settings.module.css";
import roleIconStyles from "./community-role-icons.module.css";

export function CommunityLibrarySettings({ communityId, tags, stickers, roleIcons, onChanged }: { communityId: string; tags: CommunityTag[]; stickers: CommunitySticker[]; roleIcons: CommunityRoleIcon[]; onChanged: () => void }) {
  const [tagState, tagAction, tagBusy] = useActionState(createCommunityTagAction, {});
  const [color, setColor] = useState("#6f63d9");
  const [stickerName, setStickerName] = useState("");
  const [stickerFile, setStickerFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const inputId = useId();
  const roleIconInputId = useId();
  const [roleIconName, setRoleIconName] = useState("");
  const [roleIconFile, setRoleIconFile] = useState<File | null>(null);
  const [roleIconBusy, setRoleIconBusy] = useState(false);
  const [roleIconNotice, setRoleIconNotice] = useState("");

  useEffect(() => { if (tagState.success) onChanged(); }, [tagState.success, onChanged]);

  const uploadSticker = async () => {
    if (!stickerFile || !stickerName.trim()) return;
    if (!new Set(["image/png", "image/webp", "image/gif", "image/jpeg"]).has(stickerFile.type) || stickerFile.size > 8_000_000) { setNotice("Use PNG, WebP, GIF ou JPG de até 8 MB."); return; }
    setUploading(true); setNotice("");
    try {
      const response = await fetch("/api/imagekit/upload-token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "community-sticker", communityId }) });
      const token = await response.json() as ImageKitUploadToken;
      if (!response.ok) throw new Error(token.error);
      const prepared = await prepareStickerImage(stickerFile);
      const media = await uploadToImageKit(prepared, token, () => undefined);
      const result = await saveCommunityStickerAction({ communityId, name: stickerName.trim(), ...media });
      if (result.error) throw new Error(result.error);
      setStickerName(""); setStickerFile(null); setNotice(result.success ?? "Figurinha adicionada."); onChanged();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível enviar."); }
    finally { setUploading(false); }
  };
  const removeTag = async (formData: FormData) => { await deleteCommunityTagAction({}, formData); onChanged(); };
  const removeSticker = async (formData: FormData) => { setNotice(""); const result = await deleteCommunityStickerAction({}, formData); setNotice(result.error ?? result.success ?? ""); if (!result.error) onChanged(); };
  const removeRoleIcon = async (formData: FormData) => { await deleteCommunityRoleIconAction({}, formData); onChanged(); };
  const uploadRoleIcon = async () => {
    if (!roleIconFile || !roleIconName.trim()) return;
    const lowerName = roleIconFile.name.toLowerCase();
    if ((!new Set(["image/png", "image/svg+xml"]).has(roleIconFile.type) && !lowerName.endsWith(".png") && !lowerName.endsWith(".svg")) || roleIconFile.size > 256 * 1024) { setRoleIconNotice("Use PNG ou SVG de até 256 KB."); return; }
    setRoleIconBusy(true); setRoleIconNotice("");
    try {
      const body = new FormData();
      body.append("communityId", communityId); body.append("name", roleIconName.trim()); body.append("file", roleIconFile);
      const response = await fetch("/api/community-role-icons", { method: "POST", body });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Não foi possível enviar o ícone.");
      setRoleIconName(""); setRoleIconFile(null); setRoleIconNotice("Ícone adicionado à biblioteca."); onChanged();
    } catch (error) { setRoleIconNotice(error instanceof Error ? error.message : "Não foi possível enviar o ícone."); }
    finally { setRoleIconBusy(false); }
  };

  return <section className={styles.section}>
    <article className={styles.panel}>
      <header><Tag size={16}/><div><h3>Tags da comunidade</h3><p>Crie etiquetas que os membros podem escolher para exibir no perfil.</p></div></header>
      <form action={tagAction} className={styles.tagForm}>
        <input type="hidden" name="communityId" value={communityId}/>
        <label>Nome<input name="name" maxLength={24} required placeholder="Ex.: DEV"/></label>
        <FynexColorPicker compact name="color" value={color} onChange={setColor}/>
        <button disabled={tagBusy}><Plus size={14}/>{tagBusy ? "Criando…" : "Criar tag"}</button>
      </form>
      {tagState.error || tagState.success ? <small className={tagState.error ? styles.error : styles.success}>{tagState.error ?? tagState.success}</small> : null}
      <div className={styles.tags}>{tags.map((tag) => <form action={removeTag} key={tag.id}><span style={{ "--tag-color": tag.color } as React.CSSProperties}><i/>{tag.name}</span><input type="hidden" name="tagId" value={tag.id}/><button aria-label={`Excluir tag ${tag.name}`}><Trash2 size={12}/></button></form>)}{!tags.length ? <p>Nenhuma tag criada.</p> : null}</div>
    </article>
    <article className={styles.panel}>
      <header><Badge size={16}/><div><h3>Ícones de cargo</h3><p>PNG ou SVG seguro de até 256 KB. Máximo de 20 ícones por comunidade.</p></div></header>
      <div className={styles.stickerForm}><label htmlFor={roleIconInputId} className={styles.fileChoice}>{roleIconFile ? <ImagePlus size={15}/> : <Upload size={15}/>}<span>{roleIconFile?.name ?? "Escolher PNG ou SVG"}</span><input id={roleIconInputId} type="file" accept="image/png,image/svg+xml,.svg" onChange={(event) => { setRoleIconFile(event.target.files?.[0] ?? null); event.target.value = ""; }}/></label><input value={roleIconName} onChange={(event) => setRoleIconName(event.target.value)} maxLength={32} placeholder="Nome do ícone"/><button type="button" disabled={roleIconBusy || !roleIconFile || !roleIconName.trim() || roleIcons.length >= 20} onClick={() => void uploadRoleIcon()}>{roleIconBusy ? <LoaderCircle className="spin" size={14}/> : <Plus size={14}/>}Adicionar</button></div>
      {roleIconNotice ? <small className={styles.notice}>{roleIconNotice}</small> : null}
      <div className={roleIconStyles.grid}>{roleIcons.map((icon) => <form action={removeRoleIcon} key={icon.id}><NextImage unoptimized src={icon.image_url} alt={icon.name} width={42} height={42}/><span>{icon.name}</span><small>{Math.ceil(icon.file_size / 1024)} KB</small><input type="hidden" name="iconId" value={icon.id}/><button aria-label={`Excluir ícone ${icon.name}`}><Trash2 size={12}/></button></form>)}{!roleIcons.length ? <p>Nenhum ícone personalizado.</p> : null}</div>
    </article>
    <article className={styles.panel}>
      <header><Sticker size={16}/><div><h3>Figurinhas</h3><p>Imagens exclusivas desta comunidade. PNG, WebP ou JPG são ajustados para 512 px; GIF animado até 1 MB.</p></div></header>
      <div className={styles.stickerForm}><label htmlFor={inputId} className={styles.fileChoice}>{stickerFile ? <ImagePlus size={15}/> : <Upload size={15}/>}<span>{stickerFile?.name ?? "Escolher imagem"}</span><input id={inputId} type="file" accept="image/png,image/webp,image/gif,image/jpeg" onChange={(event) => setStickerFile(event.target.files?.[0] ?? null)}/></label><input value={stickerName} onChange={(event) => setStickerName(event.target.value)} maxLength={32} placeholder="Nome da figurinha"/><button type="button" disabled={uploading || !stickerFile || !stickerName.trim()} onClick={() => void uploadSticker()}>{uploading ? <LoaderCircle className="spin" size={14}/> : <Plus size={14}/>}Adicionar</button></div>
      {notice ? <small className={styles.notice}>{notice}</small> : null}
      <div className={styles.stickers}>{stickers.map((sticker) => <form action={removeSticker} key={sticker.id}><NextImage unoptimized src={sticker.image_url} alt={sticker.name} width={52} height={52}/><span>{sticker.name}</span><input type="hidden" name="stickerId" value={sticker.id}/><button aria-label={`Excluir figurinha ${sticker.name}`}><Trash2 size={12}/></button></form>)}{!stickers.length ? <p>Nenhuma figurinha adicionada.</p> : null}</div>
    </article>
  </section>;
}
