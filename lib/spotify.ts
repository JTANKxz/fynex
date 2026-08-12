export type SpotifyTrack = {
  id: string;
  name: string;
  artist: string;
  coverUrl: string | null;
  previewUrl: string | null;
  spotifyUrl: string;
  durationMs: number;
  startSeconds: number;
};

export type ProfileSong = SpotifyTrack;

export function songFromProfile(profile: {
  profile_song_id?: string | null;
  profile_song_name?: string | null;
  profile_song_artist?: string | null;
  profile_song_cover_url?: string | null;
  profile_song_preview_url?: string | null;
  profile_song_spotify_url?: string | null;
  profile_song_duration_ms?: number | null;
  profile_song_start_seconds?: number | null;
}): ProfileSong | null {
  if (!profile.profile_song_id || !profile.profile_song_name || !profile.profile_song_artist || !profile.profile_song_spotify_url) return null;
  return {
    id: profile.profile_song_id,
    name: profile.profile_song_name,
    artist: profile.profile_song_artist,
    coverUrl: profile.profile_song_cover_url ?? null,
    previewUrl: profile.profile_song_preview_url ?? null,
    spotifyUrl: profile.profile_song_spotify_url,
    durationMs: profile.profile_song_duration_ms ?? 30_000,
    startSeconds: profile.profile_song_start_seconds ?? 0,
  };
}
