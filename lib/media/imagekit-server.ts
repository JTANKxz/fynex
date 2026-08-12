import "server-only";

export type ImageKitDetails = {
  fileId?: string;
  filePath?: string;
  url?: string;
  fileType?: string;
  mime?: string;
  size?: number;
  width?: number;
  height?: number;
};

function imageKitAuthHeader() {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!privateKey) throw new Error("ImageKit não configurado");
  return `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}`;
}

export async function getImageKitFile(fileId: string): Promise<ImageKitDetails | null> {
  const response = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}/details`, {
    headers: { Authorization: imageKitAuthHeader() }, cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json() as Promise<ImageKitDetails>;
}

export async function deleteImageKitFile(fileId: string | null) {
  if (!fileId) return true;
  const response = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE", headers: { Authorization: imageKitAuthHeader() }, cache: "no-store",
  }).catch(() => null);
  return response?.ok === true || response?.status === 404;
}

export function isExpectedImageKitUrl(value: string, expectedPath: string) {
  const endpointValue = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;
  if (!endpointValue) return false;
  try {
    const endpoint = new URL(endpointValue);
    const candidate = new URL(value);
    const endpointPath = endpoint.pathname.replace(/\/$/, "");
    return candidate.protocol === "https:" && candidate.origin === endpoint.origin
      && candidate.pathname === `${endpointPath}${expectedPath}`;
  } catch {
    return false;
  }
}

export async function uploadImageKitFile(file: Blob, input: { fileName: string; folder: string; checks: string }): Promise<ImageKitDetails> {
  const body = new FormData();
  body.append("file", file, input.fileName);
  body.append("fileName", input.fileName);
  body.append("folder", input.folder);
  body.append("useUniqueFileName", "false");
  body.append("checks", input.checks);
  const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    headers: { Authorization: imageKitAuthHeader(), Accept: "application/json" },
    body,
    cache: "no-store",
  });
  const result = await response.json().catch(() => null) as (ImageKitDetails & { message?: string }) | null;
  if (!response.ok || !result?.fileId || !result.filePath || !result.url) throw new Error(result?.message ?? "O ImageKit recusou o arquivo.");
  return result;
}
