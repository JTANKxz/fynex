"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type MediaKind = "avatar" | "banner";
type MediaActionState = { error?: string; success?: string };

const mediaSchema = z.object({
  kind: z.enum(["avatar", "banner"]),
  fileId: z.string().min(8).max(200).regex(/^[a-zA-Z0-9_-]+$/),
  filePath: z.string().min(10).max(500),
  url: z.url().max(2000),
});

type ImageKitDetails = {
  fileId?: string;
  filePath?: string;
  url?: string;
  fileType?: string;
  mime?: string;
  size?: number;
  width?: number;
  height?: number;
};

function imageKitAuthHeader() {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!privateKey) throw new Error("ImageKit não configurado");
  return `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}`;
}

async function getImageKitFile(fileId: string): Promise<ImageKitDetails | null> {
  const response = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}/details`, {
    headers: { Authorization: imageKitAuthHeader() },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json() as Promise<ImageKitDetails>;
}

async function deleteImageKitFile(fileId: string | null) {
  if (!fileId) return;
  await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: { Authorization: imageKitAuthHeader() },
    cache: "no-store",
  }).catch(() => undefined);
}

function isExpectedImageKitUrl(value: string, expectedPath: string) {
  const endpointValue = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;
  if (!endpointValue) return false;
  try {
    const endpoint = new URL(endpointValue);
    const candidate = new URL(value);
    const endpointPath = endpoint.pathname.replace(/\/$/, "");
    return candidate.protocol === "https:"
      && candidate.origin === endpoint.origin
      && candidate.pathname === `${endpointPath}${expectedPath}`;
  } catch {
    return false;
  }
}

export async function saveProfileMediaAction(input: unknown): Promise<MediaActionState> {
  const parsed = mediaSchema.safeParse(input);
  if (!parsed.success) return { error: "O arquivo enviado não é válido." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "Sua sessão expirou. Entre novamente." };

  const expectedFolder = `/fynex/users/${userId}/`;
  if (!parsed.data.filePath.startsWith(expectedFolder) || !isExpectedImageKitUrl(parsed.data.url, parsed.data.filePath)) {
    return { error: "O arquivo não pertence ao seu perfil." };
  }

  const details = await getImageKitFile(parsed.data.fileId).catch(() => null);
  const limits = parsed.data.kind === "avatar"
    ? { width: 512, height: 512, size: 400_000 }
    : { width: 1600, height: 500, size: 900_000 };
  if (!details
    || details.fileId !== parsed.data.fileId
    || details.filePath !== parsed.data.filePath
    || details.url !== parsed.data.url
    || details.fileType !== "image"
    || details.mime !== "image/webp"
    || details.width !== limits.width
    || details.height !== limits.height
    || typeof details.size !== "number"
    || details.size > limits.size) {
    await deleteImageKitFile(parsed.data.fileId);
    return { error: "A imagem não passou pela validação de segurança." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("avatar_file_id, banner_file_id")
    .eq("id", userId)
    .single();
  if (profileError || !profile) return { error: "Não foi possível carregar seu perfil." };

  const previousFileId = parsed.data.kind === "avatar" ? profile.avatar_file_id : profile.banner_file_id;
  const update = parsed.data.kind === "avatar"
    ? { avatar_url: parsed.data.url, avatar_file_id: parsed.data.fileId }
    : { banner_url: parsed.data.url, banner_file_id: parsed.data.fileId };
  const { error } = await supabase.from("profiles").update(update).eq("id", userId);
  if (error) {
    await deleteImageKitFile(parsed.data.fileId);
    return { error: "Não foi possível salvar a imagem no perfil." };
  }

  if (previousFileId && previousFileId !== parsed.data.fileId) await deleteImageKitFile(previousFileId);
  revalidatePath("/profile");
  revalidatePath("/");
  return { success: parsed.data.kind === "avatar" ? "Foto de perfil atualizada." : "Banner atualizado." };
}

export async function removeProfileMediaAction(kind: MediaKind): Promise<MediaActionState> {
  if (kind !== "avatar" && kind !== "banner") return { error: "Tipo de imagem inválido." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "Sua sessão expirou. Entre novamente." };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("avatar_file_id, banner_file_id")
    .eq("id", userId)
    .single();
  if (profileError || !profile) return { error: "Não foi possível carregar seu perfil." };

  const fileId = kind === "avatar" ? profile.avatar_file_id : profile.banner_file_id;
  const update = kind === "avatar"
    ? { avatar_url: null, avatar_file_id: null }
    : { banner_url: null, banner_file_id: null };
  const { error } = await supabase.from("profiles").update(update).eq("id", userId);
  if (error) return { error: "Não foi possível remover a imagem." };

  await deleteImageKitFile(fileId);
  revalidatePath("/profile");
  revalidatePath("/");
  return { success: "Imagem removida." };
}
