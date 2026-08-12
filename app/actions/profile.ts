"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { profileSchema, type ActionState } from "@/lib/auth/schemas";

export async function updateProfileAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Confira o nome, usuário e descrição." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "Sua sessão expirou. Entre novamente." };

  const safeSpotifyUrl = (value: string | undefined, hosts: string[]) => {
    if (!value) return null;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)) ? url.toString() : null;
    } catch { return null; }
  };
  const hasSong = !!(parsed.data.songId && parsed.data.songName && parsed.data.songArtist);
  const songDurationMs = typeof parsed.data.songDurationMs === "number" ? parsed.data.songDurationMs : null;
  const maxSongStart = songDurationMs ? Math.max(0, Math.floor(songDurationMs / 1000) - 30) : 0;
  const songStartSeconds = typeof parsed.data.songStartSeconds === "number" ? Math.min(parsed.data.songStartSeconds, maxSongStart) : 0;

  const { error } = await supabase.from("profiles").update({
    display_name: parsed.data.displayName,
    username: parsed.data.username,
    bio: parsed.data.bio,
    accent_color: parsed.data.accentColor,
    presence_status: parsed.data.presenceStatus,
    profile_song_id: hasSong ? parsed.data.songId : null,
    profile_song_name: hasSong ? parsed.data.songName : null,
    profile_song_artist: hasSong ? parsed.data.songArtist : null,
    profile_song_cover_url: hasSong ? safeSpotifyUrl(parsed.data.songCoverUrl, ["scdn.co"]) : null,
    profile_song_preview_url: hasSong ? safeSpotifyUrl(parsed.data.songPreviewUrl, ["scdn.co"]) : null,
    profile_song_spotify_url: hasSong ? safeSpotifyUrl(parsed.data.songSpotifyUrl, ["open.spotify.com"]) : null,
    profile_song_duration_ms: hasSong ? songDurationMs : null,
    profile_song_start_seconds: hasSong ? songStartSeconds : 0,
  }).eq("id", userId);

  if (error?.code === "23505") return { error: "Este nome de usuário já está em uso." };
  if (error) return { error: "Não foi possível salvar o perfil." };
  revalidatePath("/profile");
  revalidatePath("/");
  return { success: "Perfil atualizado." };
}
