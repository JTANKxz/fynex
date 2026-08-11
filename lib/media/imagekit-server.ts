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
  if (!fileId) return;
  await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE", headers: { Authorization: imageKitAuthHeader() }, cache: "no-store",
  }).catch(() => undefined);
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
