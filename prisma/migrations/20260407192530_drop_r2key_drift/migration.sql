-- Drop the phantom `r2Key` column left behind by the deleted `roks-workspace`
-- branch's R2 migration. All rows that used it (30 pure-zombie GeneratedPost
-- rows with their images) were deleted before this migration, and none of the
-- current main branch code ever referenced it.
ALTER TABLE "GeneratedImage" DROP COLUMN "r2Key";
