export const CHAT_IMAGE_LIMIT = 8_000_000;
export const CHAT_VIDEO_LIMIT = 20_000_000;
export const CHAT_ATTACHMENT_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime";

export const CHAT_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
export const CHAT_VIDEO_MIMES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export type ChatAttachmentKind = "image" | "video";
export type ChatAttachmentDraft = { file: File; kind: ChatAttachmentKind; previewUrl: string };

export function formatFileSize(value: number) {
  return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(".0", "")} MB`;
}
