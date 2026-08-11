export type LinkPreview = {
  url: string;
  title: string;
  description: string | null;
  siteName: string;
};

const LINK_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"']+/i;
const TRAILING_PUNCTUATION = /[.,!?;:)}\]]+$/;

export function normalizeLink(value: string) {
  const trimmed = value.trim().replace(TRAILING_PUNCTUATION, "");
  const candidate = trimmed.toLowerCase().startsWith("www.") ? `https://${trimmed}` : trimmed;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function extractFirstLink(content: string) {
  const match = content.match(LINK_PATTERN)?.[0];
  return match ? normalizeLink(match) : null;
}
