"use client";

import { useEffect, useId, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { Camera, ImagePlus, LoaderCircle, Trash2, Upload, X } from "lucide-react";
import { removeProfileMediaAction, saveProfileMediaAction } from "@/app/actions/profile-media";
import { cropImageToWebp } from "@/lib/media/crop-image";
import type { Profile } from "@/lib/supabase/database.types";

type MediaKind = "avatar" | "banner";
type EditorState = { kind: MediaKind; file: File; source: string };
type UploadToken = { token: string; upload: Record<string, string>; error?: string };
type UploadResult = { fileId: string; filePath: string; url: string };

function uploadToImageKit(file: Blob, token: UploadToken, onProgress: (progress: number) => void) {
  return new Promise<UploadResult>((resolve, reject) => {
    const body = new FormData();
    body.append("file", file, token.upload.fileName);
    body.append("token", token.token);
    Object.entries(token.upload).forEach(([key, value]) => body.append(key, value));
    const request = new XMLHttpRequest();
    request.open("POST", "https://upload.imagekit.io/api/v2/files/upload");
    request.responseType = "json";
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error("A conexão com o ImageKit falhou."));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve(request.response as UploadResult);
      else reject(new Error(request.response?.message ?? "O ImageKit recusou o arquivo."));
    };
    request.send(body);
  });
}

export function ProfileMediaEditor({ profile, onChanged }: { profile: Profile; onChanged: () => void }) {
  const avatarInputId = useId();
  const bannerInputId = useId();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState<MediaKind | null>(null);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => () => { if (editor) URL.revokeObjectURL(editor.source); }, [editor]);

  const chooseFile = (kind: MediaKind, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
      setMessage({ type: "error", text: "Escolha uma imagem JPG, PNG ou WebP." });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setMessage({ type: "error", text: "A imagem original pode ter no máximo 8 MB." });
      return;
    }
    setMessage(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setPixels(null);
    setEditor({ kind, file, source: URL.createObjectURL(file) });
  };

  const cancelCrop = () => {
    setEditor(null);
    setProgress(0);
  };

  const saveImage = async () => {
    if (!editor || !pixels) return;
    setBusy(editor.kind);
    setProgress(2);
    setMessage(null);
    try {
      const image = await cropImageToWebp(editor.file, pixels, editor.kind);
      const authResponse = await fetch("/api/imagekit/upload-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: editor.kind }),
      });
      const auth = await authResponse.json() as UploadToken;
      if (!authResponse.ok || !auth.token) throw new Error(auth.error ?? "Não foi possível autorizar o upload.");
      const uploaded = await uploadToImageKit(image, auth, setProgress);
      const result = await saveProfileMediaAction({ kind: editor.kind, ...uploaded });
      if (result.error) throw new Error(result.error);
      setMessage({ type: "success", text: result.success ?? "Imagem atualizada." });
      setEditor(null);
      setProgress(0);
      onChanged();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Não foi possível enviar a imagem." });
    } finally {
      setBusy(null);
    }
  };

  const removeImage = async (kind: MediaKind) => {
    setBusy(kind);
    setMessage(null);
    const result = await removeProfileMediaAction(kind);
    setBusy(null);
    setMessage({ type: result.error ? "error" : "success", text: result.error ?? result.success ?? "Imagem removida." });
    if (!result.error) onChanged();
  };

  if (editor) return <section className="profile-media-crop">
    <header><div><strong>Enquadrar {editor.kind === "avatar" ? "foto" : "banner"}</strong><small>Arraste a imagem e use o controle para ajustar.</small></div><button type="button" onClick={cancelCrop} aria-label="Cancelar recorte"><X size={16} /></button></header>
    <div className={`crop-stage ${editor.kind === "avatar" ? "avatar-crop" : "banner-crop"}`}>
      <Cropper image={editor.source} crop={crop} zoom={zoom} aspect={editor.kind === "avatar" ? 1 : 3} cropShape={editor.kind === "avatar" ? "round" : "rect"} showGrid={editor.kind === "banner"} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, area) => setPixels(area)} onCropAreaChange={(_, area) => setPixels(area)} />
    </div>
    <label className="zoom-control">Zoom<input type="range" min={1} max={3} step={.05} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
    {busy && <div className="upload-progress"><span style={{ width: `${progress}%` }} /><small>{progress < 10 ? "Preparando imagem…" : `Enviando… ${progress}%`}</small></div>}
    <div className="profile-media-actions"><button type="button" className="secondary-button" onClick={cancelCrop} disabled={!!busy}>Cancelar</button><button type="button" className="auth-submit" onClick={() => void saveImage()} disabled={!!busy || !pixels}>{busy ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />}Usar imagem</button></div>
  </section>;

  return <section className="profile-media-editor">
    <div className="profile-media-card banner-card">
      <div className="media-preview" style={profile.banner_url ? { backgroundImage: `url("${profile.banner_url}")` } : { background: profile.accent_color }}><ImagePlus size={21} /></div>
      <div><strong>Banner do perfil</strong><small>Proporção 3:1, estilo Twitter · recomendado 1500 × 500 px</small></div>
      <label className="media-select-button" htmlFor={bannerInputId} aria-disabled={!!busy}><ImagePlus size={14} />{profile.banner_url ? "Trocar" : "Adicionar"}</label>
      {profile.banner_url && <button type="button" className="remove-media" onClick={() => void removeImage("banner")} disabled={!!busy} aria-label="Remover banner">{busy === "banner" ? <LoaderCircle className="spin" size={14} /> : <Trash2 size={14} />}</button>}
      <input id={bannerInputId} className="media-file-input" type="file" accept="image/jpeg,image/png,image/webp" disabled={!!busy} onChange={(event) => { chooseFile("banner", event.target.files?.[0]); event.target.value = ""; }} />
    </div>
    <div className="profile-media-card avatar-card">
      <div className="media-preview" style={profile.avatar_url ? { backgroundImage: `url("${profile.avatar_url}")` } : { background: profile.accent_color }}><Camera size={19} /></div>
      <div><strong>Foto de perfil</strong><small>Proporção 1:1 · recomendado 512 × 512 px</small></div>
      <label className="media-select-button" htmlFor={avatarInputId} aria-disabled={!!busy}><Camera size={14} />{profile.avatar_url ? "Trocar" : "Adicionar"}</label>
      {profile.avatar_url && <button type="button" className="remove-media" onClick={() => void removeImage("avatar")} disabled={!!busy} aria-label="Remover foto de perfil">{busy === "avatar" ? <LoaderCircle className="spin" size={14} /> : <Trash2 size={14} />}</button>}
      <input id={avatarInputId} className="media-file-input" type="file" accept="image/jpeg,image/png,image/webp" disabled={!!busy} onChange={(event) => { chooseFile("avatar", event.target.files?.[0]); event.target.value = ""; }} />
    </div>
    {message && <p className={`form-message ${message.type}`}>{message.text}</p>}
  </section>;
}
