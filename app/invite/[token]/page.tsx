import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InviteCard } from "./invite-card";

export default async function InvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ continue?: string }> }) {
  const { token } = await params;
  const query = await searchParams;
  if (!/^[a-f0-9]{36}$/.test(token)) notFound();
  const supabase = await createClient();
  const [{ data: inviteRows }, { data: auth }] = await Promise.all([
    supabase.rpc("get_community_invite", { invite_token: token }),
    supabase.auth.getClaims(),
  ]);
  const invite = inviteRows?.[0];
  if (!invite) notFound();
  const authenticated = Boolean(auth?.claims?.sub);
  return <InviteCard invite={invite} token={token} authenticated={authenticated} autoAccept={authenticated && query.continue === "1"} />;
}
