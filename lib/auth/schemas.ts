import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Digite um e-mail válido.").max(254),
  password: z.string().min(1, "Digite sua senha.").max(72),
  next: z.string().max(500).optional(),
});

export const registerSchema = z.object({
  displayName: z.string().trim().min(2, "O nome precisa ter pelo menos 2 caracteres.").max(50),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, "Use 3–24 letras minúsculas, números ou _.") ,
  email: z.email("Digite um e-mail válido.").max(254),
  password: z.string().min(10, "Use pelo menos 10 caracteres.").max(72),
  next: z.string().max(500).optional(),
});

export const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(50),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/),
  bio: z.string().trim().max(190),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  presenceStatus: z.enum(["online", "idle", "dnd", "invisible"]),
  songId: z.string().regex(/^[A-Za-z0-9]{1,64}$/).optional().or(z.literal("")),
  songName: z.string().trim().max(160).optional().or(z.literal("")),
  songArtist: z.string().trim().max(160).optional().or(z.literal("")),
  songCoverUrl: z.url().max(500).optional().or(z.literal("")),
  songPreviewUrl: z.url().max(500).optional().or(z.literal("")),
  songSpotifyUrl: z.url().max(500).optional().or(z.literal("")),
  songDurationMs: z.coerce.number().int().min(30000).max(86400000).optional().or(z.literal("")),
  songStartSeconds: z.coerce.number().int().min(0).max(86400).optional().or(z.literal("")),
});

export type ActionState = { error?: string; success?: string };
