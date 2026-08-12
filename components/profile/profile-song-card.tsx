"use client";

import { Music2, Pause, Play } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import type { ProfileSong } from "@/lib/spotify";
import { SpotifyEmbedPlayer, type SpotifyEmbedController } from "./spotify-embed-player";

export function ProfileSongCard({ song, compact = false }: { song: ProfileSong; compact?: boolean }) {
  const embedController = useRef<SpotifyEmbedController | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const handlePlayingChange = useCallback((nextPlaying: boolean) => setPlaying(nextPlaying), []);
  const handleReady = useCallback(() => { setReady(true); setUnavailable(false); }, []);
  const handleUnavailable = useCallback(() => { setReady(false); setUnavailable(true); }, []);
  const toggle = () => {
    if (!ready || unavailable) return;
    if (playing) embedController.current?.pause();
    else embedController.current?.playClip();
  };

  const loading = !ready && !unavailable;
  return <article className={`profile-song-card ${compact ? "compact" : ""}`}>
    <div className="profile-song-cover" style={song.coverUrl ? { backgroundImage: `url("${song.coverUrl}")` } : undefined}>{!song.coverUrl && <Music2 size={20} />}</div>
    <div><strong>{song.name}</strong><small>{song.artist} · trecho de 30s</small></div>
    <button type="button" onClick={toggle} disabled={loading || unavailable} aria-label={playing ? "Pausar música" : loading ? "Carregando player" : unavailable ? "Prévia indisponível" : "Ouvir trecho de 30 segundos"} title={unavailable ? "Prévia indisponível para esta faixa" : loading ? "Carregando player do Spotify" : `Ouvir de ${song.startSeconds}s até ${song.startSeconds + 30}s`}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
    <SpotifyEmbedPlayer trackId={song.id} startSeconds={song.startSeconds} controllerRef={embedController} onReady={handleReady} onPlayingChange={handlePlayingChange} onUnavailable={handleUnavailable} />
  </article>;
}
