import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

// Lazy-initialized singleton so importing this module never throws —
// only callers that actually touch R2 fail if env vars are missing.
let client: S3Client | null = null;

function getConfig() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;

  const missing = [
    !accountId && "R2_ACCOUNT_ID",
    !accessKeyId && "R2_ACCESS_KEY_ID",
    !secretAccessKey && "R2_SECRET_ACCESS_KEY",
    !bucket && "R2_BUCKET_NAME",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(
      `Missing required R2 environment variables: ${missing.join(", ")}`
    );
  }

  return {
    accountId: accountId!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    bucket: bucket!,
  };
}

function getClient(): { client: S3Client; bucket: string } {
  const cfg = getConfig();
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
  }
  return { client, bucket: cfg.bucket };
}

/**
 * Public URL prefix for direct CDN serving (Cloudflare R2.dev URL or custom
 * domain). When set, `/api/images/[id]` redirects to this prefix instead of
 * proxy-streaming. Returns null if not configured.
 */
export function getR2PublicUrl(key: string): string | null {
  const base = process.env.R2_PUBLIC_URL;
  if (!base) return null;
  const trimmed = base.replace(/\/+$/, "");
  return `${trimmed}/${key}`;
}

export function extensionForMime(mimeType: string): string {
  const m = mimeType.toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  return "bin";
}

export async function uploadToR2(
  key: string,
  body: Buffer,
  mimeType: string
): Promise<void> {
  const { client, bucket } = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: mimeType,
    })
  );
}

export async function getFromR2(
  key: string
): Promise<{ body: Uint8Array; contentType: string }> {
  const { client, bucket } = getClient();
  const res = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );
  if (!res.Body) {
    throw new Error(`R2 object ${key} returned empty body`);
  }
  const bytes = await res.Body.transformToByteArray();
  return {
    body: bytes,
    contentType: res.ContentType ?? "application/octet-stream",
  };
}

export async function deleteFromR2(key: string): Promise<void> {
  const { client, bucket } = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function deleteManyFromR2(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await Promise.all(
    keys.map((key) =>
      deleteFromR2(key).catch((err) => {
        console.error(`Failed to delete R2 object ${key}:`, err);
      })
    )
  );
}
