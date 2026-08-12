"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";
import { loginAction, registerAction } from "@/app/actions/auth";
import type { ActionState } from "@/lib/auth/schemas";

const initialState: ActionState = {};

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return <button className="auth-submit" disabled={pending}>{pending && <LoaderCircle size={17} className="spin" />}{children}</button>;
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, initialState);
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="next" value={next ?? ""} />
      <label>E-mail<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="voce@exemplo.com" /></label>
      <label>Senha<input name="password" type="password" autoComplete="current-password" required maxLength={72} placeholder="Sua senha" /></label>
      {state.error && <p className="form-message error" role="alert">{state.error}</p>}
      <SubmitButton pending={pending}>Entrar</SubmitButton>
      <p className="auth-switch">Ainda não tem conta? <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}>Criar conta</Link></p>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(registerAction, initialState);
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="auth-form-row">
        <label>Nome<input name="displayName" autoComplete="name" required minLength={2} maxLength={50} placeholder="Como quer ser chamado" /></label>
        <label>Usuário<input name="username" autoComplete="username" required minLength={3} maxLength={24} pattern="[a-z0-9_]+" placeholder="seu_usuario" /></label>
      </div>
      <label>E-mail<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="voce@exemplo.com" /></label>
      <label>Senha<input name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={72} placeholder="No mínimo 10 caracteres" /></label>
      {state.error && <p className="form-message error" role="alert">{state.error}</p>}
      <SubmitButton pending={pending}>Criar minha conta</SubmitButton>
      <p className="auth-switch">Já tem uma conta? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>Fazer login</Link></p>
    </form>
  );
}
