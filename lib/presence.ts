import type { PresenceStatus } from "@/features/community/model";

export const presenceLabels: Record<PresenceStatus, string> = {
  online: "Disponível",
  idle: "Ausente",
  dnd: "Não incomodar",
  invisible: "Offline",
};
