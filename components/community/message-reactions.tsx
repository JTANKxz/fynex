"use client";

import type { MessageReaction } from "@/lib/supabase/database.types";
import { FynexEmojiPicker } from "@/components/ui/fynex-emoji-picker";
import styles from "./message-reactions.module.css";

export function MessageReactions({ reactions, currentUserId, onToggle }: {
  reactions: MessageReaction[];
  currentUserId: string;
  onToggle: (emoji: string) => void;
}) {
  const grouped = new Map<string, { count: number; active: boolean }>();
  reactions.forEach((reaction) => {
    const current = grouped.get(reaction.emoji) ?? { count: 0, active: false };
    grouped.set(reaction.emoji, { count: current.count + 1, active: current.active || reaction.user_id === currentUserId });
  });
  if (!grouped.size) return null;
  return <div className={styles.list} aria-label="Reações da mensagem">
    {[...grouped.entries()].map(([emoji, value]) => <button type="button" key={emoji} className={`${styles.reaction} ${value.active ? styles.active : ""}`} onClick={() => onToggle(emoji)} aria-label={`${value.active ? "Remover" : "Adicionar"} reação ${emoji}. ${value.count} no total`}>{emoji}<span>{value.count}</span></button>)}
  </div>;
}

export function MessageReactionPicker({ onReact }: { onReact: (emoji: string) => void }) {
  return <div className={styles.fullPicker} aria-label="Escolher reação"><FynexEmojiPicker compact onEmoji={onReact} /></div>;
}
