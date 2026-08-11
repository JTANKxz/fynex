import { createClient } from "@/lib/supabase/server";
import type { SpotifyTrack } from "@/lib/spotify";

export const dynamic = "force-dynamic";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getSpotifyToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!response.ok) throw new Error("spotify-auth");
  const data = await response.json() as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return Response.json({ error: "Entre na sua conta para buscar músicas." }, { status: 401 });

  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query || query.length < 2 || query.length > 80) return Response.json({ error: "Digite entre 2 e 80 caracteres." }, { status: 400 });
  try {
    const token = await getSpotifyToken();
    if (!token) return Response.json({ error: "Spotify ainda não foi configurado no FYNEX." }, { status: 503 });
    const response = await fetch(`https://api.spotify.com/v1/search?${new URLSearchParams({ q: query, type: "track", limit: "8", market: "BR" })}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) return Response.json({ error: "O Spotify não respondeu à busca." }, { status: 502 });
    const data = await response.json() as { tracks?: { items?: Array<{ id: string; name: string; artists: Array<{ name: string }>; album: { images: Array<{ url: string }> }; preview_url: string | null; external_urls: { spotify: string } }> } };
    const tracks: SpotifyTrack[] = (data.tracks?.items ?? []).map((track) => ({
      id: track.id,
      name: track.name,
      artist: track.artists.map((artist) => artist.name).join(", "),
      coverUrl: track.album.images.at(-1)?.url ?? track.album.images[0]?.url ?? null,
      previewUrl: track.preview_url,
      spotifyUrl: track.external_urls.spotify,
    }));
    return Response.json({ tracks }, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch {
    return Response.json({ error: "Não foi possível conectar ao Spotify agora." }, { status: 502 });
  }
}
