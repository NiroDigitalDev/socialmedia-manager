-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('instagram', 'linkedin', 'reddit', 'x', 'blog', 'email');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'active', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('reference', 'asset');

-- CreateEnum
CREATE TYPE "FavoriteTargetType" AS ENUM ('project', 'campaign', 'route');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "projectId" TEXT NOT NULL,
    "brandIdentityId" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandIdentity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "logoAssetId" TEXT,
    "projectId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "category" "AssetCategory" NOT NULL,
    "projectId" TEXT,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" "FavoriteTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Style - add orgId
ALTER TABLE "Style" ADD COLUMN "orgId" TEXT;

-- AlterTable: ContentSource - add orgId, projectId
ALTER TABLE "ContentSource" ADD COLUMN "orgId" TEXT;
ALTER TABLE "ContentSource" ADD COLUMN "projectId" TEXT;

-- AlterTable: ContentIdea - add orgId, projectId, campaignId
ALTER TABLE "ContentIdea" ADD COLUMN "orgId" TEXT;
ALTER TABLE "ContentIdea" ADD COLUMN "projectId" TEXT;
ALTER TABLE "ContentIdea" ADD COLUMN "campaignId" TEXT;

-- AlterTable: BrandPalette - add brandIdentityId
ALTER TABLE "BrandPalette" ADD COLUMN "brandIdentityId" TEXT;

-- AlterTable: GeneratedPost - add textContent, platform, orgId, projectId, campaignId
ALTER TABLE "GeneratedPost" ADD COLUMN "textContent" TEXT;
ALTER TABLE "GeneratedPost" ADD COLUMN "platform" "Platform";
ALTER TABLE "GeneratedPost" ADD COLUMN "orgId" TEXT;
ALTER TABLE "GeneratedPost" ADD COLUMN "projectId" TEXT;
ALTER TABLE "GeneratedPost" ADD COLUMN "campaignId" TEXT;

-- CreateIndex
CREATE INDEX "Project_orgId_idx" ON "Project"("orgId");

-- CreateIndex
CREATE INDEX "Campaign_projectId_idx" ON "Campaign"("projectId");

-- CreateIndex
CREATE INDEX "BrandIdentity_projectId_idx" ON "BrandIdentity"("projectId");
CREATE INDEX "BrandIdentity_orgId_idx" ON "BrandIdentity"("orgId");

-- CreateIndex
CREATE INDEX "Asset_orgId_idx" ON "Asset"("orgId");
CREATE INDEX "Asset_projectId_idx" ON "Asset"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_targetType_targetId_key" ON "Favorite"("userId", "targetType", "targetId");
CREATE INDEX "Favorite_userId_idx" ON "Favorite"("userId");

-- CreateIndex
CREATE INDEX "Style_orgId_idx" ON "Style"("orgId");

-- CreateIndex
CREATE INDEX "ContentSource_orgId_idx" ON "ContentSource"("orgId");
CREATE INDEX "ContentSource_projectId_idx" ON "ContentSource"("projectId");

-- CreateIndex
CREATE INDEX "ContentIdea_orgId_idx" ON "ContentIdea"("orgId");
CREATE INDEX "ContentIdea_projectId_idx" ON "ContentIdea"("projectId");
CREATE INDEX "ContentIdea_campaignId_idx" ON "ContentIdea"("campaignId");

-- CreateIndex
CREATE INDEX "BrandPalette_brandIdentityId_idx" ON "BrandPalette"("brandIdentityId");

-- CreateIndex
CREATE INDEX "GeneratedPost_orgId_idx" ON "GeneratedPost"("orgId");
CREATE INDEX "GeneratedPost_projectId_idx" ON "GeneratedPost"("projectId");
CREATE INDEX "GeneratedPost_campaignId_idx" ON "GeneratedPost"("campaignId");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_brandIdentityId_fkey" FOREIGN KEY ("brandIdentityId") REFERENCES "BrandIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandIdentity" ADD CONSTRAINT "BrandIdentity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentSource" ADD CONSTRAINT "ContentSource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentIdea" ADD CONSTRAINT "ContentIdea_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContentIdea" ADD CONSTRAINT "ContentIdea_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandPalette" ADD CONSTRAINT "BrandPalette_brandIdentityId_fkey" FOREIGN KEY ("brandIdentityId") REFERENCES "BrandIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedPost" ADD CONSTRAINT "GeneratedPost_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GeneratedPost" ADD CONSTRAINT "GeneratedPost_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
