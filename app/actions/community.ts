"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const communitySchema = z.object({
  name: z.string().trim().min(2).max(50),
  description: z.string().trim().max(190),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export type CommunityActionState = { error?: string; communityId?: string };

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
  const { error: channelsError } = await supabase.from("channels").insert([
    { community_id: community.id, name: "geral", type: "text", position: 0 },
    { community_id: community.id, name: "conversa", type: "voice", position: 1 },
  ]);

  if (membershipError || channelsError) {
    await supabase.from("communities").delete().eq("id", community.id);
    return { error: "A comunidade não pôde ser finalizada. Tente novamente." };
  }

  revalidatePath("/");
  return { communityId: community.id };
}
