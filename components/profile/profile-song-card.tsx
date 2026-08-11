"use client";

import { Music2, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ProfileSong } from "@/lib/spotify";
import { SpotifyEmbedPlayer, type SpotifyEmbedController } from "./spotify-embed-player";

export function ProfileSongCard({ song, compact = false }: { song: ProfileSong; compact?: boolean }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const embedController = useRef<SpotifyEmbedController | null>(null);
  const pendingEmbedPlay = useRef(false);
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => { audio.current?.pause(); }, []);
  const handleEmbedPlayingChange = useCallback((nextPlaying: boolean) => setPlaying(nextPlaying), []);
  const handleEmbedReady = useCallback(() => {
    if (!pendingEmbedPlay.current) return;
    pendingEmbedPlay.current = false;
    embedController.current?.togglePlay();
  }, []);
  const toggle = () => {
    if (!song.previewUrl) {
      if (embedController.current) embedController.current.togglePlay();
      else pendingEmbedPlay.current = true;
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
    <div><strong>{song.name}</strong><small>{song.artist}</small></div>
    <button type="button" onClick={toggle} aria-label={playing ? "Pausar música" : "Ouvir música"} title={song.previewUrl ? "Prévia de 30 segundos" : "Ouvir no player do Spotify"}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
    {!song.previewUrl && <SpotifyEmbedPlayer trackId={song.id} title={`${song.name} — ${song.artist}`} controllerRef={embedController} onReady={handleEmbedReady} onPlayingChange={handleEmbedPlayingChange} />}
  </article>;
}
