-- AlterTable: StoredImage — add optional R2 `key`, make legacy `data` nullable
ALTER TABLE "StoredImage" ADD COLUMN "key" TEXT;
ALTER TABLE "StoredImage" ALTER COLUMN "data" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "StoredImage_key_key" ON "StoredImage"("key");

-- AlterTable: GeneratedImage — same shape
ALTER TABLE "GeneratedImage" ADD COLUMN "key" TEXT;
ALTER TABLE "GeneratedImage" ALTER COLUMN "data" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedImage_key_key" ON "GeneratedImage"("key");
