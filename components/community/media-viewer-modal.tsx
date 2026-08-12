"use client";

import NextImage from "next/image";
import { Maximize2, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { useRef, useState } from "react";
import type { MessageAttachment } from "@/features/community/model";
import styles from "./media-viewer-modal.module.css";

export function MediaViewerModal({ attachment, onClose }: { attachment: MessageAttachment; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);
  const toggle = async () => { if (!video.current) return; if (video.current.paused) { await video.current.play(); setPlaying(true); } else { video.current.pause(); setPlaying(false); } };
  return <div className={styles.backdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className={styles.modal} role="dialog" aria-modal="true" aria-label={attachment.name}>
      <header><div><small>{attachment.kind === "image" ? "IMAGEM" : "VÍDEO"}</small><strong>{attachment.name}</strong></div><button onClick={onClose} aria-label="Fechar visualizador"><X size={19} /></button></header>
      <div className={styles.stage}>{attachment.kind === "image" ? <NextImage unoptimized src={attachment.url} alt={attachment.name} width={attachment.width ?? 1600} height={attachment.height ?? 1000} sizes="95vw" /> : <video ref={video} src={attachment.url} playsInline onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={() => setProgress(video.current && video.current.duration ? video.current.currentTime / video.current.duration * 100 : 0)} onEnded={() => setPlaying(false)} />}</div>
      {attachment.kind === "video" && <footer><button onClick={() => void toggle()} aria-label={playing ? "Pausar" : "Reproduzir"}>{playing ? <Pause size={18} /> : <Play size={18} />}</button><input className={styles.timeline} aria-label="Progresso do vídeo" type="range" min="0" max="100" value={progress} onChange={(event) => { if (video.current?.duration) video.current.currentTime = Number(event.target.value) / 100 * video.current.duration; setProgress(Number(event.target.value)); }} /><button onClick={() => { if (video.current) { video.current.muted = !muted; setMuted(!muted); } }} aria-label="Alternar som">{muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}</button><input className={styles.volume} aria-label="Volume do vídeo" type="range" min="0" max="100" value={Math.round(volume * 100)} onChange={(event) => { const next = Number(event.target.value) / 100; setVolume(next); setMuted(next === 0); if (video.current) { video.current.volume = next; video.current.muted = next === 0; } }} /><button onClick={() => void video.current?.requestFullscreen()} aria-label="Tela cheia"><Maximize2 size={18} /></button></footer>}
    </section>
  </div>;
}
