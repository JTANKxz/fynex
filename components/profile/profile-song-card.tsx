"use client";

import { ExternalLink, Music2, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ProfileSong } from "@/lib/spotify";
import { SpotifyEmbedPlayer, type SpotifyEmbedController } from "./spotify-embed-player";

export function ProfileSongCard({ song, compact = false }: { song: ProfileSong; compact?: boolean }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const embedController = useRef<SpotifyEmbedController | null>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => { audio.current?.pause(); }, []);
  const handleEmbedPlayingChange = useCallback((nextPlaying: boolean) => setPlaying(nextPlaying), []);
  const toggle = () => {
    if (!song.previewUrl) {
      embedController.current?.togglePlay();
      return;
    }
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
    <button type="button" onClick={toggle} aria-label={playing ? "Pausar música" : "Ouvir música"} title={song.previewUrl ? "Prévia de 30 segundos" : "Ouvir no player do Spotify"}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
    <a href={song.spotifyUrl} target="_blank" rel="noreferrer" aria-label="Abrir no Spotify"><ExternalLink size={14} /></a>
    {!song.previewUrl && <SpotifyEmbedPlayer trackId={song.id} title={`${song.name} — ${song.artist}`} controllerRef={embedController} onPlayingChange={handleEmbedPlayingChange} />}
  </article>;
}
