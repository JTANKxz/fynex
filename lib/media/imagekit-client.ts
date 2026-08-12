export type ImageKitUploadToken = {
  token: string;
  upload: Record<string, string>;
  error?: string;
};

export type ImageKitUploadResult = {
  fileId: string;
  filePath: string;
  url: string;
  width?: number;
  height?: number;
  size?: number;
  mime?: string;
};

export function uploadToImageKit(file: Blob, token: ImageKitUploadToken, onProgress: (progress: number) => void) {
  return new Promise<ImageKitUploadResult>((resolve, reject) => {
    const body = new FormData();
    body.append("file", file, token.upload.fileName);
    body.append("token", token.token);
    Object.entries(token.upload).forEach(([key, value]) => body.append(key, value));
    const request = new XMLHttpRequest();
    request.open("POST", "https://upload.imagekit.io/api/v2/files/upload");
    request.responseType = "json";
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error("A conexão com o ImageKit falhou."));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        const raw = request.response as Record<string, unknown>;
        resolve({
          fileId: String(raw.fileId ?? raw.file_id ?? ""),
          filePath: String(raw.filePath ?? raw.file_path ?? ""),
          url: String(raw.url ?? ""),
          width: typeof raw.width === "number" ? raw.width : undefined,
          height: typeof raw.height === "number" ? raw.height : undefined,
          size: typeof raw.size === "number" ? raw.size : undefined,
          mime: typeof raw.mime === "string" ? raw.mime : undefined,
        });
      }
      else reject(new Error(request.response?.message ?? "O ImageKit recusou o arquivo."));
    };
    request.send(body);
  });
}
