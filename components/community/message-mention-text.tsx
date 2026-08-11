"use client";

import type { MemberProfile } from "./member-profile-modal";
import { normalizeLink } from "@/lib/links";
import styles from "./message-mention-text.module.css";

const TOKEN_PATTERN = /(@(?:todos|[a-zA-Z0-9_]{3,24})|(?:https?:\/\/|www\.)[^\s<>"']+)/gi;

export function MessageMentionText({ content, members, onProfile }: { content: string; members: MemberProfile[]; onProfile: (member: MemberProfile) => void }) {
  const byUsername = new Map(members.map((member) => [member.username.toLowerCase(), member]));

  return <>{content.split(TOKEN_PATTERN).map((part, index) => {
    const href = normalizeLink(part);
    if (href) {
      const label = part.replace(/[.,!?;:)}\]]+$/, "");
      const suffix = part.slice(label.length);
      return <span key={`${part}-${index}`}><a className={styles.link} href={href} target="_blank" rel="noopener noreferrer">{label}</a>{suffix}</span>;
    }
    if (!part.startsWith("@")) return part;
    const username = part.slice(1).toLowerCase();
    if (username === "todos") return <mark className={`${styles.mention} ${styles.everyone}`} key={`${part}-${index}`}>{part}</mark>;
    const member = byUsername.get(username);
    if (!member) return part;
    return <button className={styles.mention} type="button" key={`${part}-${index}`} onClick={() => onProfile(member)} title={`Ver perfil de ${member.display_name}`}>{part}</button>;
  })}</>;
}
