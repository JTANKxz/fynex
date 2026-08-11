import { z } from "zod";
import { fetchLinkPreview } from "@/lib/link-preview-server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const schema = z.object({ url: z.string().trim().min(4).max(2048) });
const attempts = new Map<string, number[]>();

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const now = Date.now();
  if (attempts.size > 5_000) attempts.clear();
  const recent = (attempts.get(userId) ?? []).filter((timestamp) => now - timestamp < 60_000);
  if (recent.length >= 10) return Response.json({ error: "Muitas prévias solicitadas" }, { status: 429 });
  attempts.set(userId, [...recent, now]);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Link inválido" }, { status: 400 });
  const preview = await fetchLinkPreview(parsed.data.url).catch(() => null);
  return Response.json({ preview }, { headers: { "Cache-Control": "private, max-age=300" } });
}
