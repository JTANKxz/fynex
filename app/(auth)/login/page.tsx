import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/auth-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ status?: string; error?: string; next?: string }> }) {
  const query = await searchParams;
  return <AuthShell eyebrow="BEM-VINDO DE VOLTA" title="Entre no FYNEX" description="Sua comunidade continua exatamente de onde você parou.">
    {query.status === "account-created" && <p className="form-message success">Conta criada. Entre com seu e-mail e senha.</p>}
    {query.error === "confirmation" && <p className="form-message error">O link expirou ou não pôde ser confirmado. Tente entrar novamente.</p>}
    <LoginForm next={query.next} />
  </AuthShell>;
}
