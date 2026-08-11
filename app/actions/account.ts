"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { deleteImageKitFile } from "@/lib/media/imagekit-server";
import { createClient } from "@/lib/supabase/server";

export type AccountActionState = { error?: string };

const deleteAccountSchema = z.object({
  confirmation: z.literal("EXCLUIR"),
});

export async function deleteAccountAction(_state: AccountActionState, formData: FormData): Promise<AccountActionState> {
  const parsed = deleteAccountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Digite EXCLUIR para confirmar." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "Sua sessão expirou. Entre novamente." };

  const [{ data: profile }, { data: communities }, { data: attachments }] = await Promise.all([
    supabase.from("profiles").select("avatar_file_id, banner_file_id").eq("id", userId).maybeSingle(),
    supabase.from("communities").select("avatar_file_id, banner_file_id").eq("owner_id", userId),
    supabase.from("messages").select("attachment_file_id").eq("author_id", userId).not("attachment_file_id", "is", null),
  ]);

  const { data: deleted, error } = await supabase.rpc("delete_current_account");
  if (error || !deleted) return { error: "Não foi possível excluir a conta. Tente novamente." };

  const mediaIds = new Set([
    profile?.avatar_file_id,
    profile?.banner_file_id,
    ...(communities ?? []).flatMap((community) => [community.avatar_file_id, community.banner_file_id]),
    ...(attachments ?? []).map((attachment) => attachment.attachment_file_id),
  ].filter((value): value is string => Boolean(value)));
  await Promise.allSettled([...mediaIds].map((fileId) => deleteImageKitFile(fileId)));

  const cookieStore = await cookies();
  cookieStore.getAll()
    .filter((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"))
    .forEach((cookie) => cookieStore.delete(cookie.name));
  redirect("/login?status=account-deleted");
}
