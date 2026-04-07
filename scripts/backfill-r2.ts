/**
 * Idempotent one-shot script to migrate legacy `data Bytes` image rows to R2.
 *
 * Usage:
 *   bun scripts/backfill-r2.ts
 *
 * Safe to re-run: only processes rows where `key IS NULL AND data IS NOT NULL`.
 * When complete, you can drop the `data` column in a follow-up Prisma migration.
 */
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { uploadToR2, extensionForMime } from "@/lib/r2";

const BATCH_SIZE = 25;

async function backfillStored() {
  let processed = 0;
  for (;;) {
    const rows = await prisma.storedImage.findMany({
      where: { key: null, data: { not: null } },
      take: BATCH_SIZE,
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      if (!row.data) continue;
      const key = `stored/${randomUUID()}.${extensionForMime(row.mimeType)}`;
      try {
        await uploadToR2(key, Buffer.from(row.data), row.mimeType);
        await prisma.storedImage.update({
          where: { id: row.id },
          data: { key },
        });
        processed++;
        console.log(`  StoredImage ${row.id} -> ${key}`);
      } catch (err) {
        console.error(`  FAILED StoredImage ${row.id}:`, err);
      }
    }
  }
  return processed;
}

async function backfillGenerated() {
  let processed = 0;
  for (;;) {
    const rows = await prisma.generatedImage.findMany({
      where: { key: null, data: { not: null } },
      take: BATCH_SIZE,
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      if (!row.data) continue;
      const key = `generated/${row.postId}/${row.slideNumber}-${randomUUID()}.${extensionForMime(
        row.mimeType
      )}`;
      try {
        await uploadToR2(key, Buffer.from(row.data), row.mimeType);
        await prisma.generatedImage.update({
          where: { id: row.id },
          data: { key },
        });
        processed++;
        console.log(`  GeneratedImage ${row.id} -> ${key}`);
      } catch (err) {
        console.error(`  FAILED GeneratedImage ${row.id}:`, err);
      }
    }
  }
  return processed;
}

async function main() {
  console.log("Backfilling StoredImage rows...");
  const storedCount = await backfillStored();
  console.log(`  Done: ${storedCount} row(s) migrated\n`);

  console.log("Backfilling GeneratedImage rows...");
  const generatedCount = await backfillGenerated();
  console.log(`  Done: ${generatedCount} row(s) migrated\n`);

  console.log(
    `Total: ${storedCount + generatedCount} image(s) migrated to R2.`
  );
  console.log(
    "Once you've verified the app still works, create a follow-up migration to drop the `data` column from StoredImage and GeneratedImage."
  );
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
