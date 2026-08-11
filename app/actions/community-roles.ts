"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const checkbox = z.enum(["on"]).optional().transform(Boolean);
const roleSchema = z.object({
  communityId: z.uuid(),
  name: z.string().trim().min(1).max(32),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  position: z.coerce.number().int().min(1).max(32000),
  isAdmin: checkbox,
  manageChannels: checkbox,
  manageRoles: checkbox,
  manageMessages: checkbox,
  manageMembers: checkbox,
});

export type RoleActionState = { error?: string; success?: string; roleId?: string };

async function authenticatedClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims?.sub ?? null };
}

export async function createCommunityRoleAction(_state: RoleActionState, formData: FormData): Promise<RoleActionState> {
  const parsed = roleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Confira o nome, a cor, a posição e as permissões." };
  const { supabase, userId } = await authenticatedClient();
  if (!userId) return { error: "Sua sessão expirou. Entre novamente." };

  const { data, error } = await supabase.from("community_roles").insert({
    community_id: parsed.data.communityId,
    name: parsed.data.name,
    color: parsed.data.color,
    position: parsed.data.position,
    is_admin: parsed.data.isAdmin,
    manage_channels: parsed.data.manageChannels,
    manage_roles: parsed.data.manageRoles,
    manage_messages: parsed.data.manageMessages,
    manage_members: parsed.data.manageMembers,
    created_by: userId,
  }).select("id").single();

  if (error?.code === "23505") return { error: "Já existe um cargo com esse nome." };
  if (error || !data) return { error: "Você não pode criar esse cargo ou a posição está acima da sua." };
  revalidatePath("/");
  return { roleId: data.id, success: "Cargo criado." };
}

const assignmentSchema = z.object({
  communityId: z.uuid(),
  userId: z.uuid(),
  roleId: z.uuid(),
  operation: z.enum(["assign", "remove"]),
});

export async function changeMemberRoleAction(_state: RoleActionState, formData: FormData): Promise<RoleActionState> {
  const parsed = assignmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Seleção de cargo inválida." };
  const { supabase, userId } = await authenticatedClient();
  if (!userId) return { error: "Sua sessão expirou. Entre novamente." };

  const query = parsed.data.operation === "assign"
    ? supabase.from("community_member_roles").insert({ community_id: parsed.data.communityId, user_id: parsed.data.userId, role_id: parsed.data.roleId, assigned_by: userId })
    : supabase.from("community_member_roles").delete().eq("community_id", parsed.data.communityId).eq("user_id", parsed.data.userId).eq("role_id", parsed.data.roleId);
  const { error } = await query;
  if (error?.code === "23505") return { success: "Esse membro já possui o cargo." };
  if (error) return { error: "Você não pode alterar os cargos desse membro." };
  revalidatePath("/");
  return { success: parsed.data.operation === "assign" ? "Cargo atribuído." : "Cargo removido." };
}

const removeMemberSchema = z.object({ communityId: z.uuid(), userId: z.uuid() });

const deleteRoleSchema = z.object({ roleId: z.uuid() });

export async function deleteCommunityRoleAction(_state: RoleActionState, formData: FormData): Promise<RoleActionState> {
  const parsed = deleteRoleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Cargo inválido." };
  const { supabase, userId } = await authenticatedClient();
  if (!userId) return { error: "Sua sessão expirou. Entre novamente." };
  const { error, count } = await supabase.from("community_roles").delete({ count: "exact" }).eq("id", parsed.data.roleId);
  if (error || !count) return { error: "Você não pode excluir esse cargo." };
  revalidatePath("/");
  return { success: "Cargo excluído." };
}

export async function removeCommunityMemberAction(_state: RoleActionState, formData: FormData): Promise<RoleActionState> {
  const parsed = removeMemberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Membro inválido." };
  const { supabase, userId } = await authenticatedClient();
  if (!userId) return { error: "Sua sessão expirou. Entre novamente." };
  const { error, count } = await supabase.from("community_members").delete({ count: "exact" }).eq("community_id", parsed.data.communityId).eq("user_id", parsed.data.userId);
  if (error || !count) return { error: "Você não pode remover esse membro. O criador é sempre protegido." };
  revalidatePath("/");
  return { success: "Membro removido da comunidade." };
}
