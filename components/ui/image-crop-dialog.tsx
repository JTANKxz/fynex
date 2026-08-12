"use client";

import { useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { Check, LoaderCircle, X } from "lucide-react";
import { cropChatImageToWebp, cropImageToWebp } from "@/lib/media/crop-image";
import styles from "./image-crop-dialog.module.css";

type CropKind = "avatar" | "banner" | "chat";

export function ImageCropDialog({ file, kind, onCancel, onConfirm }: { file: File; kind: CropKind; onCancel: () => void; onConfirm: (blob: Blob) => void }) {
  const [source] = useState(() => URL.createObjectURL(file));
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [ratio, setRatio] = useState(kind === "avatar" ? 1 : kind === "banner" ? 3 : 4 / 3);
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    if (!pixels || busy) return;
    setBusy(true);
    try { onConfirm(kind === "chat" ? await cropChatImageToWebp(file, pixels) : await cropImageToWebp(file, pixels, kind)); }
    finally { URL.revokeObjectURL(source); setBusy(false); }
  };
  const cancel = () => { URL.revokeObjectURL(source); onCancel(); };
  return <div className={styles.backdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && cancel()}>
    <section className={styles.modal} role="dialog" aria-modal="true" aria-label="Editor de corte de imagem">
      <header><div><strong>Ajustar imagem</strong><small>Arraste para enquadrar e use o zoom.</small></div><button onClick={cancel} aria-label="Cancelar"><X size={17} /></button></header>
      <div className={`${styles.stage} ${kind === "avatar" ? styles.round : ""}`}><Cropper image={source} crop={crop} zoom={zoom} aspect={ratio} cropShape={kind === "avatar" ? "round" : "rect"} showGrid={kind !== "avatar"} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, area) => setPixels(area)} /></div>
      {kind === "chat" && <div className={styles.ratios}><span>Formato</span>{[{ value: 1, label: "1:1" }, { value: 4 / 3, label: "4:3" }, { value: 16 / 9, label: "16:9" }].map((option) => <button className={ratio === option.value ? styles.active : ""} key={option.label} onClick={() => setRatio(option.value)}>{option.label}</button>)}</div>}
      <label className={styles.zoom}>Zoom<input type="range" min="1" max="3" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
      <footer><button onClick={cancel}>Cancelar</button><button className={styles.primary} disabled={!pixels || busy} onClick={() => void confirm()}>{busy ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}Usar imagem</button></footer>
    </section>
  </div>;
}
