import Link from "next/link";
import { AudioLines, MessageCircleMore, ShieldCheck } from "lucide-react";

export function AuthShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <main className="auth-shell">
      <div className="auth-orb auth-orb-one" /><div className="auth-orb auth-orb-two" />
      <section className="auth-story">
        <Link href="/" className="auth-brand"><span>F</span>FYNEX</Link>
        <div><p className="auth-kicker">SEU ESPAÇO. SEU RITMO.</p><h1>Converse sem ruído.<br /><em>Fique por perto.</em></h1><p>Comunidades, mensagens e voz em uma experiência feita para parecer sua — não uma cópia.</p></div>
        <ul><li><MessageCircleMore />Conversas em tempo real</li><li><AudioLines />Voz direta e econômica</li><li><ShieldCheck />Conta e dados protegidos</li></ul>
      </section>
      <section className="auth-panel"><div className="auth-card"><span className="auth-eyebrow">{eyebrow}</span><h2>{title}</h2><p>{description}</p>{children}</div><small>FYNEX · conexão que respeita seu espaço</small></section>
    </main>
  );
}
