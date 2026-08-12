"use client";

import EmojiPicker, { EmojiStyle, SuggestionMode, Theme, type EmojiClickData } from "emoji-picker-react";
import styles from "./fynex-emoji-picker.module.css";

export function FynexEmojiPicker({ onEmoji, compact = false }: { onEmoji: (emoji: string) => void; compact?: boolean }) {
  return <div className={`${styles.shell} ${compact ? styles.compact : ""}`}>
    <EmojiPicker
      theme={Theme.DARK}
      emojiStyle={EmojiStyle.NATIVE}
      suggestedEmojisMode={SuggestionMode.RECENT}
      lazyLoadEmojis
      searchPlaceHolder="Buscar emoji"
      previewConfig={{ showPreview: false }}
      width="100%"
      height={compact ? 330 : 390}
      onEmojiClick={(emoji: EmojiClickData) => onEmoji(emoji.emoji)}
    />
  </div>;
}
