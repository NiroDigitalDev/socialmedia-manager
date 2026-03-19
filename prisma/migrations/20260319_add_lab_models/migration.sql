-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('configuring', 'generating', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "RunScope" AS ENUM ('full', 'batch', 'single');

-- CreateEnum
CREATE TYPE "VariationStatus" AS ENUM ('generating', 'completed', 'failed');

-- AlterTable
ALTER TABLE "GeneratedImage" ADD COLUMN     "r2Key" TEXT,
ALTER COLUMN "data" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Experiment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "brandIdentityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "runNumber" INTEGER NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'configuring',
    "scope" "RunScope" NOT NULL DEFAULT 'full',
    "settingsSnapshot" JSONB NOT NULL,
    "parentRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunConcept" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "conceptNumber" INTEGER NOT NULL,
    "outline" JSONB NOT NULL,
    "imagePrompt" TEXT NOT NULL,
    "captionPrompt" TEXT NOT NULL,

    CONSTRAINT "RunConcept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageVariation" (
    "id" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "variationNumber" INTEGER NOT NULL,
    "imagePrompt" TEXT NOT NULL,
    "r2Key" TEXT,
    "mimeType" TEXT,
    "status" "VariationStatus" NOT NULL DEFAULT 'generating',
    "rating" INTEGER,
    "ratingComment" TEXT,

    CONSTRAINT "ImageVariation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaptionVariation" (
    "id" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "variationNumber" INTEGER NOT NULL,
    "captionPrompt" TEXT NOT NULL,
    "text" TEXT,
    "status" "VariationStatus" NOT NULL DEFAULT 'generating',
    "rating" INTEGER,
    "ratingComment" TEXT,

    CONSTRAINT "CaptionVariation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunExport" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "imageVariationId" TEXT NOT NULL,
    "captionVariationId" TEXT NOT NULL,
    "generatedPostId" TEXT,
    "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Experiment_orgId_idx" ON "Experiment"("orgId");

-- CreateIndex
CREATE INDEX "Experiment_projectId_idx" ON "Experiment"("projectId");

-- CreateIndex
CREATE INDEX "Run_experimentId_idx" ON "Run"("experimentId");

-- CreateIndex
CREATE INDEX "Run_orgId_idx" ON "Run"("orgId");

-- CreateIndex
CREATE INDEX "Run_parentRunId_idx" ON "Run"("parentRunId");

-- CreateIndex
CREATE INDEX "RunConcept_runId_idx" ON "RunConcept"("runId");

-- CreateIndex
CREATE INDEX "ImageVariation_conceptId_idx" ON "ImageVariation"("conceptId");

-- CreateIndex
CREATE INDEX "CaptionVariation_conceptId_idx" ON "CaptionVariation"("conceptId");

-- CreateIndex
CREATE INDEX "RunExport_runId_idx" ON "RunExport"("runId");

-- AddForeignKey
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_brandIdentityId_fkey" FOREIGN KEY ("brandIdentityId") REFERENCES "BrandIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_parentRunId_fkey" FOREIGN KEY ("parentRunId") REFERENCES "Run"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunConcept" ADD CONSTRAINT "RunConcept_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageVariation" ADD CONSTRAINT "ImageVariation_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "RunConcept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaptionVariation" ADD CONSTRAINT "CaptionVariation_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "RunConcept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunExport" ADD CONSTRAINT "RunExport_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunExport" ADD CONSTRAINT "RunExport_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "RunConcept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunExport" ADD CONSTRAINT "RunExport_imageVariationId_fkey" FOREIGN KEY ("imageVariationId") REFERENCES "ImageVariation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunExport" ADD CONSTRAINT "RunExport_captionVariationId_fkey" FOREIGN KEY ("captionVariationId") REFERENCES "CaptionVariation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunExport" ADD CONSTRAINT "RunExport_generatedPostId_fkey" FOREIGN KEY ("generatedPostId") REFERENCES "GeneratedPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
