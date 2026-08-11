"use client";

import { LoaderCircle, Music2, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import type { SpotifyTrack } from "@/lib/spotify";
import { ProfileSongCard } from "./profile-song-card";

export function ProfileMusicPicker({ value, onChange }: { value: SpotifyTrack | null; onChange: (track: SpotifyTrack | null) => void }) {
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const search = async () => {
    if (query.trim().length < 2) return;
    setLoading(true); setError(""); setSearched(false);
    try {
      const response = await fetch(`/api/spotify/search?q=${encodeURIComponent(query.trim())}`);
      const data = await response.json() as { tracks?: SpotifyTrack[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Busca indisponível.");
      setTracks(data.tracks ?? []);
      setSearched(true);
    } catch (error) { setError(error instanceof Error ? error.message : "Busca indisponível."); }
    finally { setLoading(false); }
  };
  return <section className="profile-music-picker">
    <div className="profile-section-title"><Music2 size={15} /><div><strong>Música no perfil</strong><small>Escolha uma faixa; a prévia de 30 s depende da disponibilidade no Spotify.</small></div></div>
    {value && <div className="selected-profile-song"><ProfileSongCard song={value} compact /><button type="button" onClick={() => onChange(null)}><Trash2 size={14} />Remover</button></div>}
    <div className="profile-music-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key !== "Enter") return; event.preventDefault(); void search(); }} maxLength={80} placeholder="Buscar música ou artista" aria-label="Buscar música no Spotify" /><button type="button" onClick={() => void search()} disabled={loading || query.trim().length < 2}>{loading ? <LoaderCircle className="spin" size={15} /> : "Buscar"}</button></div>
    {error && <p className="form-message error">{error}</p>}
    {searched && tracks.length === 0 && <p className="profile-music-empty">Nenhuma faixa encontrada. Tente escrever também o nome do artista.</p>}
    {tracks.length > 0 && <div className="spotify-results">{tracks.map((track) => <button type="button" key={track.id} onClick={() => { onChange(track); setTracks([]); setSearched(false); }}><span style={track.coverUrl ? { backgroundImage: `url("${track.coverUrl}")` } : undefined} /><div><strong>{track.name}</strong><small>{track.artist}{!track.previewUrl ? " · sem prévia" : ""}</small></div></button>)}</div>}
  </section>;
}
