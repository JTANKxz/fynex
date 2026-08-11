import type { Metadata } from "next";
import "./theme-v5.css";

export const metadata: Metadata = {
  title: { default: "FYNEX — encontre seu ritmo", template: "%s · FYNEX" },
  description: "Comunidades, conversas e voz em tempo real em um espaço mais leve.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{ children: React.ReactNode; modal?: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}{modal}</body></html>;
}
