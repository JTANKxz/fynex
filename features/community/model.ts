import type { Channel, Community, Message as MessageRow, Profile } from "@/lib/supabase/database.types";
import type { LinkPreview } from "@/lib/links";

export type PresenceStatus = "online" | "idle" | "dnd" | "invisible";
export type CommunityUser = { id: string; name: string; username?: string; color: string; avatarUrl?: string | null; status?: PresenceStatus };
export type MessageAttachment = { kind: "image" | "video"; url: string; mime: string; size: number; width?: number | null; height?: number | null; name: string };
export type CommunityMessage = { id: string; channelId: string; author: string; authorId: string; color: string; avatarUrl?: string | null; content: string; time: string; createdAt: string; replyToId?: string | null; attachment?: MessageAttachment; linkPreview?: LinkPreview };
export type CommunitySpace = Community;
export type CommunityChannel = Channel;
export type VoicePeer = { id: string; name: string; muted: boolean; speaking: boolean; stream?: MediaStream; screenStream?: MediaStream; screenSharing?: boolean; screenHeight?: number; screenFrameRate?: number };
export type PresenceUser = CommunityUser & { onlineAt: string; voiceChannel?: string | null; muted?: boolean };
export type VoiceSignal = {
  type: "announce" | "offer" | "answer" | "ice" | "leave" | "voice-state" | "screen-state" | "screen-watch";
  from: string; to?: string; channel?: string; name?: string; color?: string; muted?: boolean; speaking?: boolean; screenSharing?: boolean; watching?: boolean; screenHeight?: number; screenFrameRate?: number;
  payload?: RTCSessionDescriptionInit | RTCIceCandidateInit;
};

export function messageFromRow(row: MessageRow, profile: Pick<Profile, "display_name" | "accent_color" | "avatar_url">): CommunityMessage {
  const attachment = row.attachment_kind && row.attachment_url && row.attachment_mime && row.attachment_size && row.attachment_name
    ? { kind: row.attachment_kind as "image" | "video", url: row.attachment_url, mime: row.attachment_mime, size: row.attachment_size, width: row.attachment_width, height: row.attachment_height, name: row.attachment_name }
    : undefined;
  const linkPreview = row.link_preview_url && row.link_preview_title && row.link_preview_site_name
    ? { url: row.link_preview_url, title: row.link_preview_title, description: row.link_preview_description, siteName: row.link_preview_site_name }
    : undefined;
  return { id: row.id, channelId: row.channel_id, author: profile.display_name, authorId: row.author_id, color: profile.accent_color, avatarUrl: profile.avatar_url, content: row.content, time: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(row.created_at)), createdAt: row.created_at, replyToId: row.reply_to_id, attachment, linkPreview };
}
