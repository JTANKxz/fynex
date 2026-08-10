import { createHmac, randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MediaKind = "avatar" | "banner";

function encode(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return Response.json({ error: "Sessão inválida." }, { status: 401 });

  const body = await request.json().catch(() => null) as { kind?: MediaKind } | null;
  if (body?.kind !== "avatar" && body?.kind !== "banner") {
    return Response.json({ error: "Tipo de imagem inválido." }, { status: 400 });
  }

  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return Response.json({ error: "ImageKit não está configurado." }, { status: 503 });
  }

  const fileName = `${body.kind}-${randomUUID()}.webp`;
  const folder = `/fynex/users/${userId}`;
  const checks = body.kind === "avatar"
    ? "'file.size' <= '400KB' AND 'file.mime' = 'image/webp' AND 'mediaMetadata.width' = 512 AND 'mediaMetadata.height' = 512"
    : "'file.size' <= '900KB' AND 'file.mime' = 'image/webp' AND 'mediaMetadata.width' = 1600 AND 'mediaMetadata.height' = 500";
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
