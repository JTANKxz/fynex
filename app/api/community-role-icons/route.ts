import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { deleteImageKitFile, isExpectedImageKitUrl, uploadImageKitFile } from "@/lib/media/imagekit-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ICON_BYTES = 256 * 1024;
const inputSchema = z.object({ communityId: z.uuid(), name: z.string().trim().min(1).max(32) });

function validatePng(bytes: Buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature) || bytes.toString("ascii", 12, 16) !== "IHDR") return false;
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  return width >= 16 && height >= 16 && width <= 1024 && height <= 1024;
}

function validateSvg(bytes: Buffer) {
  const source = bytes.toString("utf8").replace(/^\uFEFF/, "").trim();
  if (!/^<\?xml[\s\S]*?\?>\s*<svg(?:\s|>)/i.test(source) && !/^<svg(?:\s|>)/i.test(source)) return false;
  if (!/<svg\b[^>]*\bviewBox\s*=\s*["'][^"']+["']/i.test(source)) return false;
  const forbidden = [
    /<!DOCTYPE/i, /<!ENTITY/i, /<\?xml-stylesheet/i,
    /<\s*(script|foreignObject|iframe|object|embed|image|audio|video|style)\b/i,
    /\son[a-z]+\s*=/i, /javascript\s*:/i, /data\s*:\s*text\/html/i, /@import/i,
    /(?:href|xlink:href)\s*=\s*["'](?!#)/i,
  ];
  if (forbidden.some((pattern) => pattern.test(source))) return false;
  for (const reference of source.matchAll(/url\s*\(\s*(["']?)([^)"']+)\1\s*\)/gi)) {
    if (!reference[2].trim().startsWith("#")) return false;
  }
  const viewBox = source.match(/\bviewBox\s*=\s*["']\s*([-+\d.e]+)[ ,]+([-+\d.e]+)[ ,]+([-+\d.e]+)[ ,]+([-+\d.e]+)\s*["']/i);
  if (!viewBox) return false;
  const values = viewBox.slice(1).map(Number);
  return values.every(Number.isFinite) && values[2] > 0 && values[3] > 0 && values[2] <= 4096 && values[3] <= 4096;
}

async function canManageRoles(communityId: string, userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: community } = await supabase.from("communities").select("owner_id").eq("id", communityId).maybeSingle();
  if (community?.owner_id === userId) return true;
  const { data: assignments } = await supabase.from("community_member_roles").select("community_roles!inner(is_admin, manage_roles)").eq("community_id", communityId).eq("user_id", userId);
  return (assignments ?? []).some((assignment) => {
    const role = assignment.community_roles as unknown as { is_admin: boolean; manage_roles: boolean } | null;
    return Boolean(role?.is_admin || role?.manage_roles);
  });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 400_000) return Response.json({ error: "O arquivo excede o limite permitido." }, { status: 413 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return Response.json({ error: "Entre novamente para enviar o ícone." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const parsed = inputSchema.safeParse({ communityId: form?.get("communityId"), name: form?.get("name") });
  const file = form?.get("file");
  if (!parsed.success || !(file instanceof File)) return Response.json({ error: "Confira o nome e o arquivo do ícone." }, { status: 400 });
  if (file.size < 1 || file.size > MAX_ICON_BYTES) return Response.json({ error: "Use um PNG ou SVG de até 256 KB." }, { status: 413 });
  if (!await canManageRoles(parsed.data.communityId, userId, supabase)) return Response.json({ error: "Você não tem permissão para gerenciar ícones." }, { status: 403 });

  const { count } = await supabase.from("community_role_icons").select("id", { count: "exact", head: true }).eq("community_id", parsed.data.communityId);
  if ((count ?? 0) >= 20) return Response.json({ error: "Esta comunidade já atingiu o limite de 20 ícones." }, { status: 409 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const lowerName = file.name.toLowerCase();
  const isPng = lowerName.endsWith(".png") && validatePng(bytes);
  const isSvg = lowerName.endsWith(".svg") && validateSvg(bytes);
  if (!isPng && !isSvg) return Response.json({ error: "O arquivo não é um PNG válido ou contém SVG inseguro. SVG precisa ter viewBox e não pode usar scripts, links externos ou conteúdo incorporado." }, { status: 400 });

  const mimeType = isPng ? "image/png" : "image/svg+xml";
  const extension = isPng ? "png" : "svg";
  const fileName = `role-icon-${randomUUID()}.${extension}`;
  const folder = `/fynex/communities/${parsed.data.communityId}/role-icons`;
  let uploadedFileId: string | null = null;
  try {
    const uploaded = await uploadImageKitFile(new Blob([bytes], { type: mimeType }), {
      fileName,
      folder,
      checks: `"file.size" <= "256KB" AND "file.mime" IN ['image/png', 'image/svg+xml']`,
    });
    uploadedFileId = uploaded.fileId!;
    const expectedPath = `${folder}/${fileName}`;
    if (uploaded.filePath !== expectedPath || !isExpectedImageKitUrl(uploaded.url!, expectedPath) || (uploaded.size ?? file.size) > MAX_ICON_BYTES) throw new Error("O arquivo armazenado não passou na validação final.");
    const { data: icon, error } = await supabase.from("community_role_icons").insert({
      community_id: parsed.data.communityId,
      name: parsed.data.name,
      image_url: uploaded.url!,
      image_file_id: uploaded.fileId!,
      image_path: uploaded.filePath!,
      mime_type: mimeType,
      file_size: uploaded.size ?? file.size,
      created_by: userId,
    }).select("*").single();
    if (error || !icon) throw new Error(error?.code === "23505" ? "Já existe um ícone com esse nome." : error?.message.includes("quota") ? "Esta comunidade já atingiu o limite de 20 ícones." : "Não foi possível salvar o ícone.");
    return Response.json({ icon }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (uploadedFileId) await deleteImageKitFile(uploadedFileId);
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível enviar o ícone." }, { status: 400 });
  }
}
