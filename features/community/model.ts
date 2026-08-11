import type { Channel, Community, Message as MessageRow, Profile } from "@/lib/supabase/database.types";

export type CommunityUser = { id: string; name: string; color: string; avatarUrl?: string | null };
export type MessageAttachment = { kind: "image" | "video"; url: string; mime: string; size: number; width?: number | null; height?: number | null; name: string };
export type CommunityMessage = { id: string; channelId: string; author: string; authorId: string; color: string; avatarUrl?: string | null; content: string; time: string; createdAt: string; replyToId?: string | null; attachment?: MessageAttachment };
export type CommunitySpace = Community;
export type CommunityChannel = Channel;
export type VoicePeer = { id: string; name: string; muted: boolean; speaking: boolean; stream?: MediaStream; screenStream?: MediaStream; screenSharing?: boolean };
export type PresenceUser = CommunityUser & { onlineAt: string; voiceChannel?: string | null; muted?: boolean };
export type VoiceSignal = {
  type: "announce" | "offer" | "answer" | "ice" | "leave" | "voice-state" | "screen-state" | "screen-watch";
  from: string; to?: string; channel?: string; name?: string; color?: string; muted?: boolean; speaking?: boolean; screenSharing?: boolean; watching?: boolean;
  payload?: RTCSessionDescriptionInit | RTCIceCandidateInit;
};

export function messageFromRow(row: MessageRow, profile: Pick<Profile, "display_name" | "accent_color" | "avatar_url">): CommunityMessage {
  const attachment = row.attachment_kind && row.attachment_url && row.attachment_mime && row.attachment_size && row.attachment_name
    ? { kind: row.attachment_kind as "image" | "video", url: row.attachment_url, mime: row.attachment_mime, size: row.attachment_size, width: row.attachment_width, height: row.attachment_height, name: row.attachment_name }
    : undefined;
  return { id: row.id, channelId: row.channel_id, author: profile.display_name, authorId: row.author_id, color: profile.accent_color, avatarUrl: profile.avatar_url, content: row.content, time: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(row.created_at)), createdAt: row.created_at, replyToId: row.reply_to_id, attachment };
}
