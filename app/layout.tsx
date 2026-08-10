import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;
  return {
    title: "FYNEX — encontre seu ritmo",
    description: "Comunidades, conversas e voz em tempo real em um espaço mais leve.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title: "FYNEX — encontre seu ritmo", description: "Comunidades, conversas e voz em tempo real em um espaço mais leve.", images: [{ url: imageUrl, width: 1536, height: 864, alt: "FYNEX — encontre seu ritmo" }] },
    twitter: { card: "summary_large_image", title: "FYNEX — encontre seu ritmo", description: "Comunidades, conversas e voz em tempo real em um espaço mais leve.", images: [imageUrl] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
