"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { deleteImageKitFile, getImageKitFile, isExpectedImageKitUrl } from "@/lib/media/imagekit-server";
import { createClient } from "@/lib/supabase/server";

export type CommunityIdentityState = { error?: string; success?: string };
const uuid = z.uuid();

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims?.sub ?? null };
}

export async function updateServerNicknameAction(_state: CommunityIdentityState, formData: FormData): Promise<CommunityIdentityState> {
  const communityId = uuid.safeParse(formData.get("communityId"));
  const nickname = z.string().trim().max(32).safeParse(formData.get("nickname") ?? "");
  if (!communityId.success || !nickname.success) return { error: "Apelido inválido." };
  const { supabase, userId } = await session();
  if (!userId) return { error: "Sua sessão expirou." };
  const { error } = await supabase.from("community_members").update({ nickname: nickname.data || null }).eq("community_id", communityId.data).eq("user_id", userId);
  if (error) return { error: "Não foi possível atualizar seu apelido." };
  revalidatePath("/");
  return { success: "Perfil desta comunidade atualizado." };
}

const serverProfileSchema = z.object({
  communityId: z.uuid(),
  nickname: z.string().trim().max(32),
  bio: z.string().trim().max(190),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
});

export async function updateServerProfileAction(input: unknown): Promise<CommunityIdentityState> {
  const parsed = serverProfileSchema.safeParse(input);
  if (!parsed.success) return { error: "Confira os dados do perfil desta comunidade." };
  const { supabase, userId } = await session();
  if (!userId) return { error: "Sua sessão expirou." };
  const { error } = await supabase.from("community_members").update({
    nickname: parsed.data.nickname || null,
    server_bio: parsed.data.bio || null,
    server_accent_color: parsed.data.accentColor,
  }).eq("community_id", parsed.data.communityId).eq("user_id", userId);
  if (error) return { error: "Não foi possível atualizar seu perfil nesta comunidade." };
  revalidatePath("/");
  return { success: "Perfil desta comunidade atualizado." };
}

const pairRequestSchema = z.object({ communityId: z.uuid(), recipientId: z.uuid() });
export async function sendCommunityPairRequestAction(input: unknown): Promise<CommunityIdentityState> {
  const parsed = pairRequestSchema.safeParse(input);
  if (!parsed.success) return { error: "Escolha uma pessoa válida." };
  const { supabase, userId } = await session();
  if (!userId) return { error: "Sua sessão expirou." };
  const { error } = await supabase.from("community_pairs").insert({ community_id: parsed.data.communityId, requester_id: userId, recipient_id: parsed.data.recipientId });
  if (error?.code === "23505" || error?.message.includes("already has")) return { error: "Uma das pessoas já possui um par ou pedido pendente nesta comunidade." };
  if (error) return { error: "Não foi possível enviar a solicitação de par." };
  revalidatePath("/");
  return { success: "Solicitação enviada. A pessoa precisa aceitar." };
}

export async function respondCommunityPairRequestAction(input: unknown): Promise<CommunityIdentityState> {
  const parsed = z.object({ requestId: z.uuid(), decision: z.enum(["accepted", "declined"]) }).safeParse(input);
  if (!parsed.success) return { error: "Resposta inválida." };
  const { supabase, userId } = await session();
  if (!userId) return { error: "Sua sessão expirou." };
  const { error, count } = await supabase.from("community_pairs").update({ status: parsed.data.decision }, { count: "exact" }).eq("id", parsed.data.requestId).eq("recipient_id", userId).eq("status", "pending");
  if (error || !count) return { error: "Essa solicitação não está mais disponível." };
  revalidatePath("/");
  return { success: parsed.data.decision === "accepted" ? "Par adicionado ao perfil desta comunidade." : "Solicitação recusada." };
}

const tagSchema = z.object({ communityId: z.uuid(), name: z.string().trim().min(1).max(24), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) });
export async function createCommunityTagAction(_state: CommunityIdentityState, formData: FormData): Promise<CommunityIdentityState> {
  const input = tagSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) return { error: "Confira o nome e a cor da tag." };
  const { supabase, userId } = await session();
  if (!userId) return { error: "Sua sessão expirou." };
  const { error } = await supabase.from("community_tags").insert({ community_id: input.data.communityId, name: input.data.name, color: input.data.color, created_by: userId });
  if (error?.code === "23505") return { error: "Já existe uma tag com esse nome." };
  if (error) return { error: "Você não tem permissão para criar tags." };
  revalidatePath("/");
  return { success: "Tag criada." };
}

export async function deleteCommunityTagAction(_state: CommunityIdentityState, formData: FormData): Promise<CommunityIdentityState> {
  const tagId = uuid.safeParse(formData.get("tagId"));
  if (!tagId.success) return { error: "Tag inválida." };
  const { supabase, userId } = await session();
  if (!userId) return { error: "Sua sessão expirou." };
  const { error } = await supabase.from("community_tags").delete().eq("id", tagId.data);
  if (error) return { error: "Não foi possível excluir a tag." };
  revalidatePath("/");
  return { success: "Tag excluída." };
}

export async function setOwnCommunityTagAction(input: unknown): Promise<CommunityIdentityState> {
  const parsed = z.object({ communityId: z.uuid(), tagId: z.uuid().nullable() }).safeParse(input);
  if (!parsed.success) return { error: "Tag inválida." };
  const { supabase, userId } = await session();
  if (!userId) return { error: "Sua sessão expirou." };
  if (!parsed.data.tagId) {
    const { error } = await supabase.from("community_member_tags").delete().eq("community_id", parsed.data.communityId).eq("user_id", userId);
    if (error) return { error: "Não foi possível remover sua tag." };
    revalidatePath("/");
    return { success: "Tag removida do seu perfil nesta comunidade." };
  }
  const { error } = await supabase.from("community_member_tags").upsert({
    community_id: parsed.data.communityId,
    user_id: userId,
    tag_id: parsed.data.tagId,
    assigned_by: userId,
  }, { onConflict: "community_id,user_id" });
  if (error) return { error: "Não foi possível exibir essa tag." };
  revalidatePath("/");
  return { success: "Tag exibida no seu perfil desta comunidade." };
}

export async function setOwnDisplayRoleAction(input: unknown): Promise<CommunityIdentityState> {
  const parsed = z.object({ communityId: z.uuid(), roleId: z.uuid().nullable() }).safeParse(input);
  if (!parsed.success) return { error: "Cargo inválido." };
  const { supabase, userId } = await session();
  if (!userId) return { error: "Sua sessão expirou." };
  if (parsed.data.roleId) {
    const { data: assignment } = await supabase.from("community_member_roles").select("role_id").eq("community_id", parsed.data.communityId).eq("user_id", userId).eq("role_id", parsed.data.roleId).maybeSingle();
    if (!assignment) return { error: "Você precisa possuir este cargo." };
  }
  const { error } = await supabase.from("community_members").update({ display_role_id: parsed.data.roleId }).eq("community_id", parsed.data.communityId).eq("user_id", userId);
  if (error) return { error: "Não foi possível definir o cargo visual." };
  revalidatePath("/");
  return { success: "Cargo visual atualizado." };
}

const stickerSchema = z.object({ communityId: z.uuid(), name: z.string().trim().min(1).max(32), fileId: z.string().regex(/^[A-Za-z0-9_-]{8,200}$/) });
export async function saveCommunityStickerAction(input: unknown): Promise<CommunityIdentityState> {
  const data = stickerSchema.safeParse(input);
  if (!data.success) return { error: "A figurinha enviada não é válida." };
  const { supabase, userId } = await session();
  if (!userId) return { error: "Sua sessão expirou." };
  const expectedPath = `/fynex/communities/${data.data.communityId}/stickers/`;
  const details = await getImageKitFile(data.data.fileId).catch(() => null);
  if (!details?.filePath || !details.url || !details.filePath.startsWith(expectedPath) || !isExpectedImageKitUrl(details.url, details.filePath) || details.fileType !== "image" || !details.mime?.startsWith("image/") || (details.size ?? Infinity) > 1_000_000) {
    await deleteImageKitFile(data.data.fileId);
    return { error: "A figurinha não passou na validação." };
  }
  const { error } = await supabase.from("community_stickers").insert({ community_id: data.data.communityId, name: data.data.name, image_url: details.url, image_file_id: data.data.fileId, image_path: details.filePath, created_by: userId });
  if (error) { await deleteImageKitFile(data.data.fileId); return { error: "Você não tem permissão para adicionar figurinhas." }; }
  revalidatePath("/");
  return { success: "Figurinha adicionada." };
}

export async function deleteCommunityStickerAction(_state: CommunityIdentityState, formData: FormData): Promise<CommunityIdentityState> {
  const stickerId = uuid.safeParse(formData.get("stickerId"));
  if (!stickerId.success) return { error: "Figurinha inválida." };
  const { supabase, userId } = await session();
  if (!userId) return { error: "Sua sessão expirou." };
  const { data: sticker, error: findError } = await supabase.from("community_stickers").select("image_file_id").eq("id", stickerId.data).maybeSingle();
  if (findError || !sticker) return { error: "Figurinha não encontrada." };
  const { error, count } = await supabase.from("community_stickers").delete({ count: "exact" }).eq("id", stickerId.data);
  if (error || !count) return { error: "Não foi possível excluir a figurinha. Verifique se você tem permissão para gerenciar figurinhas." };
  const imageDeleted = await deleteImageKitFile(sticker.image_file_id).catch(() => false);
  revalidatePath("/");
  return imageDeleted ? { success: "Figurinha excluída do FYNEX e do ImageKit." } : { success: "Figurinha excluída do FYNEX. O arquivo do ImageKit será limpo na próxima manutenção." };
}

export async function deleteCommunityRoleIconAction(_state: CommunityIdentityState, formData: FormData): Promise<CommunityIdentityState> {
  const iconId = uuid.safeParse(formData.get("iconId"));
  if (!iconId.success) return { error: "Ícone inválido." };
  const { supabase, userId } = await session();
  if (!userId) return { error: "Sua sessão expirou." };
  const { data: icon, error: findError } = await supabase.from("community_role_icons").select("image_file_id").eq("id", iconId.data).maybeSingle();
  if (findError || !icon) return { error: "Ícone não encontrado." };
  const { error } = await supabase.from("community_role_icons").delete().eq("id", iconId.data);
  if (error) return { error: "Você não tem permissão para excluir este ícone." };
  await deleteImageKitFile(icon.image_file_id);
  revalidatePath("/");
  return { success: "Ícone excluído." };
}
