import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/auth-form";

export default function RegisterPage() {
  return <AuthShell eyebrow="COMECE AGORA" title="Crie seu perfil" description="Um nome, uma identidade e espaço para construir algo novo."><RegisterForm /></AuthShell>;
}
