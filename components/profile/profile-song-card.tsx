"use client";

import { ExternalLink, Music2, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ProfileSong } from "@/lib/spotify";

export function ProfileSongCard({ song, compact = false }: { song: ProfileSong; compact?: boolean }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => { audio.current?.pause(); }, []);
  const toggle = () => {
    if (!song.previewUrl) return;
    if (!audio.current) {
      audio.current = new Audio(song.previewUrl);
      audio.current.onended = () => setPlaying(false);
    }
    if (playing) audio.current.pause(); else void audio.current.play().catch(() => setPlaying(false));
    setPlaying(!playing);
  };
  return <article className={`profile-song-card ${compact ? "compact" : ""}`}>
    <div className="profile-song-cover" style={song.coverUrl ? { backgroundImage: `url("${song.coverUrl}")` } : undefined}>{!song.coverUrl && <Music2 size={20} />}</div>
    <div><span>MÚSICA DO PERFIL</span><strong>{song.name}</strong><small>{song.artist}</small></div>
    {song.previewUrl ? <button type="button" onClick={toggle} aria-label={playing ? "Pausar prévia" : "Ouvir prévia de 30 segundos"} title="Prévia de 30 segundos">{playing ? <Pause size={15} /> : <Play size={15} />}</button> : <small className="song-no-preview">Sem prévia</small>}
    <a href={song.spotifyUrl} target="_blank" rel="noreferrer" aria-label="Abrir no Spotify"><ExternalLink size={14} /></a>
  </article>;
}
