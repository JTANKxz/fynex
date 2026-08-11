"use server";

import { z } from "zod";
import { deleteImageKitFile, getImageKitFile, isExpectedImageKitUrl } from "@/lib/media/imagekit-server";
import { createClient } from "@/lib/supabase/server";
import type { Message } from "@/lib/supabase/database.types";

const attachmentSchema = z.object({
  kind: z.enum(["image", "video"]),
  fileId: z.string().min(8).max(200).regex(/^[A-Za-z0-9_-]+$/),
  filePath: z.string().min(10).max(500),
  url: z.url().max(2000),
  originalName: z.string().trim().min(1).max(255),
});

const messageSchema = z.object({
  id: z.uuid(),
  channelId: z.uuid(),
  content: z.string().trim().max(2000),
  replyToId: z.uuid().nullable().optional(),
  attachment: attachmentSchema.optional(),
}).refine((value) => value.content.length > 0 || value.attachment, { message: "Mensagem vazia" });

const ALLOWED_MEDIA = {
  image: { mime: new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]), maxSize: 8_000_000 },
  video: { mime: new Set(["video/mp4", "video/webm", "video/quicktime"]), maxSize: 20_000_000 },
} as const;

export type SendMessageResult = { data?: Message; error?: string };

function safeFileName(value: string) {
  return value.replace(/[^\p{L}\p{N}._ -]/gu, "").trim().slice(0, 255) || "anexo";
}

export async function sendMessageAction(input: unknown): Promise<SendMessageResult> {
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) return { error: "Confira a mensagem e o arquivo selecionado." };

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;
  if (!userId) return { error: "Sua sessão expirou. Entre novamente." };

  const attachment = parsed.data.attachment;
  let verified: Awaited<ReturnType<typeof getImageKitFile>> = null;
  if (attachment) {
    const expectedFolder = `/fynex/users/${userId}/messages/`;
    if (!attachment.filePath.startsWith(expectedFolder) || !isExpectedImageKitUrl(attachment.url, attachment.filePath)) {
      return { error: "O anexo não pertence à sua conta." };
    }

    verified = await getImageKitFile(attachment.fileId).catch(() => null);
    const limits = ALLOWED_MEDIA[attachment.kind];
    const validFileType = attachment.kind === "image"
      ? verified?.fileType === "image"
      : verified?.fileType === "non-image" || verified?.fileType === "video";
    if (!verified
      || verified.fileId !== attachment.fileId
      || verified.filePath !== attachment.filePath
      || !verified.url
      || !isExpectedImageKitUrl(verified.url, attachment.filePath)
      || !validFileType
      || !verified.mime
      || !limits.mime.has(verified.mime)
      || typeof verified.size !== "number"
      || verified.size < 1
      || verified.size > limits.maxSize) {
      await deleteImageKitFile(attachment.fileId);
      return { error: "O arquivo não passou pela validação de segurança." };
    }
  }

  const { data, error } = await supabase.from("messages").insert({
    id: parsed.data.id,
    channel_id: parsed.data.channelId,
    author_id: userId,
    content: parsed.data.content,
    reply_to_id: parsed.data.replyToId ?? null,
    attachment_kind: attachment?.kind ?? null,
    attachment_url: verified?.url ?? null,
    attachment_file_id: attachment?.fileId ?? null,
    attachment_path: verified?.filePath ?? null,
    attachment_mime: verified?.mime ?? null,
    attachment_size: verified?.size ?? null,
    attachment_width: verified?.width ?? null,
    attachment_height: verified?.height ?? null,
    attachment_name: attachment ? safeFileName(attachment.originalName) : null,
  }).select("*").single();

  if (error || !data) {
    if (attachment) await deleteImageKitFile(attachment.fileId);
    if (/@todos/i.test(parsed.data.content) && error?.code === "42501") return { error: "Somente administradores podem mencionar @todos." };
    return { error: "Não foi possível enviar a mensagem neste canal." };
  }
  return { data };
}

const deleteMessageSchema = z.object({ messageId: z.uuid() });

export async function deleteMessageAction(input: unknown): Promise<{ success?: true; error?: string }> {
  const parsed = deleteMessageSchema.safeParse(input);
  if (!parsed.success) return { error: "Mensagem inválida." };

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims?.sub) return { error: "Sua sessão expirou. Entre novamente." };

  const { data: message } = await supabase
    .from("messages")
    .select("id, attachment_file_id")
    .eq("id", parsed.data.messageId)
    .maybeSingle();
  if (!message) return { error: "Mensagem não encontrada." };

  const { error } = await supabase.from("messages").delete().eq("id", parsed.data.messageId);
  if (error) return { error: "Você não tem permissão para apagar esta mensagem." };

  if (message.attachment_file_id) {
    await deleteImageKitFile(message.attachment_file_id).catch(() => undefined);
  }
  return { success: true };
}
