/**
 * Deletes every object under the orphan prefixes from R2.
 * Run this AFTER backing up via scripts/archive-r2-orphans.ts.
 *
 * Usage:
 *   bun scripts/delete-r2-orphans.ts
 */
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
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

const PREFIXES = ["arena/", "lab/", "style-previews/", "brand/"];
const BATCH = 1000;

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

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

async function deleteBatch(keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;
  const res = await client.send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: keys.map((k) => ({ Key: k })),
        Quiet: true,
      },
    })
  );
  if (res.Errors && res.Errors.length > 0) {
    for (const err of res.Errors) {
      console.error(`  FAIL ${err.Key}: ${err.Code} ${err.Message}`);
    }
  }
  return keys.length - (res.Errors?.length ?? 0);
}

async function main() {
  let totalDeleted = 0;
  for (const prefix of PREFIXES) {
    console.log(`Listing ${prefix}...`);
    const objs = await listAll(prefix);
    const keys = objs.map((o) => o.Key).filter((k): k is string => !!k);
    console.log(`  ${keys.length} object(s) to delete`);

    for (let i = 0; i < keys.length; i += BATCH) {
      const slice = keys.slice(i, i + BATCH);
      const ok = await deleteBatch(slice);
      totalDeleted += ok;
      console.log(
        `  deleted ${Math.min(i + BATCH, keys.length)}/${keys.length}`
      );
    }
  }
  console.log(`\nTotal deleted: ${totalDeleted}`);
}

main().catch((err) => {
  console.error("Delete failed:", err);
  process.exit(1);
});
