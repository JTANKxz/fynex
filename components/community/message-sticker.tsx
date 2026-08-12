import NextImage from "next/image";
import type { CommunitySticker } from "@/lib/supabase/database.types";
import styles from "./message-sticker.module.css";

export function MessageSticker({ sticker }: { sticker?: CommunitySticker }) {
  if (!sticker) return <div className={styles.unavailable}>Figurinha indisponível nesta comunidade</div>;
  return <figure className={styles.sticker} aria-label={`Figurinha ${sticker.name}`}>
    <NextImage unoptimized src={sticker.image_url} alt={sticker.name} width={180} height={180} />
    <figcaption>{sticker.name}</figcaption>
  </figure>;
}
