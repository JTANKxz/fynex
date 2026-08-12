"use client";

import { useActionState, useCallback, useEffect, useId, useRef, useState } from "react";
import { Ban, Camera, ImagePlus, LoaderCircle, Save, Settings2, ShieldCheck, Sticker, Trash2, Upload, X } from "lucide-react";
import { deleteCommunityAction, updateCommunityAction } from "@/app/actions/community";
import { removeCommunityMediaAction, saveCommunityMediaAction } from "@/app/actions/community-media";
import { ImageCropDialog } from "@/components/ui/image-crop-dialog";
import { FynexColorPicker } from "@/components/ui/fynex-color-picker";
import { uploadToImageKit, type ImageKitUploadToken } from "@/lib/media/imagekit-client";
import type { Community } from "@/lib/supabase/database.types";
import type { CommunityRoleIcon, CommunitySticker, CommunityTag } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";
import { CommunityLibrarySettings } from "./community-library-settings";
import { BanRow } from "./ban-row";
import styles from "./community-settings-modal.module.css";

type MediaKind = "avatar" | "banner";

export function CommunitySettingsModal({ community, canDelete, onClose, onChanged, onDeleted, onAccentPreview }: { community: Community; canDelete: boolean; onClose: () => void; onChanged: () => void; onDeleted: () => void; onAccentPreview?: (color: string) => void }) {
  const avatarInputId = useId();
  const bannerInputId = useId();
  const [state, action, pending] = useActionState(updateCommunityAction, {});
  const [deleteState, deleteAction, deletePending] = useActionState(deleteCommunityAction, {});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [color, setColor] = useState(community.accent_color);
  const savedAccent = useRef(community.accent_color);
  const [busy, setBusy] = useState<MediaKind | null>(null);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [cropEditor, setCropEditor] = useState<{ kind: MediaKind; file: File } | null>(null);
  const [tab, setTab] = useState<"identity" | "tags" | "moderation" | "danger">("identity");
  const notifiedSuccess = useRef<string | null>(null);
  const [tags, setTags] = useState<CommunityTag[]>([]);
  const [stickers, setStickers] = useState<CommunitySticker[]>([]);
  const [roleIcons, setRoleIcons] = useState<CommunityRoleIcon[]>([]);
  const [bans, setBans] = useState<{ user_id: string; banned_by: string; created_at: string; reason: string; profile?: { display_name: string; username: string; avatar_url: string | null; accent_color: string } }[]>([]);
  const refreshLibrary = useCallback(async () => {
    const supabase = createClient();
    const [tagResult, stickerResult, roleIconResult] = await Promise.all([supabase.from("community_tags").select("*").eq("community_id", community.id).order("created_at"), supabase.from("community_stickers").select("*").eq("community_id", community.id).order("created_at"), supabase.from("community_role_icons").select("*").eq("community_id", community.id).order("created_at")]);
    if (tagResult.data) setTags(tagResult.data); if (stickerResult.data) setStickers(stickerResult.data); if (roleIconResult.data) setRoleIcons(roleIconResult.data);
  }, [community.id]);
  useEffect(() => {
    const refreshTimer = window.setTimeout(() => void refreshLibrary(), 0);
    return () => window.clearTimeout(refreshTimer);
  }, [refreshLibrary]);
  const refreshBans = useCallback(async () => { const supabase = createClient(); const { data } = await supabase.from("community_bans").select("user_id,banned_by,created_at,reason").eq("community_id", community.id).order("created_at", { ascending: false }); const ids = (data ?? []).map((ban) => ban.user_id); const { data: profiles } = ids.length ? await supabase.from("profiles").select("id,display_name,username,avatar_url,accent_color").in("id", ids) : { data: [] }; const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile])); setBans((data ?? []).map((ban) => ({ ...ban, profile: profileMap.get(ban.user_id) }))); }, [community.id]);
  useEffect(() => { if (tab === "moderation") void refreshBans(); }, [refreshBans, tab]);

  useEffect(() => {
    if (!state.success || notifiedSuccess.current === state.success) return;
    notifiedSuccess.current = state.success;
    savedAccent.current = color;
    onChanged();
  }, [color, onChanged, state.success]);

  useEffect(() => {
    if (deleteState.success) onDeleted();
  }, [deleteState.success, onDeleted]);

  const upload = async (kind: MediaKind, prepared: Blob) => {
    setBusy(kind);
    setProgress(2);
    setNotice(null);
    try {
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

  const chooseMedia = (kind: MediaKind, file?: File) => {
    if (!file) return;
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type) || file.size > 8 * 1024 * 1024) {
      setNotice({ type: "error", text: "Use JPG, PNG ou WebP com no máximo 8 MB." });
      return;
    }
    setNotice(null);
    setCropEditor({ kind, file });
  };

  const remove = async (kind: MediaKind) => {
    setBusy(kind);
    const result = await removeCommunityMediaAction(community.id, kind);
    setBusy(null);
    setNotice({ type: result.error ? "error" : "success", text: result.error ?? result.success ?? "Imagem removida." });
    if (!result.error) onChanged();
  };

  const close = () => { onAccentPreview?.(savedAccent.current); onClose(); };
  return <div className={styles.backdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
    <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="community-settings-title">
      <header><div><span>PERSONALIZAÇÃO</span><h2 id="community-settings-title">Configurar comunidade</h2><p>Nome, identidade visual e apresentação do seu espaço.</p></div><button type="button" onClick={onClose} aria-label="Fechar"><X size={18} /></button></header>
      <div className={styles.settingsLayout}><nav className={styles.sideNav}><button className={tab === "identity" ? styles.activeTab : ""} onClick={() => setTab("identity")}><Settings2 size={15}/>Perfil da comunidade</button><button className={tab === "tags" ? styles.activeTab : ""} onClick={() => setTab("tags")}><Sticker size={15}/>Tags e figurinhas</button><button className={tab === "moderation" ? styles.activeTab : ""} onClick={() => setTab("moderation")}><ShieldCheck size={15}/>Moderação</button>{canDelete && <button className={tab === "danger" ? styles.activeTab : ""} onClick={() => setTab("danger")}><Trash2 size={15}/>Zona de risco</button>}</nav><div className={styles.tabContent}>
      {tab === "identity" && <div className={styles.media}>
        <article className={styles.bannerCard}><div className={styles.mediaPreview} style={community.banner_url ? { backgroundImage: `url(${community.banner_url})` } : { background: community.accent_color }}><ImagePlus size={19} /></div><span><strong>Banner</strong><small>Proporção 3:1 · recomendado 1500 × 500 px</small></span><label htmlFor={bannerInputId}>{busy === "banner" ? <LoaderCircle className="spin" size={14} /> : <Upload size={14} />}{community.banner_url ? "Trocar" : "Adicionar"}</label>{community.banner_url && <button type="button" onClick={() => void remove("banner")} disabled={!!busy} aria-label="Remover banner"><Trash2 size={14} /></button>}<input id={bannerInputId} type="file" accept="image/jpeg,image/png,image/webp" disabled={!!busy} onChange={(event) => { chooseMedia("banner", event.target.files?.[0]); event.target.value = ""; }} /></article>
        <article className={styles.avatarCard}><div className={styles.mediaPreview} style={community.avatar_url ? { backgroundImage: `url(${community.avatar_url})` } : { background: community.accent_color }}><Camera size={18} /></div><span><strong>Foto da comunidade</strong><small>Proporção 1:1 · recomendado 512 × 512 px</small></span><label htmlFor={avatarInputId}>{busy === "avatar" ? <LoaderCircle className="spin" size={14} /> : <Camera size={14} />}{community.avatar_url ? "Trocar" : "Adicionar"}</label>{community.avatar_url && <button type="button" onClick={() => void remove("avatar")} disabled={!!busy} aria-label="Remover foto"><Trash2 size={14} /></button>}<input id={avatarInputId} type="file" accept="image/jpeg,image/png,image/webp" disabled={!!busy} onChange={(event) => { chooseMedia("avatar", event.target.files?.[0]); event.target.value = ""; }} /></article>
      </div>}
      {busy && <div className={styles.progress}><i style={{ width: `${progress}%` }} /><small>Processando imagem… {progress}%</small></div>}
      {notice && <p className={`${styles.notice} ${styles[notice.type]}`}>{notice.text}</p>}
      {tab === "identity" && <form action={action} className={styles.form}>
        <input type="hidden" name="communityId" value={community.id} />
        <label>Nome da comunidade<input name="name" defaultValue={community.name} minLength={2} maxLength={50} required /></label>
        <label>Descrição<textarea name="description" defaultValue={community.description} maxLength={190} /></label>
        <label>Cor da comunidade<FynexColorPicker name="accentColor" value={color} onChange={(nextColor) => { setColor(nextColor); onAccentPreview?.(nextColor); }} /></label>
        {state.error && <p className={`${styles.notice} ${styles.error}`}>{state.error}</p>}{state.success && <p className={`${styles.notice} ${styles.success}`}>{state.success}</p>}
        <button className={styles.save} disabled={pending}><Save size={15} />{pending ? "Salvando…" : "Salvar comunidade"}</button>
      </form>}
      {tab === "tags" && <CommunityLibrarySettings communityId={community.id} tags={tags} stickers={stickers} roleIcons={roleIcons} onChanged={() => { void refreshLibrary(); onChanged(); }} />}
      {tab === "moderation" && <section className={styles.bans}><header><Ban size={17}/><div><h3>Membros banidos</h3><p>Remova um banimento para permitir que a pessoa entre novamente.</p></div></header>{bans.map((ban) => <BanRow key={ban.user_id} communityId={community.id} ban={ban} onChanged={() => void refreshBans()}/>) }{!bans.length && <p className={styles.emptyBans}>Nenhum membro banido nesta comunidade.</p>}</section>}
      {tab === "danger" && canDelete && <section className={styles.dangerZone}>
        <div><strong>Excluir comunidade</strong><small>Mensagens, canais, cargos e convites serão apagados permanentemente.</small></div>
        {!deleteOpen ? <button type="button" onClick={() => setDeleteOpen(true)}><Trash2 size={15} />Excluir comunidade</button> : <form action={deleteAction}>
          <input type="hidden" name="communityId" value={community.id} />
          <label>Digite <strong>{community.name}</strong> para confirmar<input name="confirmationName" autoComplete="off" required /></label>
          {deleteState.error && <p className={`${styles.notice} ${styles.error}`}>{deleteState.error}</p>}
          <div><button type="button" onClick={() => setDeleteOpen(false)}>Cancelar</button><button type="submit" disabled={deletePending}><Trash2 size={14} />{deletePending ? "Excluindo…" : "Excluir definitivamente"}</button></div>
        </form>}
      </section>}</div></div>
    </section>
    {cropEditor && <ImageCropDialog file={cropEditor.file} kind={cropEditor.kind} onCancel={() => setCropEditor(null)} onConfirm={(blob) => { const kind = cropEditor.kind; setCropEditor(null); void upload(kind, blob); }} />}
  </div>;
}
