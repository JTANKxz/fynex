"use client";

import type { MemberProfile } from "./member-profile-modal";
import styles from "./message-mention-text.module.css";

const MENTION_PATTERN = /(@(?:todos|[a-zA-Z0-9_]{3,24}))/gi;

export function MessageMentionText({ content, members, onProfile }: { content: string; members: MemberProfile[]; onProfile: (member: MemberProfile) => void }) {
  const byUsername = new Map(members.map((member) => [member.username.toLowerCase(), member]));

  return <>{content.split(MENTION_PATTERN).map((part, index) => {
    if (!part.startsWith("@")) return part;
    const username = part.slice(1).toLowerCase();
    if (username === "todos") return <mark className={`${styles.mention} ${styles.everyone}`} key={`${part}-${index}`}>{part}</mark>;
    const member = byUsername.get(username);
    if (!member) return part;
    return <button className={styles.mention} type="button" key={`${part}-${index}`} onClick={() => onProfile(member)} title={`Ver perfil de ${member.display_name}`}>{part}</button>;
  })}</>;
}
