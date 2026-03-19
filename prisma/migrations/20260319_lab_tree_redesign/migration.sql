-- Drop old Lab tables in FK-safe order
DROP TABLE IF EXISTS "RunExport" CASCADE;
DROP TABLE IF EXISTS "CaptionVariation" CASCADE;
DROP TABLE IF EXISTS "ImageVariation" CASCADE;
DROP TABLE IF EXISTS "RunConcept" CASCADE;
DROP TABLE IF EXISTS "Run" CASCADE;
DROP TABLE IF EXISTS "Experiment" CASCADE;

-- Drop old Lab enums
DROP TYPE IF EXISTS "RunStatus";
DROP TYPE IF EXISTS "RunScope";
DROP TYPE IF EXISTS "VariationStatus";

-- Create new enums
CREATE TYPE "LabNodeLayer" AS ENUM ('source', 'idea', 'outline', 'image', 'caption');
CREATE TYPE "LabNodeStatus" AS ENUM ('pending', 'generating', 'completed', 'failed');
CREATE TYPE "LabNodeRating" AS ENUM ('up', 'down');

-- Create LabTree table
CREATE TABLE "LabTree" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "brandIdentityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabTree_pkey" PRIMARY KEY ("id")
);

-- Create LabNode table
CREATE TABLE "LabNode" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "parentId" TEXT,
    "layer" "LabNodeLayer" NOT NULL,
    "status" "LabNodeStatus" NOT NULL DEFAULT 'pending',
    "output" JSONB,
    "systemPrompt" TEXT,
    "contentPrompt" TEXT,
    "ancestorContext" JSONB,
    "rating" "LabNodeRating",
    "ratingComment" TEXT,
    "r2Key" TEXT,
    "mimeType" TEXT,
    "fileName" TEXT,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabNode_pkey" PRIMARY KEY ("id")
);

-- Create indexes for LabTree
CREATE INDEX "LabTree_orgId_idx" ON "LabTree"("orgId");
CREATE INDEX "LabTree_projectId_idx" ON "LabTree"("projectId");

-- Create indexes for LabNode
CREATE INDEX "LabNode_treeId_idx" ON "LabNode"("treeId");
CREATE INDEX "LabNode_treeId_layer_idx" ON "LabNode"("treeId", "layer");
CREATE INDEX "LabNode_parentId_idx" ON "LabNode"("parentId");
CREATE INDEX "LabNode_orgId_idx" ON "LabNode"("orgId");

-- Add foreign keys for LabTree
ALTER TABLE "LabTree" ADD CONSTRAINT "LabTree_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabTree" ADD CONSTRAINT "LabTree_brandIdentityId_fkey" FOREIGN KEY ("brandIdentityId") REFERENCES "BrandIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add foreign keys for LabNode
ALTER TABLE "LabNode" ADD CONSTRAINT "LabNode_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "LabTree"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabNode" ADD CONSTRAINT "LabNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "LabNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
