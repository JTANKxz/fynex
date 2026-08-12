export const ROLE_ICON_NAMES = ["shield", "star", "crown", "swords", "code", "palette", "gamepad", "music", "heart", "sparkles"] as const;
export type RoleIconName = (typeof ROLE_ICON_NAMES)[number];
export const ROLE_ICON_OPTIONS: Array<{ value: RoleIconName; label: string }> = [
  { value: "shield", label: "Escudo" }, { value: "star", label: "Estrela" }, { value: "crown", label: "Coroa" },
  { value: "swords", label: "Espadas" }, { value: "code", label: "Código" }, { value: "palette", label: "Design" },
  { value: "gamepad", label: "Jogos" }, { value: "music", label: "Música" }, { value: "heart", label: "Coração" }, { value: "sparkles", label: "Destaque" },
];
