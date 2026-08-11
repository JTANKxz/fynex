"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const communitySchema = z.object({
  name: z.string().trim().min(2).max(50),
  description: z.string().trim().max(190),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

const channelSchema = z.object({
  communityId: z.uuid(),
  name: z.string().trim().min(1).max(32),
  type: z.enum(["text", "voice"]),
  userLimit: z.coerce.number().int().min(1).max(10).optional(),
});

export type CommunityActionState = { error?: string; success?: string; communityId?: string };

export async function createCommunityAction(_state: CommunityActionState, formData: FormData): Promise<CommunityActionState> {
  const parsed = communitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Confira o nome, a descrição e a cor." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "Sua sessão expirou. Entre novamente." };

  const { data: community, error } = await supabase.from("communities").insert({
    name: parsed.data.name,
    description: parsed.data.description,
    accent_color: parsed.data.accentColor,
    owner_id: userId,
  }).select("*").single();

  if (error || !community) return { error: "Não foi possível criar a comunidade." };

  const { error: membershipError } = await supabase.from("community_members").insert({ community_id: community.id, user_id: userId, role: "owner" });
  if (membershipError) {
    await supabase.from("communities").delete().eq("id", community.id);
    return { error: "Não foi possível vincular você à comunidade." };
  }

  const { error: channelsError } = await supabase.from("channels").insert([
    { community_id: community.id, name: "geral", type: "text", position: 0 },
    { community_id: community.id, name: "conversa", type: "voice", position: 1 },
  ]);

  if (channelsError) {
    await supabase.from("communities").delete().eq("id", community.id);
    return { error: "A comunidade não pôde ser finalizada. Tente novamente." };
  }

  revalidatePath("/");
  return { communityId: community.id };
}

const updateCommunitySchema = communitySchema.extend({ communityId: z.uuid() });

export async function updateCommunityAction(_state: CommunityActionState, formData: FormData): Promise<CommunityActionState> {
  const parsed = updateCommunitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Confira o nome, a descrição e a cor." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "Sua sessão expirou. Entre novamente." };

  const { data: community, error } = await supabase.from("communities").update({
    name: parsed.data.name,
    description: parsed.data.description,
    accent_color: parsed.data.accentColor,
  }).eq("id", parsed.data.communityId).eq("owner_id", userId).select("id").maybeSingle();
  if (error || !community) return { error: "Somente o criador pode editar esta comunidade." };
  revalidatePath("/");
  return { success: "Comunidade atualizada.", communityId: community.id };
}

export type ChannelActionState = { error?: string; channelId?: string; channelType?: "text" | "voice" };

function channelSlug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
}

export async function createChannelAction(_state: ChannelActionState, formData: FormData): Promise<ChannelActionState> {
  const parsed = channelSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Confira o nome e o tipo do canal." };

  const name = channelSlug(parsed.data.name);
  if (!name) return { error: "Use pelo menos uma letra ou número no nome." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "Sua sessão expirou. Entre novamente." };

  const { data: community } = await supabase.from("communities").select("id").eq("id", parsed.data.communityId).maybeSingle();
  if (!community) return { error: "Comunidade não encontrada." };

  const { data: lastChannel } = await supabase.from("channels").select("position").eq("community_id", community.id).order("position", { ascending: false }).limit(1).maybeSingle();
  const position = Math.min((lastChannel?.position ?? -1) + 1, 32767);
  const { data: channel, error } = await supabase.from("channels").insert({
    community_id: community.id,
    name,
    type: parsed.data.type,
    position,
    created_by: userId,
    user_limit: parsed.data.type === "voice" ? (parsed.data.userLimit ?? 10) : null,
  }).select("id, type").single();

  if (error?.code === "23505") return { error: "Já existe um canal com esse nome nesta comunidade." };
  if (error || !channel) return { error: "Não foi possível criar o canal." };

  revalidatePath("/");
  return { channelId: channel.id, channelType: channel.type as "text" | "voice" };
}

const updateChannelSchema = channelSchema.extend({ channelId: z.uuid() });

export async function updateChannelAction(_state: ChannelActionState, formData: FormData): Promise<ChannelActionState> {
  const parsed = updateChannelSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Confira o nome e o limite do canal." };
  const name = channelSlug(parsed.data.name);
  if (!name) return { error: "Use pelo menos uma letra ou número no nome." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { error: "Sua sessão expirou. Entre novamente." };

  const { data: channel, error } = await supabase.from("channels").update({
    name,
    user_limit: parsed.data.type === "voice" ? (parsed.data.userLimit ?? 10) : null,
  }).eq("id", parsed.data.channelId).eq("community_id", parsed.data.communityId).eq("type", parsed.data.type).select("id, type").single();

  if (error?.code === "23505") return { error: "Já existe um canal com esse nome nesta comunidade." };
  if (error || !channel) return { error: "Você não tem permissão para editar este canal." };
  revalidatePath("/");
  return { channelId: channel.id, channelType: channel.type as "text" | "voice" };
}
