"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { profileSchema, type ActionState } from "@/lib/auth/schemas";

export async function updateProfileAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Confira o nome, usuário e descrição." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "Sua sessão expirou. Entre novamente." };

  const { error } = await supabase.from("profiles").update({
    display_name: parsed.data.displayName,
    username: parsed.data.username,
    bio: parsed.data.bio,
    accent_color: parsed.data.accentColor,
  }).eq("id", userId);

  if (error?.code === "23505") return { error: "Este nome de usuário já está em uso." };
  if (error) return { error: "Não foi possível salvar o perfil." };
  revalidatePath("/profile");
  revalidatePath("/");
  return { success: "Perfil atualizado." };
}
