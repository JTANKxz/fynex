import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "FYNEX — encontre seu ritmo", template: "%s · FYNEX" },
  description: "Comunidades, conversas e voz em tempo real em um espaço mais leve.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
