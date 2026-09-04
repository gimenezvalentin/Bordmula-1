// ============================================================================
// Redimensionado de imágenes en el navegador (canvas) antes de subirlas.
// Objetivo: JPEG de ~1200px en el lado largo, ~200-400 KB.
// ============================================================================

const MAX_EDGE = 1200;
const QUALITY = 0.82;

/**
 * @param {Blob|File} file
 * @param {{maxEdge?:number, quality?:number}} [opts]
 * @returns {Promise<Blob>} JPEG redimensionado (o el original si ya es chico y liviano)
 */
export async function resizeToJpeg(file, opts = {}) {
  const maxEdge = opts.maxEdge ?? MAX_EDGE;
  const quality = opts.quality ?? QUALITY;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file; // formato raro: se sube tal cual

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise((res) =>
    canvas.toBlob(res, "image/jpeg", quality)
  );
  if (!blob) return file;
  // si ya era JPEG y no hubo que achicar, dejo el original tal cual
  const isJpeg = /jpe?g/i.test(file.type || "");
  if (scale === 1 && isJpeg) return file;
  return blob;
}

/** Descarga una imagen desde una URL y la devuelve como Blob (para "Desde URL"). */
export async function fetchImageBlob(url) {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`No se pudo bajar la imagen (${res.status})`);
  const blob = await res.blob();
  if (!blob.type.startsWith("image/")) throw new Error("La URL no es una imagen");
  return blob;
}
