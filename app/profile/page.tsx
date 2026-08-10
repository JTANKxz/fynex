import Link from "next/link";
import { ArrowLeft, LogOut } from "lucide-react";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { ProfileExperience } from "@/components/profile/profile-experience";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Seu perfil" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (!profile) redirect("/login?error=profile");
  return <main className="profile-shell"><div className="profile-top"><Link href="/"><ArrowLeft size={17} />Voltar ao FYNEX</Link><form action={logoutAction}><button><LogOut size={16} />Sair da conta</button></form></div><ProfileExperience profile={profile} /></main>;
}
