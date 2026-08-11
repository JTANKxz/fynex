"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { deleteImageKitFile, getImageKitFile, isExpectedImageKitUrl } from "@/lib/media/imagekit-server";
import { createClient } from "@/lib/supabase/server";

type CommunityMediaKind = "avatar" | "banner";
type CommunityMediaResult = { error?: string; success?: string };

const mediaSchema = z.object({
  communityId: z.uuid(),
  kind: z.enum(["avatar", "banner"]),
  fileId: z.string().min(8).max(200).regex(/^[A-Za-z0-9_-]+$/),
  filePath: z.string().min(10).max(500),
  url: z.url().max(2000),
});

export async function saveCommunityMediaAction(input: unknown): Promise<CommunityMediaResult> {
  const parsed = mediaSchema.safeParse(input);
  if (!parsed.success) return { error: "O arquivo enviado não é válido." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "Sua sessão expirou. Entre novamente." };

  const { data: community } = await supabase.from("communities")
    .select("id, avatar_file_id, banner_file_id")
    .eq("id", parsed.data.communityId).eq("owner_id", userId).maybeSingle();
  if (!community) return { error: "Somente o criador pode alterar as imagens da comunidade." };

  const expectedFolder = `/fynex/communities/${community.id}/`;
  if (!parsed.data.filePath.startsWith(expectedFolder) || !isExpectedImageKitUrl(parsed.data.url, parsed.data.filePath)) {
    return { error: "O arquivo não pertence a esta comunidade." };
  }
  const details = await getImageKitFile(parsed.data.fileId).catch(() => null);
  const limits = parsed.data.kind === "avatar"
    ? { width: 512, height: 512, size: 400_000 }
    : { width: 1600, height: 500, size: 900_000 };
  if (!details || details.fileId !== parsed.data.fileId || details.filePath !== parsed.data.filePath
    || !details.url || !isExpectedImageKitUrl(details.url, parsed.data.filePath)
    || details.fileType !== "image" || details.mime !== "image/webp"
    || details.width !== limits.width || details.height !== limits.height
    || typeof details.size !== "number" || details.size > limits.size) {
    await deleteImageKitFile(parsed.data.fileId);
    return { error: "A imagem não passou pela validação de segurança." };
  }

  const previousFileId = parsed.data.kind === "avatar" ? community.avatar_file_id : community.banner_file_id;
  const update = parsed.data.kind === "avatar"
    ? { avatar_url: parsed.data.url, avatar_file_id: parsed.data.fileId }
    : { banner_url: parsed.data.url, banner_file_id: parsed.data.fileId };
  const { error } = await supabase.from("communities").update(update).eq("id", community.id).eq("owner_id", userId);
  if (error) {
    await deleteImageKitFile(parsed.data.fileId);
    return { error: "Não foi possível salvar a imagem da comunidade." };
  }
  if (previousFileId && previousFileId !== parsed.data.fileId) await deleteImageKitFile(previousFileId);
  revalidatePath("/");
  return { success: parsed.data.kind === "avatar" ? "Foto da comunidade atualizada." : "Banner da comunidade atualizado." };
}

export async function removeCommunityMediaAction(communityId: string, kind: CommunityMediaKind): Promise<CommunityMediaResult> {
  const id = z.uuid().safeParse(communityId);
  if (!id.success || (kind !== "avatar" && kind !== "banner")) return { error: "Solicitação inválida." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "Sua sessão expirou. Entre novamente." };
  const { data: community } = await supabase.from("communities").select("avatar_file_id, banner_file_id").eq("id", id.data).eq("owner_id", userId).maybeSingle();
  if (!community) return { error: "Somente o criador pode alterar esta comunidade." };
  const fileId = kind === "avatar" ? community.avatar_file_id : community.banner_file_id;
  const update = kind === "avatar" ? { avatar_url: null, avatar_file_id: null } : { banner_url: null, banner_file_id: null };
  const { error } = await supabase.from("communities").update(update).eq("id", id.data).eq("owner_id", userId);
  if (error) return { error: "Não foi possível remover a imagem." };
  await deleteImageKitFile(fileId);
  revalidatePath("/");
  return { success: "Imagem removida." };
}
