/**
 * List the R2 bucket contents — surfaces top-level prefixes, total object
 * count, total size, and a sample of object keys per prefix. Read-only.
 *
 * Usage:
 *   railway run --service socialmedia-manager bun scripts/list-r2.ts
 */
import {
  S3Client,
  ListObjectsV2Command,
  type _Object,
} from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID!;
const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;
const bucket = process.env.R2_BUCKET_NAME!;

if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
  console.error("Missing R2 env vars");
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function topPrefix(key: string): string {
  const idx = key.indexOf("/");
  return idx === -1 ? "(root)" : key.slice(0, idx);
}

async function main() {
  console.log(`Bucket: ${bucket}\n`);

  // First: list top-level prefixes (folders) using delimiter.
  const topListing = await client.send(
    new ListObjectsV2Command({ Bucket: bucket, Delimiter: "/" })
  );
  const topPrefixes = (topListing.CommonPrefixes ?? [])
    .map((p) => p.Prefix ?? "")
    .filter(Boolean);
  const rootKeys = topListing.Contents ?? [];

  console.log(`Top-level prefixes (${topPrefixes.length}):`);
  for (const p of topPrefixes) console.log(`  ${p}`);
  if (rootKeys.length > 0) {
    console.log(`Root-level keys: ${rootKeys.length}`);
    for (const k of rootKeys.slice(0, 5)) console.log(`  ${k.Key}`);
  }
  console.log();

  // Then: walk the entire bucket to get totals + per-prefix breakdown.
  const byPrefix: Record<string, { count: number; bytes: number; samples: string[] }> = {};
  let totalCount = 0;
  let totalBytes = 0;
  let token: string | undefined;

  do {
    const res: { Contents?: _Object[]; NextContinuationToken?: string; IsTruncated?: boolean } =
      await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          ContinuationToken: token,
        })
      );

    for (const obj of res.Contents ?? []) {
      if (!obj.Key) continue;
      const p = topPrefix(obj.Key);
      if (!byPrefix[p]) byPrefix[p] = { count: 0, bytes: 0, samples: [] };
      byPrefix[p].count++;
      byPrefix[p].bytes += obj.Size ?? 0;
      if (byPrefix[p].samples.length < 3) byPrefix[p].samples.push(obj.Key);
      totalCount++;
      totalBytes += obj.Size ?? 0;
    }

    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);

  console.log(`Per-prefix breakdown:`);
  const entries = Object.entries(byPrefix).sort((a, b) => b[1].bytes - a[1].bytes);
  for (const [p, stats] of entries) {
    console.log(`\n  ${p}/`);
    console.log(`    objects: ${stats.count}`);
    console.log(`    size:    ${fmtBytes(stats.bytes)}`);
    console.log(`    samples:`);
    for (const s of stats.samples) console.log(`      ${s}`);
  }

  console.log(
    `\n=== TOTAL: ${totalCount} object(s), ${fmtBytes(totalBytes)} ===`
  );
}

main().catch((err) => {
  console.error("List failed:", err);
  process.exit(1);
});
