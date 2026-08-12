"use server";

import { z } from "zod";
import { deleteImageKitFile, getImageKitFile, isExpectedImageKitUrl } from "@/lib/media/imagekit-server";
import { extractFirstLink } from "@/lib/links";
import { fetchLinkPreview } from "@/lib/link-preview-server";
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
  includeLinkPreview: z.boolean().optional(),
  attachment: attachmentSchema.optional(),
  poll: z.object({
    question: z.string().trim().min(1).max(160),
    options: z.array(z.string().trim().min(1).max(80)).min(2).max(6),
  }).optional(),
  stickerId: z.uuid().optional(),
}).superRefine((value, context) => {
  const kinds = Number(Boolean(value.poll)) + Number(Boolean(value.stickerId));
  if (kinds > 1 || (!value.content && !value.attachment && !value.poll && !value.stickerId)) {
    context.addIssue({ code: "custom", message: "Mensagem vazia" });
  }
  if (value.poll && new Set(value.poll.options.map((option) => option.toLocaleLowerCase("pt-BR"))).size !== value.poll.options.length) {
    context.addIssue({ code: "custom", message: "As opções da enquete devem ser diferentes." });
  }
});

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

  const { data: channel } = await supabase.from("channels")
    .select("id, community_id, type")
    .eq("id", parsed.data.channelId)
    .maybeSingle();
  if (!channel || channel.type !== "text") return { error: "Este canal não está mais disponível para mensagens. Atualize a comunidade e tente novamente." };
  const { data: membership } = await supabase.from("community_members")
    .select("user_id")
    .eq("community_id", channel.community_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) return { error: "Você não participa mais desta comunidade. Atualize a página." };

  if (parsed.data.stickerId) {
    const { data: sticker } = await supabase.from("community_stickers")
      .select("id")
      .eq("id", parsed.data.stickerId)
      .eq("community_id", channel.community_id)
      .maybeSingle();
    if (!sticker) return { error: "Essa figurinha não pertence a esta comunidade." };
  }

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

  const firstLink = parsed.data.includeLinkPreview ? extractFirstLink(parsed.data.content) : null;
  const linkPreview = firstLink ? await fetchLinkPreview(firstLink).catch(() => null) : null;

  const { data, error } = await supabase.from("messages").insert({
    id: parsed.data.id,
    channel_id: parsed.data.channelId,
    author_id: userId,
    content: parsed.data.content,
    message_kind: parsed.data.poll ? "poll" : parsed.data.stickerId ? "sticker" : "text",
    poll_question: parsed.data.poll?.question ?? null,
    poll_options: parsed.data.poll?.options ?? null,
    sticker_id: parsed.data.stickerId ?? null,
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
    link_preview_url: linkPreview?.url ?? null,
    link_preview_title: linkPreview?.title ?? null,
    link_preview_description: linkPreview?.description ?? null,
    link_preview_site_name: linkPreview?.siteName ?? null,
  }).select("*").single();

  if (error || !data) {
    if (attachment) await deleteImageKitFile(attachment.fileId);
    if (/@todos/i.test(parsed.data.content) && error?.code === "42501") return { error: "Somente administradores podem mencionar @todos." };
    if (error?.code === "23514") return { error: "A mensagem não passou na validação do canal. Revise o conteúdo e tente novamente." };
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

const reactionSchema = z.object({
  messageId: z.uuid(),
  emoji: z.string().min(1).max(16).regex(/\p{Extended_Pictographic}/u),
});

export async function toggleMessageReactionAction(input: unknown): Promise<{ active?: boolean; error?: string }> {
  const parsed = reactionSchema.safeParse(input);
  if (!parsed.success) return { error: "Reação inválida." };

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;
  if (!userId) return { error: "Sua sessão expirou. Entre novamente." };

  const key = { message_id: parsed.data.messageId, user_id: userId, emoji: parsed.data.emoji };
  const { data: existing, error: lookupError } = await supabase
    .from("message_reactions")
    .select("message_id")
    .match(key)
    .maybeSingle();
  if (lookupError) return { error: "Não foi possível atualizar a reação." };

  if (existing) {
    const { error } = await supabase.from("message_reactions").delete().match(key);
    return error ? { error: "Não foi possível remover a reação." } : { active: false };
  }

  const { error } = await supabase.from("message_reactions").insert(key);
  if (error?.code === "23505") return { active: true };
  return error ? { error: "Você não pode reagir a esta mensagem." } : { active: true };
}

const pollVoteSchema = z.object({
  messageId: z.uuid(),
  optionIndex: z.number().int().min(0).max(5),
});

export async function votePollAction(input: unknown): Promise<{ success?: true; error?: string }> {
  const parsed = pollVoteSchema.safeParse(input);
  if (!parsed.success) return { error: "Voto inválido." };

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;
  if (!userId) return { error: "Sua sessão expirou. Entre novamente." };

  const { error } = await supabase.from("poll_votes").upsert({
    message_id: parsed.data.messageId,
    user_id: userId,
    option_index: parsed.data.optionIndex,
  }, { onConflict: "message_id,user_id" });
  return error ? { error: "Não foi possível registrar seu voto." } : { success: true };
}
