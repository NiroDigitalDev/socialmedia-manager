import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  uploadToR2,
  getFromR2,
  deleteManyFromR2,
  extensionForMime,
} from "@/lib/r2";

/**
 * Image storage facade — centralizes every read/write against images so
 * the rest of the app stays agnostic to where the bytes actually live.
 *
 * During the R2 migration, rows may have either:
 *   - `key` set (new rows in R2), or
 *   - `data` set (legacy rows still in postgres as bytea).
 *
 * Reads prefer `key`, fall back to `data`. Writes always go to R2.
 */

const STORED_PREFIX = "stored";
const GENERATED_PREFIX = "generated";

function makeStoredKey(mimeType: string): string {
  return `${STORED_PREFIX}/${randomUUID()}.${extensionForMime(mimeType)}`;
}

function makeGeneratedKey(
  postId: string,
  slideNumber: number,
  mimeType: string
): string {
  return `${GENERATED_PREFIX}/${postId}/${slideNumber}-${randomUUID()}.${extensionForMime(
    mimeType
  )}`;
}

export async function putStoredImage(
  buffer: Buffer,
  mimeType: string
): Promise<{ id: string; key: string; mimeType: string }> {
  const key = makeStoredKey(mimeType);
  await uploadToR2(key, buffer, mimeType);
  const row = await prisma.storedImage.create({
    data: { key, mimeType },
  });
  return { id: row.id, key, mimeType };
}

export async function putGeneratedImage(
  postId: string,
  slideNumber: number,
  buffer: Buffer,
  mimeType: string
): Promise<{ id: string; key: string; mimeType: string }> {
  const key = makeGeneratedKey(postId, slideNumber, mimeType);
  await uploadToR2(key, buffer, mimeType);
  const row = await prisma.generatedImage.create({
    data: { postId, slideNumber, key, mimeType },
  });
  return { id: row.id, key, mimeType };
}

/**
 * Reads image bytes for any row with either `key` (R2) or `data` (legacy).
 * Returns a Node `Buffer` which works as `BodyInit` for `NextResponse` and
 * also supports `.toString("base64")` for Gemini reference images.
 *
 * Accepts `Uint8Array | null` for `data` because Prisma's Bytes field
 * type is `Uint8Array`, not `Buffer`.
 */
export async function readImageBytes(image: {
  key: string | null;
  data: Uint8Array | null;
  mimeType: string;
}): Promise<{ buffer: Buffer; mimeType: string }> {
  if (image.key) {
    const { body, contentType } = await getFromR2(image.key);
    return {
      buffer: Buffer.from(body),
      mimeType: contentType || image.mimeType,
    };
  }
  if (image.data) {
    return {
      buffer: Buffer.from(image.data),
      mimeType: image.mimeType,
    };
  }
  throw new Error("Image row has neither `key` nor `data` — unreachable");
}

/**
 * Delete StoredImage rows by id, cleaning up R2 objects first for any
 * rows that live in R2. Silently ignores missing rows.
 */
export async function deleteStoredImages(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const rows = await prisma.storedImage.findMany({
    where: { id: { in: ids } },
    select: { id: true, key: true },
  });
  const keys = rows.map((r) => r.key).filter((k): k is string => !!k);
  await deleteManyFromR2(keys);
  await prisma.storedImage.deleteMany({ where: { id: { in: ids } } });
}

/**
 * Delete GeneratedImage rows by post id, cleaning up R2 objects first.
 * Called when a GeneratedPost is about to be deleted.
 */
export async function deleteGeneratedImagesForPost(
  postId: string
): Promise<void> {
  const rows = await prisma.generatedImage.findMany({
    where: { postId },
    select: { key: true },
  });
  const keys = rows.map((r) => r.key).filter((k): k is string => !!k);
  await deleteManyFromR2(keys);
  // The DB rows themselves are removed by Prisma's onDelete: Cascade when
  // the parent GeneratedPost is deleted; nothing to do here for Prisma.
}
