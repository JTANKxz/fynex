import { createHmac, randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MediaKind = "avatar" | "banner" | "community-avatar" | "community-banner" | "message-image" | "message-video";

const MESSAGE_MIME = {
  "image/jpeg": { kind: "message-image", extension: "jpg", limit: 8_000_000 },
  "image/png": { kind: "message-image", extension: "png", limit: 8_000_000 },
  "image/webp": { kind: "message-image", extension: "webp", limit: 8_000_000 },
  "image/gif": { kind: "message-image", extension: "gif", limit: 8_000_000 },
  "video/mp4": { kind: "message-video", extension: "mp4", limit: 20_000_000 },
  "video/webm": { kind: "message-video", extension: "webm", limit: 20_000_000 },
  "video/quicktime": { kind: "message-video", extension: "mov", limit: 20_000_000 },
} as const;

function encode(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return Response.json({ error: "Sessão inválida." }, { status: 401 });

  const body = await request.json().catch(() => null) as { kind?: MediaKind; mime?: string; channelId?: string; communityId?: string } | null;
  if (body?.kind !== "avatar" && body?.kind !== "banner" && body?.kind !== "community-avatar" && body?.kind !== "community-banner" && body?.kind !== "message-image" && body?.kind !== "message-video") {
    return Response.json({ error: "Tipo de imagem inválido." }, { status: 400 });
  }

  const isMessage = body.kind === "message-image" || body.kind === "message-video";
  const isCommunity = body.kind === "community-avatar" || body.kind === "community-banner";
  const media = body.mime ? MESSAGE_MIME[body.mime as keyof typeof MESSAGE_MIME] : undefined;
  if (isMessage && (!media || media.kind !== body.kind || !body.channelId)) {
    return Response.json({ error: "Formato de anexo inválido." }, { status: 400 });
  }
  if (isMessage) {
    const { data: channel } = await supabase.from("channels").select("id").eq("id", body.channelId!).eq("type", "text").maybeSingle();
    if (!channel) return Response.json({ error: "Você não pode enviar arquivos neste canal." }, { status: 403 });
  }
  if (isCommunity) {
    if (!body.communityId) return Response.json({ error: "Comunidade inválida." }, { status: 400 });
    const { data: community } = await supabase.from("communities").select("id").eq("id", body.communityId).eq("owner_id", userId).maybeSingle();
    if (!community) return Response.json({ error: "Somente o criador pode alterar as imagens da comunidade." }, { status: 403 });
  }

  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return Response.json({ error: "ImageKit não está configurado." }, { status: 503 });
  }

  const fileName = `${body.kind}-${randomUUID()}.${media?.extension ?? "webp"}`;
  const folder = isMessage ? `/fynex/users/${userId}/messages` : isCommunity ? `/fynex/communities/${body.communityId}` : `/fynex/users/${userId}`;
  const checks = body.kind === "avatar" || body.kind === "community-avatar"
    ? "'file.size' <= '400KB' AND 'file.mime' = 'image/webp' AND 'mediaMetadata.width' = 512 AND 'mediaMetadata.height' = 512"
    : body.kind === "banner" || body.kind === "community-banner"
      ? "'file.size' <= '900KB' AND 'file.mime' = 'image/webp' AND 'mediaMetadata.width' = 1600 AND 'mediaMetadata.height' = 500"
      : `'file.size' <= ${media!.limit} AND 'file.mime' = '${body.mime}'`;
  const issuedAt = Math.floor(Date.now() / 1000);
  const upload = { fileName, folder, useUniqueFileName: "false", checks };
  const header = encode({ alg: "HS256", typ: "JWT", kid: publicKey });
  const payload = encode({ ...upload, iat: issuedAt, exp: issuedAt + 300 });
  const unsignedToken = `${header}.${payload}`;
  const signature = createHmac("sha256", privateKey).update(unsignedToken).digest("base64url");

  return Response.json({ token: `${unsignedToken}.${signature}`, upload }, {
    headers: { "Cache-Control": "no-store" },
  });
}
