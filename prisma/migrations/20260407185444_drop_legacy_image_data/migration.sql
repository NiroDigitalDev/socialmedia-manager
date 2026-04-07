-- Drop the legacy `data` bytea column now that all rows are backfilled to R2.
-- Verified before commit: 0 rows with `data IS NOT NULL AND key IS NULL`.
ALTER TABLE "StoredImage" DROP COLUMN "data";
ALTER TABLE "GeneratedImage" DROP COLUMN "data";
