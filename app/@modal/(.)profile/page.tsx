import { redirect } from "next/navigation";
import { ProfileRouteModal } from "@/components/profile/profile-route-modal";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function InterceptedProfilePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!profile) redirect("/login?error=profile");

  return <ProfileRouteModal profile={profile} />;
}
