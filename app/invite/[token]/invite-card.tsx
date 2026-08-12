"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef } from "react";
import { ArrowRight, Check, LoaderCircle, Users } from "lucide-react";
import { redeemCommunityInviteAction } from "@/app/actions/social";

type InvitePreview = {
  community_name: string;
  community_description: string;
  community_avatar_url: string | null;
  community_accent_color: string;
  join_policy: string;
};

export function InviteCard({ invite, token, authenticated, autoAccept }: { invite: InvitePreview; token: string; authenticated: boolean; autoAccept: boolean }) {
  const action = async () => redeemCommunityInviteAction(token);
  const [state, formAction, pending] = useActionState(action, {});
  const attempted = useRef(false);
  useEffect(() => {
    if (!autoAccept || attempted.current) return;
    attempted.current = true;
    startTransition(() => formAction());
  }, [autoAccept, formAction]);
  return <main className="invite-page">
    <section className="invite-link-card" style={{ "--invite-accent": invite.community_accent_color } as React.CSSProperties}>
      <span className="invite-label">VOCÊ RECEBEU UM CONVITE</span>
      <div className="invite-community-avatar" style={{ backgroundColor: invite.community_accent_color, backgroundImage: invite.community_avatar_url ? `url(${invite.community_avatar_url})` : undefined }}>{invite.community_avatar_url ? "" : invite.community_name.slice(0, 2).toUpperCase()}</div>
      <h1>{invite.community_name}</h1>
      <p>{invite.community_description || "Entre nesta comunidade para conversar, compartilhar e participar das chamadas."}</p>
      <div className="invite-policy"><Users size={15} /><span>{invite.join_policy === "open" ? "Entrada imediata" : "A entrada será enviada para aprovação"}</span></div>
      {state.error && <p className="form-message error">{state.error}</p>}
      {state.success ? <><div className="invite-success"><Check size={17} />{state.success}</div><Link href="/">Abrir FYNEX <ArrowRight size={15} /></Link></> : authenticated ? <form action={formAction}><button disabled={pending}>{pending ? <LoaderCircle className="spin" size={16} /> : <ArrowRight size={16} />}{pending ? "Entrando…" : "Entrar na comunidade"}</button></form> : <Link href={`/login?next=${encodeURIComponent(`/invite/${token}?continue=1`)}`}>Entrar e participar <ArrowRight size={15} /></Link>}
    </section>
  </main>;
}
