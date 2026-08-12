"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Maximize2, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import type { MessageAttachment } from "@/features/community/model";
import styles from "./media-viewer-modal.module.css";

export function MediaViewerModal({ attachment, onClose }: { attachment: MessageAttachment; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const toggle = async () => {
    if (!video.current) return;
    if (video.current.paused) {
      await video.current.play();
      setPlaying(true);
    } else {
      video.current.pause();
      setPlaying(false);
    }
  };

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-label={attachment.name}>
        <header>
          <div>
            <small>{attachment.kind === "image" ? "IMAGEM" : "VÍDEO"}</small>
            <strong>{attachment.name}</strong>
          </div>
          <div className={styles.headerActions}>
            <a href={attachment.url} target="_blank" rel="noopener noreferrer" className={styles.openExternal} title="Abrir original em nova aba" aria-label="Abrir original em nova aba">
              <ExternalLink size={16} />
            </a>
            <button onClick={onClose} aria-label="Fechar visualizador" title="Fechar (Esc)">
              <X size={19} />
            </button>
          </div>
        </header>

        <div className={styles.stage}>
          {attachment.kind === "image" ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={attachment.url} alt={attachment.name} className={styles.image} />
          ) : (
            <video
              ref={video}
              src={attachment.url}
              className={styles.video}
              playsInline
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={() => setProgress(video.current && video.current.duration ? (video.current.currentTime / video.current.duration) * 100 : 0)}
              onEnded={() => setPlaying(false)}
            />
          )}
        </div>

        {attachment.kind === "video" && (
          <footer>
            <button onClick={() => void toggle()} aria-label={playing ? "Pausar" : "Reproduzir"}>
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <input
              className={styles.timeline}
              aria-label="Progresso do vídeo"
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={(event) => {
                if (video.current?.duration) video.current.currentTime = (Number(event.target.value) / 100) * video.current.duration;
                setProgress(Number(event.target.value));
              }}
            />
            <button
              onClick={() => {
                if (video.current) {
                  video.current.muted = !muted;
                  setMuted(!muted);
                }
              }}
              aria-label="Alternar som"
            >
              {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              className={styles.volume}
              aria-label="Volume do vídeo"
              type="range"
              min="0"
              max="100"
              value={Math.round(volume * 100)}
              onChange={(event) => {
                const next = Number(event.target.value) / 100;
                setVolume(next);
                setMuted(next === 0);
                if (video.current) {
                  video.current.volume = next;
                  video.current.muted = next === 0;
                }
              }}
            />
            <button onClick={() => void video.current?.requestFullscreen()} aria-label="Tela cheia">
              <Maximize2 size={18} />
            </button>
          </footer>
        )}
      </section>
    </div>
  );
}
