import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/auth-form";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const query = await searchParams;
  return <AuthShell eyebrow="COMECE AGORA" title="Crie seu perfil" description="Um nome, uma identidade e espaço para construir algo novo."><RegisterForm next={query.next} /></AuthShell>;
}
