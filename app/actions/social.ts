"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type SocialActionState = { error?: string; success?: string; inviteToken?: string };

const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/);
const uuidSchema = z.uuid();

async function authenticatedUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims?.sub ?? null };
}

export async function sendFriendRequestAction(_state: SocialActionState, formData: FormData): Promise<SocialActionState> {
  const username = usernameSchema.safeParse(formData.get("username"));
  if (!username.success) return { error: "Digite um @usuário válido." };
  const { supabase, userId } = await authenticatedUserId();
  if (!userId) return { error: "Sua sessão expirou." };

  const { data: target } = await supabase.from("profiles").select("id, display_name").eq("username", username.data).maybeSingle();
  if (!target) return { error: "Usuário não encontrado." };
  if (target.id === userId) return { error: "Você já está na sua própria lista." };

  const [userA, userB] = [userId, target.id].sort();
  const { data: existing } = await supabase.from("friendships").select("status").eq("user_a", userA).eq("user_b", userB).maybeSingle();
  if (existing?.status === "accepted") return { error: "Vocês já são amigos." };
  if (existing?.status === "pending") return { error: "Já existe um pedido pendente." };
  if (existing) await supabase.from("friendships").delete().eq("user_a", userA).eq("user_b", userB);

  const { error } = await supabase.from("friendships").insert({ user_a: userA, user_b: userB, requested_by: userId });
  if (error) return { error: "Não foi possível enviar o pedido." };
  return { success: `Pedido enviado para ${target.display_name}.` };
}

export async function respondFriendRequestAction(_state: SocialActionState, formData: FormData): Promise<SocialActionState> {
  const userA = uuidSchema.safeParse(formData.get("userA"));
  const userB = uuidSchema.safeParse(formData.get("userB"));
  const decision = z.enum(["accepted", "declined"]).safeParse(formData.get("decision"));
  if (!userA.success || !userB.success || !decision.success) return { error: "Pedido inválido." };
  const { supabase, userId } = await authenticatedUserId();
  if (!userId) return { error: "Sua sessão expirou." };

  const { error } = await supabase.from("friendships").update({ status: decision.data, responded_at: new Date().toISOString() }).eq("user_a", userA.data).eq("user_b", userB.data);
  if (error) return { error: "Não foi possível responder ao pedido." };
  return { success: decision.data === "accepted" ? "Amizade aceita." : "Pedido recusado." };
}

export async function inviteFriendAction(_state: SocialActionState, formData: FormData): Promise<SocialActionState> {
  const communityId = uuidSchema.safeParse(formData.get("communityId"));
  const username = usernameSchema.safeParse(formData.get("username"));
  if (!communityId.success || !username.success) return { error: "Confira a comunidade e o usuário." };
  const { supabase, userId } = await authenticatedUserId();
  if (!userId) return { error: "Sua sessão expirou." };

  const { data: target } = await supabase.from("profiles").select("id, display_name").eq("username", username.data).maybeSingle();
  if (!target || target.id === userId) return { error: "Amigo não encontrado." };
  const [userA, userB] = [userId, target.id].sort();
  const { data: friendship } = await supabase.from("friendships").select("status").eq("user_a", userA).eq("user_b", userB).maybeSingle();
  if (friendship?.status !== "accepted") return { error: "Adicione essa pessoa como amiga antes de convidar." };

  const { error } = await supabase.from("community_invitations").insert({ community_id: communityId.data, inviter_id: userId, invitee_id: target.id });
  if (error?.code === "23505") return { error: "Essa pessoa já possui um convite pendente." };
  if (error) return { error: "Não foi possível enviar o convite." };
  return { success: `Convite enviado para ${target.display_name}.` };
}

export async function respondCommunityInviteAction(_state: SocialActionState, formData: FormData): Promise<SocialActionState> {
  const invitationId = uuidSchema.safeParse(formData.get("invitationId"));
  const decision = z.enum(["accepted", "declined"]).safeParse(formData.get("decision"));
  if (!invitationId.success || !decision.success) return { error: "Convite inválido." };
  const { supabase, userId } = await authenticatedUserId();
  if (!userId) return { error: "Sua sessão expirou." };

  const { data: invitation } = await supabase.from("community_invitations").select("community_id, invitee_id").eq("id", invitationId.data).eq("invitee_id", userId).maybeSingle();
  if (!invitation) return { error: "Convite não encontrado." };
  const { error } = await supabase.from("community_invitations").update({ status: decision.data, responded_at: new Date().toISOString() }).eq("id", invitationId.data);
  if (error) return { error: "Não foi possível responder ao convite." };

  if (decision.data === "accepted") {
    const { error: membershipError } = await supabase.from("community_members").insert({ community_id: invitation.community_id, user_id: userId, role: "member" });
    if (membershipError?.code !== "23505" && membershipError) return { error: "Convite aceito, mas a entrada não foi concluída." };
    revalidatePath("/");
  }
  return { success: decision.data === "accepted" ? "Você entrou na comunidade." : "Convite recusado." };
}

export async function joinCommunityAction(_state: SocialActionState, formData: FormData): Promise<SocialActionState> {
  const communityId = uuidSchema.safeParse(String(formData.get("communityId") ?? "").trim());
  if (!communityId.success) return { error: "Digite um código de comunidade válido." };
  const { supabase, userId } = await authenticatedUserId();
  if (!userId) return { error: "Sua sessão expirou." };

  const { data: community } = await supabase.from("communities").select("id, name, join_policy").eq("id", communityId.data).maybeSingle();
  if (!community) return { error: "Comunidade não encontrada ou privada." };
  const { data: membership } = await supabase.from("community_members").select("user_id").eq("community_id", community.id).eq("user_id", userId).maybeSingle();
  if (membership) return { error: "Você já participa desta comunidade." };

  if (community.join_policy === "open") {
    const { error } = await supabase.from("community_members").insert({ community_id: community.id, user_id: userId, role: "member" });
    if (error) return { error: "Não foi possível entrar na comunidade." };
    revalidatePath("/");
    return { success: `Você entrou em ${community.name}.` };
  }

  const { error } = await supabase.from("community_join_requests").insert({ community_id: community.id, user_id: userId });
  if (error?.code === "23505") return { error: "Sua solicitação já está aguardando aprovação." };
  if (error) return { error: "Não foi possível enviar a solicitação." };
  return { success: `Solicitação enviada para ${community.name}.` };
}

export async function reviewJoinRequestAction(_state: SocialActionState, formData: FormData): Promise<SocialActionState> {
  const requestId = uuidSchema.safeParse(formData.get("requestId"));
  const decision = z.enum(["approved", "declined"]).safeParse(formData.get("decision"));
  if (!requestId.success || !decision.success) return { error: "Solicitação inválida." };
  const { supabase, userId } = await authenticatedUserId();
  if (!userId) return { error: "Sua sessão expirou." };

  const { data: request } = await supabase.from("community_join_requests").select("community_id, user_id").eq("id", requestId.data).maybeSingle();
  if (!request) return { error: "Solicitação não encontrada." };
  const { error } = await supabase.from("community_join_requests").update({ status: decision.data, reviewed_by: userId, reviewed_at: new Date().toISOString() }).eq("id", requestId.data);
  if (error) return { error: "Você não pode revisar esta solicitação." };
  if (decision.data === "approved") {
    const { error: membershipError } = await supabase.from("community_members").insert({ community_id: request.community_id, user_id: request.user_id, role: "member" });
    if (membershipError?.code !== "23505" && membershipError) return { error: "Aprovado, mas não foi possível adicionar o membro." };
  }
  return { success: decision.data === "approved" ? "Entrada aprovada." : "Solicitação recusada." };
}

export async function updateJoinPolicyAction(_state: SocialActionState, formData: FormData): Promise<SocialActionState> {
  const communityId = uuidSchema.safeParse(formData.get("communityId"));
  const joinPolicy = z.enum(["open", "admin_approval", "member_approval"]).safeParse(formData.get("joinPolicy"));
  if (!communityId.success || !joinPolicy.success) return { error: "Configuração inválida." };
  const { supabase, userId } = await authenticatedUserId();
  if (!userId) return { error: "Sua sessão expirou." };
  const { data: updated, error } = await supabase.from("communities").update({ join_policy: joinPolicy.data }).eq("id", communityId.data).select("id").maybeSingle();
  if (error || !updated) return { error: "Você não tem permissão para alterar a entrada." };
  revalidatePath("/");
  return { success: "Regra de entrada atualizada." };
}

export async function createCommunityInviteLinkAction(_state: SocialActionState, formData: FormData): Promise<SocialActionState> {
  const communityId = uuidSchema.safeParse(formData.get("communityId"));
  if (!communityId.success) return { error: "Comunidade inválida." };
  const { supabase, userId } = await authenticatedUserId();
  if (!userId) return { error: "Sua sessão expirou." };

  const { data: existing } = await supabase
    .from("community_invite_links")
    .select("token")
    .eq("community_id", communityId.data)
    .is("revoked_at", null)
    .maybeSingle();
  if (existing?.token) return { success: "Link de convite pronto.", inviteToken: existing.token };

  const { data, error } = await supabase
    .from("community_invite_links")
    .insert({ community_id: communityId.data, created_by: userId })
    .select("token")
    .single();
  if (error?.code === "23505") {
    const { data: permanent } = await supabase.from("community_invite_links").select("token").eq("community_id", communityId.data).maybeSingle();
    if (permanent?.token) return { success: "Link permanente pronto.", inviteToken: permanent.token };
  }
  if (error || !data) return { error: "Você não tem permissão para criar o link permanente." };
  return { success: "Link de convite criado.", inviteToken: data.token };
}

export async function redeemCommunityInviteAction(token: string): Promise<SocialActionState> {
  const parsedToken = z.string().regex(/^[a-f0-9]{36}$/).safeParse(token);
  if (!parsedToken.success) return { error: "Este convite não é válido." };
  const { supabase, userId } = await authenticatedUserId();
  if (!userId) return { error: "Entre na sua conta para aceitar o convite." };
  const { data: communityId, error } = await supabase.rpc("redeem_community_invite", { invite_token: parsedToken.data });
  if (error) return { error: error.message.includes("expired") ? "Este convite expirou ou foi desativado." : "Não foi possível aceitar este convite." };
  revalidatePath("/");
  const { data: membership } = await supabase.from("community_members").select("community_id").eq("community_id", communityId).eq("user_id", userId).maybeSingle();
  if (membership) redirect(`/?community=${communityId}`);
  return { success: "Solicitação enviada. Um administrador precisa aprovar sua entrada." };
}

export async function joinCommunityByInviteLinkAction(_state: SocialActionState, formData: FormData): Promise<SocialActionState> {
  const raw = z.string().trim().max(500).safeParse(formData.get("inviteLink"));
  if (!raw.success) return { error: "Cole um link de convite válido." };
  const token = raw.data.match(/(?:\/invite\/|^)([a-f0-9]{36})(?:[/?#]|$)/i)?.[1]?.toLowerCase();
  if (!token) return { error: "Este link de convite não é válido." };
  return redeemCommunityInviteAction(token);
}

export async function blockUserAction(_state: SocialActionState, formData: FormData): Promise<SocialActionState> {
  const targetUserId = uuidSchema.safeParse(formData.get("targetUserId"));
  const blocked = z.enum(["true", "false"]).safeParse(formData.get("blocked"));
  if (!targetUserId.success || !blocked.success) return { error: "Usuário inválido." };
  const { supabase, userId } = await authenticatedUserId();
  if (!userId) return { error: "Sua sessão expirou." };
  if (targetUserId.data === userId) return { error: "Você não pode bloquear a si mesmo." };

  if (blocked.data === "true") {
    const { error } = await supabase.from("user_blocks").upsert({ blocker_id: userId, blocked_id: targetUserId.data });
    if (error) return { error: "Não foi possível bloquear este usuário." };
    return { success: "Usuário bloqueado." };
  }
  const { error } = await supabase.from("user_blocks").delete().eq("blocker_id", userId).eq("blocked_id", targetUserId.data);
  if (error) return { error: "Não foi possível desbloquear este usuário." };
  return { success: "Usuário desbloqueado." };
}

export async function openDirectConversationAction(targetUserId: string): Promise<{ conversationId?: string; error?: string }> {
  const target = uuidSchema.safeParse(targetUserId);
  if (!target.success) return { error: "Usuário inválido." };
  const { supabase, userId } = await authenticatedUserId();
  if (!userId) return { error: "Sua sessão expirou." };
  const [userA, userB] = [userId, target.data].sort();
  const { data: existing } = await supabase.from("direct_conversations").select("id").eq("user_a", userA).eq("user_b", userB).maybeSingle();
  if (existing) return { conversationId: existing.id };
  const { data, error } = await supabase.from("direct_conversations").insert({ user_a: userA, user_b: userB }).select("id").single();
  if (error || !data) return { error: "A conversa privada só pode ser aberta entre amigos que não se bloquearam." };
  return { conversationId: data.id };
}
