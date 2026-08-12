"use client";

import type { PollVote } from "@/lib/supabase/database.types";
import styles from "./message-poll.module.css";

export function MessagePoll({ question, options, votes, currentUserId, disabled, onVote }: { question: string; options: string[]; votes: PollVote[]; currentUserId: string; disabled?: boolean; onVote: (optionIndex: number) => void }) {
  const total = votes.length;
  const ownVote = votes.find((vote) => vote.user_id === currentUserId)?.option_index;
  return <section className={styles.poll} aria-label={`Enquete: ${question}`}>
    <header><small>ENQUETE</small><strong>{question}</strong></header>
    <div>{options.map((option, index) => {
      const count = votes.filter((vote) => vote.option_index === index).length;
      const percent = total ? Math.round((count / total) * 100) : 0;
      return <button type="button" key={`${index}-${option}`} disabled={disabled} className={ownVote === index ? styles.selected : ""} onClick={() => onVote(index)} aria-label={`Votar em ${option}`}><i style={{ width: `${percent}%` }} /><span><b>{option}</b><small>{count} voto{count === 1 ? "" : "s"}</small></span><em>{percent}%</em></button>;
    })}</div>
    <footer>{total} voto{total === 1 ? "" : "s"} · escolha uma opção</footer>
  </section>;
}
