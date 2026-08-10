"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type SocialActionState = { error?: string; success?: string };

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
  const { error } = await supabase.from("communities").update({ join_policy: joinPolicy.data }).eq("id", communityId.data).eq("owner_id", userId);
  if (error) return { error: "Somente o dono pode alterar a entrada." };
  revalidatePath("/");
  return { success: "Regra de entrada atualizada." };
}
