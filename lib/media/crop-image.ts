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
    : { width: 1600, height: 500, maxBytes: 900_000 };
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
