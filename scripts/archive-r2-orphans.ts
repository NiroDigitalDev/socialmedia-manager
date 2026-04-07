/**
 * Downloads every object from the orphan prefixes and writes them to a
 * local directory mirroring the R2 layout. After this script finishes,
 * the directory can be zipped with `zip -r <out>.zip <dir>`.
 *
 * Usage:
 *   bun scripts/archive-r2-orphans.ts <output-directory>
 *
 * Example:
 *   bun scripts/archive-r2-orphans.ts ~/Downloads/social-media-r2-orphans
 */
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  type _Object,
} from "@aws-sdk/client-s3";
import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { homedir } from "os";

const accountId = process.env.R2_ACCOUNT_ID!;
const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;
const bucket = process.env.R2_BUCKET_NAME!;

if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
  console.error("Missing R2 env vars");
  process.exit(1);
}

const PREFIXES = ["arena/", "lab/", "style-previews/", "brand/"];
const CONCURRENCY = 8;

let outDirArg = process.argv[2];
if (!outDirArg) {
  console.error("usage: bun scripts/archive-r2-orphans.ts <output-directory>");
  process.exit(1);
}
// Expand leading ~ to home dir
if (outDirArg.startsWith("~")) {
  outDirArg = join(homedir(), outDirArg.slice(1));
}
const outDir = outDirArg;

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

function fmt(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function listAll(prefix: string): Promise<_Object[]> {
  const all: _Object[] = [];
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
    all.push(...(res.Contents ?? []));
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return all;
}

async function downloadOne(key: string): Promise<number> {
  const res = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );
  if (!res.Body) throw new Error(`empty body for ${key}`);
  const bytes = await res.Body.transformToByteArray();
  const localPath = join(outDir, key);
  await mkdir(dirname(localPath), { recursive: true });
  await writeFile(localPath, bytes);
  return bytes.byteLength;
}

async function main() {
  console.log(`Output directory: ${outDir}`);
  console.log(`Bucket: ${bucket}`);
  console.log(`Prefixes: ${PREFIXES.join(", ")}\n`);

  await mkdir(outDir, { recursive: true });

  // List all objects across all prefixes
  let allObjects: _Object[] = [];
  for (const prefix of PREFIXES) {
    const objs = await listAll(prefix);
    console.log(`${prefix}: ${objs.length} object(s)`);
    allObjects = allObjects.concat(objs);
  }
  const totalCount = allObjects.length;
  const totalBytes = allObjects.reduce((s, o) => s + (o.Size ?? 0), 0);
  console.log(`\nTOTAL: ${totalCount} files, ${fmt(totalBytes)}\n`);
  console.log(`Downloading with concurrency ${CONCURRENCY}...\n`);

  // Download with bounded concurrency
  let downloaded = 0;
  let bytesDownloaded = 0;
  const queue = [...allObjects];
  const failures: { key: string; err: string }[] = [];

  async function worker(id: number) {
    while (queue.length > 0) {
      const obj = queue.shift();
      if (!obj?.Key) continue;
      try {
        const n = await downloadOne(obj.Key);
        bytesDownloaded += n;
        downloaded++;
        if (downloaded % 25 === 0 || downloaded === totalCount) {
          const pct = ((downloaded / totalCount) * 100).toFixed(1);
          console.log(
            `  [${pct}%] ${downloaded}/${totalCount} files, ${fmt(bytesDownloaded)} downloaded`
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failures.push({ key: obj.Key, err: msg });
        console.error(`  FAIL ${obj.Key}: ${msg}`);
      }
    }
  }

  await Promise.all(
    Array.from({ length: CONCURRENCY }, (_, i) => worker(i))
  );

  console.log(
    `\nDone: ${downloaded}/${totalCount} files (${fmt(bytesDownloaded)})`
  );
  if (failures.length > 0) {
    console.error(`\n${failures.length} FAILURES:`);
    for (const f of failures) console.error(`  ${f.key}: ${f.err}`);
    process.exit(2);
  }
  console.log(`\nNext step:`);
  console.log(`  cd ${dirname(outDir)} && zip -r ${outDir.split("/").pop()}.zip ${outDir.split("/").pop()}`);
}

main().catch((err) => {
  console.error("Archive failed:", err);
  process.exit(1);
});
