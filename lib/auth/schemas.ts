import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Digite um e-mail válido.").max(254),
  password: z.string().min(1, "Digite sua senha.").max(72),
});

export const registerSchema = z.object({
  displayName: z.string().trim().min(2, "O nome precisa ter pelo menos 2 caracteres.").max(50),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, "Use 3–24 letras minúsculas, números ou _.") ,
  email: z.email("Digite um e-mail válido.").max(254),
  password: z.string().min(10, "Use pelo menos 10 caracteres.").max(72),
});

export const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(50),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/),
  bio: z.string().trim().max(190),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export type ActionState = { error?: string; success?: string };
