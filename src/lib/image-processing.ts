import sharp from "sharp";

// --- Preview defaults ---

/** Max width for preview thumbnails */
const PREVIEW_MAX_WIDTH = 480;

/** WebP quality for previews (0-100) */
const PREVIEW_QUALITY = 75;

// --- Compression ---

/**
 * Create a WebP preview from any image buffer.
 * Resizes to PREVIEW_MAX_WIDTH maintaining aspect ratio, converts to WebP.
 */
export async function createWebPPreview(
  input: Buffer | Uint8Array,
  opts?: { maxWidth?: number; quality?: number }
): Promise<Buffer> {
  const maxWidth = opts?.maxWidth ?? PREVIEW_MAX_WIDTH;
  const quality = opts?.quality ?? PREVIEW_QUALITY;

  return sharp(input)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
}

/**
 * Convert any image to WebP at original resolution.
 */
export async function convertToWebP(
  input: Buffer | Uint8Array,
  quality: number = 85
): Promise<Buffer> {
  return sharp(input).webp({ quality }).toBuffer();
}

/**
 * Resize an image to specific dimensions.
 */
export async function resizeImage(
  input: Buffer | Uint8Array,
  width: number,
  height?: number,
  opts?: { fit?: "cover" | "contain" | "fill" | "inside" | "outside" }
): Promise<Buffer> {
  return sharp(input)
    .resize({ width, height, fit: opts?.fit ?? "inside", withoutEnlargement: true })
    .toBuffer();
}

/**
 * Get image metadata (dimensions, format, size).
 */
export async function getImageMetadata(input: Buffer | Uint8Array) {
  const meta = await sharp(input).metadata();
  return {
    width: meta.width,
    height: meta.height,
    format: meta.format,
    size: meta.size,
  };
}

/**
 * Extract the file extension from a MIME type.
 */
export function mimeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
    "image/avif": "avif",
  };
  return map[mimeType] ?? "png";
}
