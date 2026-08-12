export type PixelCrop = { x: number; y: number; width: number; height: number };

type DrawableImage = CanvasImageSource & { width: number; height: number; close?: () => void };

async function decodeImage(file: File): Promise<DrawableImage> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Safari e navegadores móveis antigos usam o carregamento por elemento de imagem.
    }
  }

  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = source;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(source);
  }
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Falha ao processar a imagem.")), "image/webp", quality);
  });
}

export async function cropImageToWebp(file: File, crop: PixelCrop, kind: "avatar" | "banner") {
  const bitmap = await decodeImage(file);
  const target = kind === "avatar"
    ? { width: 512, height: 512, maxBytes: 400_000 }
    : { width: 1500, height: 500, maxBytes: 900_000 };
  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    bitmap.close?.();
    throw new Error("Seu navegador não conseguiu editar a imagem.");
  }

  context.fillStyle = "#000";
  context.fillRect(0, 0, target.width, target.height);
  context.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, target.width, target.height);
  bitmap.close?.();

  let quality = .86;
  let blob = await canvasBlob(canvas, quality);
  while (blob.size > target.maxBytes && quality > .48) {
    quality -= .08;
    blob = await canvasBlob(canvas, quality);
  }
  if (blob.size > target.maxBytes) throw new Error("Não foi possível comprimir a imagem dentro do limite.");
  return blob;
}

export async function cropChatImageToWebp(file: File, crop: PixelCrop) {
  const bitmap = await decodeImage(file);
  const scale = Math.min(1, 1800 / Math.max(crop.width, crop.height));
  const width = Math.max(1, Math.round(crop.width * scale));
  const height = Math.max(1, Math.round(crop.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) { bitmap.close?.(); throw new Error("Seu navegador não conseguiu editar a imagem."); }
  context.fillStyle = "#000";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
  bitmap.close?.();
  return canvasBlob(canvas, .88);
}

export async function prepareStickerImage(file: File) {
  if (file.type === "image/gif") {
    if (file.size > 1_000_000) throw new Error("GIFs animados podem ter no máximo 1 MB.");
    return file;
  }

  const bitmap = await decodeImage(file);
  const largestSide = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(1, 512 / largestSide);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) {
    bitmap.close?.();
    throw new Error("Seu navegador não conseguiu preparar a figurinha.");
  }
  context.clearRect(0, 0, 512, 512);
  context.drawImage(bitmap, (512 - width) / 2, (512 - height) / 2, width, height);
  bitmap.close?.();

  let quality = .9;
  let blob = await canvasBlob(canvas, quality);
  while (blob.size > 900_000 && quality > .5) {
    quality -= .08;
    blob = await canvasBlob(canvas, quality);
  }
  if (blob.size > 1_000_000) throw new Error("Não foi possível comprimir essa imagem para figurinha.");
  return blob;
}
