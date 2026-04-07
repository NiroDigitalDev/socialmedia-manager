/**
 * Inspect a single R2 prefix in detail: file types, name patterns, and a few
 * direct URLs you can click to view in a browser.
 *
 * Usage:
 *   bun scripts/inspect-r2-prefix.ts arena/
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
const publicUrl = process.env.R2_PUBLIC_URL ?? "";

const prefix = process.argv[2];
if (!prefix) {
  console.error("usage: bun scripts/inspect-r2-prefix.ts <prefix>");
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

function fmt(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

async function main() {
  const objects: _Object[] = [];
  let token: string | undefined;
  do {
    const res: { Contents?: _Object[]; NextContinuationToken?: string; IsTruncated?: boolean } =
      await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: token,
        })
      );
    objects.push(...(res.Contents ?? []));
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);

  console.log(`Prefix: ${prefix}`);
  console.log(`Object count: ${objects.length}`);
  const totalBytes = objects.reduce((sum, o) => sum + (o.Size ?? 0), 0);
  console.log(`Total size: ${fmt(totalBytes)}\n`);

  // Filename extension breakdown
  const exts: Record<string, number> = {};
  for (const o of objects) {
    if (!o.Key) continue;
    const ext = (o.Key.split(".").pop() ?? "(none)").toLowerCase();
    exts[ext] = (exts[ext] ?? 0) + 1;
  }
  console.log("File types:");
  for (const [ext, n] of Object.entries(exts).sort((a, b) => b[1] - a[1])) {
    console.log(`  .${ext}: ${n}`);
  }
  console.log();

  // Date range
  const dates = objects
    .map((o) => o.LastModified)
    .filter((d): d is Date => !!d)
    .sort((a, b) => a.getTime() - b.getTime());
  if (dates.length > 0) {
    console.log(`First upload: ${dates[0].toISOString()}`);
    console.log(`Last upload:  ${dates[dates.length - 1].toISOString()}\n`);
  }

  // Largest files
  const largest = [...objects].sort((a, b) => (b.Size ?? 0) - (a.Size ?? 0)).slice(0, 5);
  console.log("Largest 5 objects:");
  for (const o of largest) {
    console.log(`  ${fmt(o.Size ?? 0).padStart(10)}  ${o.Key}`);
  }
  console.log();

  // Sample direct URLs
  if (publicUrl) {
    console.log("Sample URLs (click to view):");
    const samples = objects.slice(0, 5);
    for (const o of samples) {
      console.log(`  ${publicUrl.replace(/\/+$/, "")}/${o.Key}`);
    }
  }
}

main().catch((err) => {
  console.error("Inspect failed:", err);
  process.exit(1);
});
