import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

// --- R2 Client ---

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!; // e.g. https://pub-xxx.r2.dev or https://cdn.yourdomain.com

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// --- Key Helpers ---

/** Build the R2 object key for an original image */
export function originalKey(id: string, ext: string = "png"): string {
  return `images/${id}/original.${ext}`;
}

/** Build the R2 object key for a WebP preview */
export function previewKey(id: string): string {
  return `images/${id}/preview.webp`;
}

/** Turn an R2 key into a public URL */
export function publicUrl(key: string): string {
  return `${R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
}

// --- Upload ---

export interface UploadResult {
  key: string;
  url: string;
}

/** Upload a buffer to R2 */
export async function uploadToR2(
  key: string,
  data: Buffer | Uint8Array,
  contentType: string
): Promise<UploadResult> {
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: data,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return { key, url: publicUrl(key) };
}

/**
 * Upload an original image + its WebP preview in one call.
 * Returns URLs for both versions.
 */
export async function uploadImageWithPreview(
  id: string,
  originalData: Buffer | Uint8Array,
  previewData: Buffer | Uint8Array,
  originalMimeType: string,
  ext: string = "png"
): Promise<{ original: UploadResult; preview: UploadResult }> {
  const [original, preview] = await Promise.all([
    uploadToR2(originalKey(id, ext), originalData, originalMimeType),
    uploadToR2(previewKey(id), previewData, "image/webp"),
  ]);
  return { original, preview };
}

// --- Fetch ---

/** Fetch raw bytes from R2 */
export async function fetchFromR2(
  key: string
): Promise<{ data: Buffer; contentType: string }> {
  const res = await r2.send(
    new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })
  );
  const bytes = await res.Body!.transformToByteArray();
  return {
    data: Buffer.from(bytes),
    contentType: res.ContentType ?? "application/octet-stream",
  };
}

// --- Delete ---

/** Delete a single object from R2 */
export async function deleteFromR2(key: string): Promise<void> {
  await r2.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })
  );
}

/** Delete both original + preview for an image */
export async function deleteImageFromR2(
  id: string,
  ext: string = "png"
): Promise<void> {
  await Promise.all([
    deleteFromR2(originalKey(id, ext)),
    deleteFromR2(previewKey(id)),
  ]);
}

// --- Exists ---

/** Check if an object exists in R2 */
export async function existsInR2(key: string): Promise<boolean> {
  try {
    await r2.send(
      new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );
    return true;
  } catch {
    return false;
  }
}

export { r2, R2_BUCKET_NAME };
