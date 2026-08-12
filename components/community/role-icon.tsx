import Image from "next/image";
import { Code2, Crown, Gamepad2, Heart, Music2, Palette, ShieldCheck, Sparkles, Star, Swords, type LucideIcon } from "lucide-react";
import type { RoleIconName } from "@/features/community/role-icons";
const ICONS: Record<RoleIconName, LucideIcon> = { shield: ShieldCheck, star: Star, crown: Crown, swords: Swords, code: Code2, palette: Palette, gamepad: Gamepad2, music: Music2, heart: Heart, sparkles: Sparkles };
export function RoleIcon({ name, customUrl, color, size = 12, className }: { name?: string | null; customUrl?: string | null; color?: string; size?: number; className?: string }) {
  if (customUrl) return <Image unoptimized className={className} src={customUrl} alt="" width={size} height={size} aria-hidden="true" style={{ width: size, height: size, objectFit: "contain" }} />;
  const Icon = ICONS[(name && name in ICONS ? name : "shield") as RoleIconName];
  return <Icon className={className} size={size} aria-hidden="true" style={{ color }} />;
}
