import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, orgProtectedProcedure } from "../init";
import { deleteFromR2, uploadToR2, fetchFromR2, publicUrl } from "@/lib/r2";
import {
  generateIdeas as aiGenerateIdeas,
  generateOutlines as aiGenerateOutlines,
  generateImageFromPrompt,
  generateCaption as aiGenerateCaption,
  PROMPTS,
  type ModelKey,
  type AspectRatio,
} from "@/lib/ai";
import { generateText } from "ai";
import { textModel } from "@/lib/ai/config";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import type { LabNodeLayer } from "@/generated/prisma/client";
import pLimit from "p-limit";

// ── Types ────────────────────────────────────────────────────────

type NodeOutput = Record<string, unknown>;
type JsonValue = Prisma.InputJsonValue;

// ── Helpers ─────────────────────────────────────────────────────

/** Collect all non-null r2Keys from a set of nodes */
function collectR2Keys(nodes: { r2Key: string | null }[]): string[] {
  return nodes
    .map((n) => n.r2Key)
    .filter((key): key is string => key !== null);
}

/** Batch-delete R2 objects, logging failures without throwing */
async function batchDeleteR2(r2Keys: string[], context: string): Promise<void> {
  if (r2Keys.length === 0) return;

  const results = await Promise.allSettled(
    r2Keys.map((key) => deleteFromR2(key))
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    console.warn(
      `[${context}] Failed to delete ${failures.length}/${r2Keys.length} R2 objects`
    );
  }
}

/** Retry an async function with exponential backoff */
async function withRetry<T>(fn: () => Promise<T>, retries = 2, baseDelay = 1000): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, attempt)));
    }
  }
  throw new Error("Unreachable");
}

/** Fetch style prompt texts by style IDs */
async function getStylePrompts(
  prisma: PrismaClient,
  imageStyleId: string | null,
  captionStyleId: string | null,
): Promise<{ imageStylePrompt: string | null; captionStylePrompt: string | null; captionSampleTexts: string[] }> {
  let imageStylePrompt: string | null = null;
  let captionStylePrompt: string | null = null;
  let captionSampleTexts: string[] = [];

  if (imageStyleId) {
    const style = await prisma.style.findUnique({
      where: { id: imageStyleId },
      select: { promptText: true },
    });
    imageStylePrompt = style?.promptText ?? null;
  }

  if (captionStyleId) {
    const style = await prisma.style.findUnique({
      where: { id: captionStyleId },
      select: { promptText: true, sampleTexts: true },
    });
    captionStylePrompt = style?.promptText ?? null;
    captionSampleTexts = style?.sampleTexts ?? [];
  }

  return { imageStylePrompt, captionStylePrompt, captionSampleTexts };
}

/** Walk up ancestor chain to find the nearest node with a given style ID */
async function findAncestorStyleIds(
  prisma: PrismaClient,
  node: { parentId: string | null },
): Promise<{ imageStyleId: string | null; captionStyleId: string | null }> {
  let currentParentId = node.parentId;
  while (currentParentId) {
    const parent = await prisma.labNode.findUnique({
      where: { id: currentParentId },
      select: { parentId: true, imageStyleId: true, captionStyleId: true },
    });
    if (!parent) break;
    if (parent.imageStyleId || parent.captionStyleId) {
      return { imageStyleId: parent.imageStyleId, captionStyleId: parent.captionStyleId };
    }
    currentParentId = parent.parentId;
  }
  return { imageStyleId: null, captionStyleId: null };
}

// ── Ancestor Context Builder ────────────────────────────────────

/**
 * Walk up the parentId chain from a node and build a JSON context snapshot
 * appropriate for the node's layer.
 *
 * - Idea nodes:    { sourceText }
 * - Outline nodes: { sourceText, ideaText }
 * - Image nodes:   { ideaText, outlineSlides }
 * - Caption nodes: { ideaText, outlineSlides, imageDescription }
 */
async function buildAncestorContext(
  prisma: PrismaClient,
  node: { id: string; parentId: string | null; layer: string; r2Key?: string | null },
): Promise<Record<string, JsonValue>> {
  // Collect ancestors by walking up
  const ancestors: Array<{ id: string; parentId: string | null; layer: string; output: unknown; r2Key: string | null }> = [];
  let currentParentId = node.parentId;

  while (currentParentId) {
    const parent = await prisma.labNode.findUnique({
      where: { id: currentParentId },
      select: { id: true, parentId: true, layer: true, output: true, r2Key: true },
    });
    if (!parent) break;
    ancestors.push(parent);
    currentParentId = parent.parentId;
  }

  // Helper to find an ancestor by layer
  const findAncestor = (layer: string) => ancestors.find((a) => a.layer === layer);

  const getOutputText = (ancestor: { output: unknown } | undefined): string => {
    if (!ancestor) return "";
    const output = ancestor.output as NodeOutput | null;
    return (output?.text as string) ?? "";
  };

  const getOutputSlides = (ancestor: { output: unknown } | undefined): JsonValue[] => {
    if (!ancestor) return [];
    const output = ancestor.output as NodeOutput | null;
    return (output?.slides as JsonValue[]) ?? [];
  };

  switch (node.layer) {
    case "idea": {
      const source = findAncestor("source");
      return { sourceText: getOutputText(source) };
    }
    case "outline": {
      const source = findAncestor("source");
      const idea = findAncestor("idea");
      return {
        sourceText: getOutputText(source),
        ideaText: getOutputText(idea),
      };
    }
    case "image": {
      const idea = findAncestor("idea");
      const outline = findAncestor("outline");
      return {
        ideaText: getOutputText(idea),
        outlineSlides: getOutputSlides(outline),
      };
    }
    case "caption": {
      const idea = findAncestor("idea");
      const outline = findAncestor("outline");
      // Image description will be added separately during caption generation
      return {
        ideaText: getOutputText(idea),
        outlineSlides: getOutputSlides(outline),
      };
    }
    default:
      return {};
  }
}


// ── Layer mapping ───────────────────────────────────────────────

/** Map from parent layer to child layer */
const NEXT_LAYER: Record<string, LabNodeLayer> = {
  source: "idea",
  idea: "outline",
  outline: "image",
  image: "caption",
};

// ── Router ──────────────────────────────────────────────────────

export const labRouter = router({
  // ── Tree procedures ──────────────────────────────────────────

  listTrees: orgProtectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const trees = await ctx.prisma.labTree.findMany({
        where: {
          projectId: input.projectId,
          orgId: ctx.orgId,
        },
        include: {
          _count: { select: { nodes: true } },
          nodes: {
            select: { layer: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      // Aggregate node counts per layer for each tree
      return trees.map((tree) => {
        const layerCounts: Record<string, number> = {};
        for (const node of tree.nodes) {
          layerCounts[node.layer] = (layerCounts[node.layer] ?? 0) + 1;
        }

        const { nodes: _nodes, ...rest } = tree;
        return {
          ...rest,
          layerCounts,
        };
      });
    }),

  getTree: orgProtectedProcedure
    .input(z.object({ treeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const tree = await ctx.prisma.labTree.findUnique({
        where: { id: input.treeId },
        include: {
          nodes: {
            select: {
              id: true,
              parentId: true,
              layer: true,
              status: true,
              output: true,
              rating: true,
              r2Key: true,
              mimeType: true,
              fileName: true,
              systemPrompt: true,
              contentPrompt: true,
              imageStyleId: true,
              captionStyleId: true,
            },
          },
        },
      });

      if (!tree) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tree not found" });
      }

      if (tree.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      return tree;
    }),

  createTree: orgProtectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        projectId: z.string(),
        brandIdentityId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tree = await ctx.prisma.labTree.create({
        data: {
          name: input.name,
          projectId: input.projectId,
          orgId: ctx.orgId,
          brandIdentityId: input.brandIdentityId ?? null,
        },
      });

      return tree;
    }),

  updateTree: orgProtectedProcedure
    .input(
      z.object({
        treeId: z.string(),
        name: z.string().min(1).max(200).optional(),
        brandIdentityId: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tree = await ctx.prisma.labTree.findFirst({
        where: { id: input.treeId, orgId: ctx.orgId },
      });

      if (!tree) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tree not found" });
      }

      const { treeId, ...data } = input;
      return ctx.prisma.labTree.update({ where: { id: treeId }, data });
    }),

  deleteTree: orgProtectedProcedure
    .input(z.object({ treeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tree = await ctx.prisma.labTree.findFirst({
        where: { id: input.treeId, orgId: ctx.orgId },
      });

      if (!tree) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tree not found" });
      }

      // Collect all R2 keys from nodes before cascade-deleting
      const nodes = await ctx.prisma.labNode.findMany({
        where: { treeId: input.treeId, r2Key: { not: null } },
        select: { r2Key: true },
      });

      const r2Keys = collectR2Keys(nodes);

      // Delete tree (cascades to all nodes)
      await ctx.prisma.labTree.delete({ where: { id: input.treeId } });

      // Batch-delete R2 objects
      await batchDeleteR2(r2Keys, "lab.deleteTree");

      return { success: true };
    }),

  // ── Node procedures ──────────────────────────────────────────

  createSourceNode: orgProtectedProcedure
    .input(
      z.object({
        treeId: z.string(),
        text: z.string().optional(),
        r2Key: z.string().optional(),
        fileName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify tree belongs to org
      const tree = await ctx.prisma.labTree.findFirst({
        where: { id: input.treeId, orgId: ctx.orgId },
      });

      if (!tree) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tree not found" });
      }

      const node = await ctx.prisma.labNode.create({
        data: {
          treeId: input.treeId,
          orgId: ctx.orgId,
          layer: "source",
          status: "completed",
          output: input.text ? { text: input.text } : undefined,
          r2Key: input.r2Key ?? null,
          fileName: input.fileName ?? null,
        },
      });

      return node;
    }),

  updateNode: orgProtectedProcedure
    .input(
      z.object({
        nodeId: z.string(),
        systemPrompt: z.string().nullable().optional(),
        contentPrompt: z.string().nullable().optional(),
        rating: z.enum(["up", "down"]).nullable().optional(),
        ratingComment: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify org through node -> tree
      const node = await ctx.prisma.labNode.findUnique({
        where: { id: input.nodeId },
        include: { tree: { select: { orgId: true } } },
      });

      if (!node || node.tree.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Node not found" });
      }

      const { nodeId, ...data } = input;
      return ctx.prisma.labNode.update({ where: { id: nodeId }, data });
    }),

  duplicateNode: orgProtectedProcedure
    .input(z.object({ nodeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Fetch the source node and verify org
      const source = await ctx.prisma.labNode.findUnique({
        where: { id: input.nodeId },
        include: { tree: { select: { orgId: true } } },
      });

      if (!source || source.tree.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Node not found" });
      }

      // Create sibling with same parent, layer, prompts — status pending, no output
      const duplicate = await ctx.prisma.labNode.create({
        data: {
          treeId: source.treeId,
          parentId: source.parentId,
          orgId: ctx.orgId,
          layer: source.layer,
          status: "pending",
          systemPrompt: source.systemPrompt,
          contentPrompt: source.contentPrompt,
        },
      });

      return duplicate;
    }),

  deleteNode: orgProtectedProcedure
    .input(z.object({ nodeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify org through node -> tree
      const node = await ctx.prisma.labNode.findUnique({
        where: { id: input.nodeId },
        include: { tree: { select: { orgId: true } } },
      });

      if (!node || node.tree.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Node not found" });
      }

      // Collect r2Keys from node + entire subtree (cascade will handle DB deletion)
      // We need a recursive approach: find all descendants
      const allDescendantIds = await collectSubtreeIds(ctx.prisma, input.nodeId);
      const allNodeIds = [input.nodeId, ...allDescendantIds];

      const nodes = await ctx.prisma.labNode.findMany({
        where: { id: { in: allNodeIds }, r2Key: { not: null } },
        select: { r2Key: true },
      });

      const r2Keys = collectR2Keys(nodes);

      // Delete node (cascades to children via onDelete: Cascade)
      await ctx.prisma.labNode.delete({ where: { id: input.nodeId } });

      // Batch-delete R2 objects
      await batchDeleteR2(r2Keys, "lab.deleteNode");

      return { success: true };
    }),

  rateNode: orgProtectedProcedure
    .input(
      z.object({
        nodeId: z.string(),
        rating: z.enum(["up", "down"]),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify org through node -> tree
      const node = await ctx.prisma.labNode.findUnique({
        where: { id: input.nodeId },
        include: { tree: { select: { orgId: true } } },
      });

      if (!node || node.tree.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Node not found" });
      }

      return ctx.prisma.labNode.update({
        where: { id: input.nodeId },
        data: {
          rating: input.rating,
          ratingComment: input.comment ?? null,
        },
      });
    }),

  treeProgress: orgProtectedProcedure
    .input(z.object({ treeId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify tree belongs to org
      const tree = await ctx.prisma.labTree.findFirst({
        where: { id: input.treeId, orgId: ctx.orgId },
      });

      if (!tree) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tree not found" });
      }

      // Stale generation cleanup: mark nodes stuck generating >5min as failed
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      await ctx.prisma.labNode.updateMany({
        where: {
          treeId: input.treeId,
          status: "generating",
          updatedAt: { lt: fiveMinutesAgo },
        },
        data: { status: "failed" },
      });

      const fiveSecondsAgo = new Date(Date.now() - 5000);

      const nodes = await ctx.prisma.labNode.findMany({
        where: {
          treeId: input.treeId,
          OR: [
            { status: "generating" },
            { updatedAt: { gte: fiveSecondsAgo } },
          ],
        },
        select: {
          id: true,
          status: true,
          output: true,
          r2Key: true,
          updatedAt: true,
        },
      });

      return nodes;
    }),

  // ── Generation procedures ─────────────────────────────────────

  generateIdeas: orgProtectedProcedure
    .input(
      z.object({
        sourceNodeId: z.string(),
        count: z.number().min(1).max(20).default(5),
        systemPrompt: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch source node and verify org
      const sourceNode = await ctx.prisma.labNode.findUnique({
        where: { id: input.sourceNodeId },
        include: { tree: { select: { orgId: true } } },
      });

      if (!sourceNode || sourceNode.tree.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Source node not found" });
      }

      if (sourceNode.layer !== "source") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Node is not a source node" });
      }

      const sourceOutput = sourceNode.output as NodeOutput | null;
      const sourceText = (sourceOutput?.text as string) ?? "";

      if (!sourceText) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Source node has no text content" });
      }

      const customPrompt = input.systemPrompt ?? undefined;
      const sysPrompt = customPrompt ?? PROMPTS.ideas(input.count);

      // Generate ideas — full source, no chunking (Gemini 3.1 Pro handles 1M tokens)
      const allIdeas = await withRetry(() =>
        aiGenerateIdeas(sourceText, input.count, customPrompt),
      );

      // Create one node per idea returned
      const contentPrompt = `SOURCE TEXT:\n"""\n${sourceText.slice(0, 2000)}${sourceText.length > 2000 ? "... [truncated]" : ""}\n"""`;
      const nodeIds: string[] = [];
      for (const ideaText of allIdeas) {
        const node = await ctx.prisma.labNode.create({
          data: {
            treeId: sourceNode.treeId,
            parentId: input.sourceNodeId,
            orgId: ctx.orgId,
            layer: "idea",
            status: "completed",
            systemPrompt: sysPrompt,
            ancestorContext: { sourceText: sourceText.slice(0, 5000) },
            output: { text: ideaText },
            contentPrompt,
          },
        });
        nodeIds.push(node.id);
      }

      return { nodeIds };
    }),

  generateOutlines: orgProtectedProcedure
    .input(
      z.object({
        ideaNodeId: z.string(),
        count: z.number().min(1).max(10).default(3),
        systemPrompt: z.string().optional(),
        imageStyleId: z.string().optional(),
        captionStyleId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch idea node and verify org
      const ideaNode = await ctx.prisma.labNode.findUnique({
        where: { id: input.ideaNodeId },
        include: { tree: { select: { orgId: true } } },
      });

      if (!ideaNode || ideaNode.tree.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Idea node not found" });
      }

      if (ideaNode.layer !== "idea") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Node is not an idea node" });
      }

      const ideaOutput = ideaNode.output as NodeOutput | null;
      const ideaText = (ideaOutput?.text as string) ?? "";

      if (!ideaText) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Idea node has no text content" });
      }

      // Build ancestor context
      const ancestorContext = await buildAncestorContext(ctx.prisma, ideaNode);
      const fullAncestorContext = { ...ancestorContext, ideaText };

      // Fetch style prompts if style IDs provided
      const { imageStylePrompt } = await getStylePrompts(
        ctx.prisma,
        input.imageStyleId ?? null,
        input.captionStyleId ?? null,
      );

      const customPrompt = input.systemPrompt ?? undefined;
      const sysPrompt = customPrompt ?? PROMPTS.outlines(input.count);

      // Build the user prompt with style context
      const promptParts = [
        ideaText,
        imageStylePrompt && `Visual style direction: ${imageStylePrompt}. Design the outline to work well with this aesthetic.`,
      ].filter(Boolean);
      const fullPrompt = promptParts.join("\n\n");

      // Generate outlines with structured output
      const outlines = await withRetry(() =>
        aiGenerateOutlines(fullPrompt, input.count, customPrompt),
      );

      const contentPrompt = `IDEA:\n"""\n${ideaText}\n"""`;

      // Create one node per outline returned
      const nodeIds: string[] = [];
      for (const outline of outlines) {
        const node = await ctx.prisma.labNode.create({
          data: {
            treeId: ideaNode.treeId,
            parentId: input.ideaNodeId,
            orgId: ctx.orgId,
            layer: "outline",
            status: "completed",
            systemPrompt: sysPrompt,
            imageStyleId: input.imageStyleId ?? null,
            captionStyleId: input.captionStyleId ?? null,
            ancestorContext: fullAncestorContext,
            output: {
              slides: outline.slides as JsonValue[],
              overallTheme: outline.overallTheme,
              text: outline.overallTheme,
            } satisfies Record<string, JsonValue>,
            contentPrompt,
          },
        });
        nodeIds.push(node.id);
      }

      return { nodeIds };
    }),

  generateImages: orgProtectedProcedure
    .input(
      z.object({
        outlineNodeId: z.string(),
        count: z.number().min(1).max(10).default(3),
        systemPrompt: z.string().optional(),
        model: z.enum(["nano-banana-2", "nano-banana-pro"]).default("nano-banana-2"),
        aspectRatio: z.enum(["3:4", "1:1", "4:5", "9:16"]).default("1:1"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch outline node and verify org
      const outlineNode = await ctx.prisma.labNode.findUnique({
        where: { id: input.outlineNodeId },
        include: {
          tree: {
            select: {
              orgId: true,
              brandIdentityId: true,
              brandIdentity: {
                include: { palettes: true },
              },
            },
          },
        },
      });

      if (!outlineNode || outlineNode.tree.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Outline node not found" });
      }

      if (outlineNode.layer !== "outline") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Node is not an outline node" });
      }

      const outlineOutput = outlineNode.output as NodeOutput | null;
      const outlineSlides = (outlineOutput?.slides as unknown[]) ?? [];
      const overallTheme = (outlineOutput?.overallTheme as string) ?? "";

      // Build ancestor context
      const ancestorContext = await buildAncestorContext(ctx.prisma, outlineNode);

      // Build brand context from tree's brand identity
      let brandContext = "";
      const brand = outlineNode.tree.brandIdentity;
      if (brand) {
        const parts: string[] = [];
        if (brand.name) parts.push(`Brand: ${brand.name}`);
        if (brand.tagline) parts.push(`Tagline: "${brand.tagline}"`);
        if (brand.palettes.length > 0) {
          const palette = brand.palettes[0];
          parts.push(`Brand colors — Accent: ${palette.accentColor}, Background: ${palette.bgColor}`);
        }
        brandContext = parts.join(". ");
      }

      // Fetch image style from parent outline node
      const { imageStylePrompt } = await getStylePrompts(
        ctx.prisma,
        outlineNode.imageStyleId,
        null,
      );

      // Create N image nodes with status "generating"
      const nodeIds: string[] = [];
      for (let i = 0; i < input.count; i++) {
        const node = await ctx.prisma.labNode.create({
          data: {
            treeId: outlineNode.treeId,
            parentId: input.outlineNodeId,
            orgId: ctx.orgId,
            layer: "image",
            status: "generating",
            systemPrompt: input.systemPrompt ?? PROMPTS.images,
            ancestorContext,
          },
        });
        nodeIds.push(node.id);
      }

      // Return IDs immediately
      const result = { nodeIds };

      // Fire-and-forget background generation with p-limit(5)
      const limit = pLimit(5);
      const sysPrompt = input.systemPrompt ?? PROMPTS.images;

      void (async () => {
        const jobs = nodeIds.map((nodeId, i) =>
          limit(async () => {
            try {
              // Cancellation check
              const current = await ctx.prisma.labNode.findUnique({ where: { id: nodeId } });
              if (current?.status !== "generating") return;

              // Build image prompt
              const slidesText = outlineSlides
                .map((s, idx) => {
                  const slide = s as { title?: string; description?: string; layoutNotes?: string };
                  return `Slide ${idx + 1}: ${slide.title ?? ""} — ${slide.description ?? ""}${slide.layoutNotes ? ` (Layout: ${slide.layoutNotes})` : ""}`;
                })
                .join("\n");

              const promptParts = [
                sysPrompt,
                imageStylePrompt && `Visual style: ${imageStylePrompt}`,
                overallTheme && `Theme: ${overallTheme}`,
                slidesText && `Outline:\n${slidesText}`,
                brandContext && `Brand context: ${brandContext}`,
                input.count > 1 && `Variation ${i + 1} of ${input.count}: Make this visually distinct.`,
              ].filter(Boolean);

              const imagePrompt = promptParts.join("\n\n");

              const imgResult = await withRetry(() =>
                generateImageFromPrompt(
                  imagePrompt,
                  input.model as ModelKey,
                  input.aspectRatio as AspectRatio,
                ),
              );

              // Upload to R2
              const ext = imgResult.mimeType.split("/")[1] || "png";
              const r2Key = `lab/${nodeId}/original.${ext}`;
              const imageBuffer = Buffer.from(imgResult.base64, "base64");
              await uploadToR2(r2Key, imageBuffer, imgResult.mimeType);

              await ctx.prisma.labNode.update({
                where: { id: nodeId },
                data: {
                  status: "completed",
                  output: { url: publicUrl(r2Key) },
                  r2Key,
                  mimeType: imgResult.mimeType,
                  contentPrompt: imagePrompt,
                },
              });
            } catch {
              try {
                await ctx.prisma.labNode.update({
                  where: { id: nodeId },
                  data: { status: "failed" },
                });
              } catch {
                // Ignore
              }
            }
          })
        );

        await Promise.allSettled(jobs);
      })();

      return result;
    }),

  generateCaptions: orgProtectedProcedure
    .input(
      z.object({
        imageNodeId: z.string(),
        count: z.number().min(1).max(10).default(3),
        systemPrompt: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch image node and verify org
      const imageNode = await ctx.prisma.labNode.findUnique({
        where: { id: input.imageNodeId },
        include: { tree: { select: { orgId: true } } },
      });

      if (!imageNode || imageNode.tree.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Image node not found" });
      }

      if (imageNode.layer !== "image") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Node is not an image node" });
      }

      // Build ancestor context (for outline slides text)
      const ancestorContext = await buildAncestorContext(ctx.prisma, imageNode);

      // Fetch caption style from ancestor outline node
      const ancestorStyles = await findAncestorStyleIds(ctx.prisma, imageNode);
      const { captionStylePrompt, captionSampleTexts } = await getStylePrompts(
        ctx.prisma,
        null,
        ancestorStyles.captionStyleId,
      );

      // Build outline context string for the caption prompt
      const outlineSlides = (ancestorContext.outlineSlides as unknown[]) ?? [];
      const slidesText = outlineSlides
        .map((s, idx) => {
          const slide = s as { title?: string; description?: string };
          return `Slide ${idx + 1}: ${slide.title ?? ""} — ${slide.description ?? ""}`;
        })
        .join("\n");

      const outlineContext = [
        slidesText && `Outline:\n${slidesText}`,
        captionStylePrompt && `Caption style: ${captionStylePrompt}`,
        captionSampleTexts.length > 0 && `Example captions in this style:\n${captionSampleTexts.map((t, i) => `${i + 1}. ${t}`).join("\n")}`,
        `Image node ID: ${input.imageNodeId}`,
        `Organization ID: ${ctx.orgId}`,
      ]
        .filter(Boolean)
        .join("\n\n");

      // Create N caption nodes with status "generating"
      const nodeIds: string[] = [];
      for (let i = 0; i < input.count; i++) {
        const node = await ctx.prisma.labNode.create({
          data: {
            treeId: imageNode.treeId,
            parentId: input.imageNodeId,
            orgId: ctx.orgId,
            layer: "caption",
            status: "generating",
            systemPrompt: input.systemPrompt ?? PROMPTS.captions,
            ancestorContext,
          },
        });
        nodeIds.push(node.id);
      }

      // Return IDs immediately
      const result = { nodeIds };

      // Fire-and-forget background generation with p-limit(10)
      const limit = pLimit(10);

      // Build deps for caption generation tools
      const captionDeps = {
        prisma: ctx.prisma,
        fetchFromR2,
      };

      void (async () => {
        const jobs = nodeIds.map((nodeId, i) =>
          limit(async () => {
            try {
              // Cancellation check
              const current = await ctx.prisma.labNode.findUnique({
                where: { id: nodeId },
              });
              if (current?.status !== "generating") return;

              const variationContext =
                input.count > 1
                  ? `\n\nVariation ${i + 1} of ${input.count}: Write a distinct caption variation.`
                  : "";

              const captionResult = await withRetry(() =>
                aiGenerateCaption(
                  outlineContext + variationContext,
                  input.imageNodeId,
                  ctx.orgId,
                  captionDeps,
                  input.systemPrompt ?? undefined,
                ),
              );

              const captionText = captionResult.caption +
                (captionResult.hashtags.length > 0
                  ? "\n\n" + captionResult.hashtags.map((h) => `#${h}`).join(" ")
                  : "");

              await ctx.prisma.labNode.update({
                where: { id: nodeId },
                data: {
                  status: "completed",
                  output: { text: captionText.trim() },
                  contentPrompt: outlineContext,
                },
              });
            } catch {
              try {
                await ctx.prisma.labNode.update({
                  where: { id: nodeId },
                  data: { status: "failed" },
                });
              } catch {
                // Ignore
              }
            }
          }),
        );

        await Promise.allSettled(jobs);
      })();

      return result;
    }),

  cancelGeneration: orgProtectedProcedure
    .input(
      z.object({
        treeId: z.string(),
        subtreeRootId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify tree belongs to org
      const tree = await ctx.prisma.labTree.findFirst({
        where: { id: input.treeId, orgId: ctx.orgId },
      });

      if (!tree) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tree not found" });
      }

      if (input.subtreeRootId) {
        // Cancel only within the subtree
        const descendantIds = await collectSubtreeIds(ctx.prisma, input.subtreeRootId);
        const allIds = [input.subtreeRootId, ...descendantIds];

        const result = await ctx.prisma.labNode.updateMany({
          where: {
            id: { in: allIds },
            treeId: input.treeId,
            status: "generating",
          },
          data: { status: "failed" },
        });

        return { cancelledCount: result.count };
      } else {
        // Cancel all generating nodes in the tree
        const result = await ctx.prisma.labNode.updateMany({
          where: {
            treeId: input.treeId,
            status: "generating",
          },
          data: { status: "failed" },
        });

        return { cancelledCount: result.count };
      }
    }),

  // ── Batch generation ──────────────────────────────────────────

  generateBatch: orgProtectedProcedure
    .input(
      z.object({
        nodeIds: z.array(z.string()).min(1).max(50),
        count: z.number().min(1).max(20).default(3),
        systemPrompt: z.string().optional(),
        model: z.enum(["nano-banana-2", "nano-banana-pro"]).default("nano-banana-2"),
        aspectRatio: z.enum(["3:4", "1:1", "4:5", "9:16"]).default("1:1"),
        imageStyleId: z.string().optional(),
        captionStyleId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch all nodes and verify they belong to the same org and layer
      const nodes = await ctx.prisma.labNode.findMany({
        where: {
          id: { in: input.nodeIds },
        },
        include: { tree: { select: { orgId: true } } },
      });

      if (nodes.length !== input.nodeIds.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Some nodes not found" });
      }

      // Verify org ownership
      for (const node of nodes) {
        if (node.tree.orgId !== ctx.orgId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied to one or more nodes" });
        }
      }

      // All nodes must be at the same layer
      const layers = new Set(nodes.map((n) => n.layer));
      if (layers.size !== 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "All nodes must be at the same layer for batch generation",
        });
      }

      const layer = nodes[0].layer;
      const nextLayer = NEXT_LAYER[layer];
      if (!nextLayer) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot generate children for ${layer} layer nodes`,
        });
      }

      // Resolve default system prompt based on the generation layer
      const defaultSysPrompt = (() => {
        switch (layer) {
          case "source": return PROMPTS.ideas(input.count);
          case "idea": return PROMPTS.outlines(input.count);
          case "outline": return PROMPTS.images;
          case "image": return PROMPTS.captions;
          default: return null;
        }
      })();
      const sysPromptToStore = input.systemPrompt ?? defaultSysPrompt;

      // For each node, call the appropriate generation based on layer
      const allNodeIds: string[] = [];
      const limit = layer === "outline" ? pLimit(5) : pLimit(10);

      for (const node of nodes) {
        // Create child nodes
        const childIds: string[] = [];
        for (let i = 0; i < input.count; i++) {
          const child = await ctx.prisma.labNode.create({
            data: {
              treeId: node.treeId,
              parentId: node.id,
              orgId: ctx.orgId,
              layer: nextLayer,
              status: "generating",
              systemPrompt: sysPromptToStore,
              // Store style IDs on outline nodes (when parent is idea)
              ...(layer === "idea" && {
                imageStyleId: input.imageStyleId ?? null,
                captionStyleId: input.captionStyleId ?? null,
              }),
              ancestorContext: await buildAncestorContext(ctx.prisma, {
                id: "temp",
                parentId: node.id,
                layer: nextLayer,
              }),
            },
          });
          childIds.push(child.id);
        }
        allNodeIds.push(...childIds);

        // Fire-and-forget per-node generation
        const nodeOutput = node.output as NodeOutput | null;

        void (async () => {
          try {
            switch (layer) {
              case "source": {
                // Generate ideas
                const sourceText = (nodeOutput?.text as string) ?? "";
                const sysPrompt = input.systemPrompt ?? undefined;
                const ideas = await withRetry(() =>
                  aiGenerateIdeas(sourceText, input.count, sysPrompt),
                );
                const contentPrompt = `SOURCE TEXT:\n"""\n${sourceText.slice(0, 2000)}...\n"""`;

                for (let i = 0; i < childIds.length; i++) {
                  try {
                    const current = await ctx.prisma.labNode.findUnique({ where: { id: childIds[i] } });
                    if (current?.status !== "generating") continue;
                    if (i < ideas.length) {
                      await ctx.prisma.labNode.update({
                        where: { id: childIds[i] },
                        data: { status: "completed", output: { text: ideas[i] }, contentPrompt },
                      });
                    } else {
                      await ctx.prisma.labNode.delete({ where: { id: childIds[i] } });
                    }
                  } catch {
                    await ctx.prisma.labNode.update({ where: { id: childIds[i] }, data: { status: "failed" } }).catch(() => {});
                  }
                }
                break;
              }
              case "idea": {
                // Generate outlines — inject image style for visual direction
                const ideaText = (nodeOutput?.text as string) ?? "";
                const sysPrompt = input.systemPrompt ?? undefined;
                const batchStyles = await getStylePrompts(ctx.prisma, input.imageStyleId ?? null, input.captionStyleId ?? null);
                const outlinePromptParts = [
                  ideaText,
                  batchStyles.imageStylePrompt && `Visual style direction: ${batchStyles.imageStylePrompt}. Design the outline to work well with this aesthetic.`,
                ].filter(Boolean);
                const outlines = await withRetry(() =>
                  aiGenerateOutlines(outlinePromptParts.join("\n\n"), input.count, sysPrompt),
                );
                const contentPrompt = `IDEA:\n"""\n${ideaText}\n"""`;

                for (let i = 0; i < childIds.length; i++) {
                  try {
                    const current = await ctx.prisma.labNode.findUnique({ where: { id: childIds[i] } });
                    if (current?.status !== "generating") continue;
                    if (i < outlines.length) {
                      const outline = outlines[i];
                      await ctx.prisma.labNode.update({
                        where: { id: childIds[i] },
                        data: {
                          status: "completed",
                          output: { slides: outline.slides as JsonValue[], overallTheme: outline.overallTheme, text: outline.overallTheme } satisfies Record<string, JsonValue>,
                          contentPrompt,
                        },
                      });
                    } else {
                      await ctx.prisma.labNode.delete({ where: { id: childIds[i] } });
                    }
                  } catch {
                    await ctx.prisma.labNode.update({ where: { id: childIds[i] }, data: { status: "failed" } }).catch(() => {});
                  }
                }
                break;
              }
              case "outline": {
                // Generate images
                const outlineSlides = (nodeOutput?.slides as unknown[]) ?? [];
                const overallTheme = (nodeOutput?.overallTheme as string) ?? "";
                const sysPrompt = input.systemPrompt ?? PROMPTS.images;

                const slidesText = outlineSlides
                  .map((s, idx) => {
                    const slide = s as { title?: string; description?: string; layoutNotes?: string };
                    return `Slide ${idx + 1}: ${slide.title ?? ""} — ${slide.description ?? ""}${slide.layoutNotes ? ` (Layout: ${slide.layoutNotes})` : ""}`;
                  })
                  .join("\n");

                const jobs = childIds.map((childId, i) =>
                  limit(async () => {
                    try {
                      const current = await ctx.prisma.labNode.findUnique({ where: { id: childId } });
                      if (current?.status !== "generating") return;

                      // Read image style from the parent node (outline)
                      const nodeImageStyle = node.imageStyleId
                        ? (await getStylePrompts(ctx.prisma, node.imageStyleId, null)).imageStylePrompt
                        : null;

                      const promptParts = [
                        sysPrompt,
                        nodeImageStyle && `Visual style: ${nodeImageStyle}`,
                        overallTheme && `Theme: ${overallTheme}`,
                        slidesText && `Outline:\n${slidesText}`,
                        input.count > 1 && `Variation ${i + 1} of ${input.count}: Make this visually distinct.`,
                      ].filter(Boolean);
                      const imagePrompt = promptParts.join("\n\n");

                      const imgResult = await withRetry(() =>
                        generateImageFromPrompt(imagePrompt, input.model as ModelKey, input.aspectRatio as AspectRatio),
                      );
                      const ext = imgResult.mimeType.split("/")[1] || "png";
                      const r2Key = `lab/${childId}/original.${ext}`;
                      const imageBuffer = Buffer.from(imgResult.base64, "base64");
                      await uploadToR2(r2Key, imageBuffer, imgResult.mimeType);

                      await ctx.prisma.labNode.update({
                        where: { id: childId },
                        data: { status: "completed", output: { url: publicUrl(r2Key) }, r2Key, mimeType: imgResult.mimeType, contentPrompt: imagePrompt },
                      });
                    } catch {
                      await ctx.prisma.labNode.update({ where: { id: childId }, data: { status: "failed" } }).catch(() => {});
                    }
                  }),
                );
                await Promise.allSettled(jobs);
                break;
              }
              case "image": {
                // Generate captions
                const ancestorCtx = await buildAncestorContext(ctx.prisma, node);
                const outlineSlidesCap = (ancestorCtx.outlineSlides as unknown[]) ?? [];
                const slidesTextCap = outlineSlidesCap
                  .map((s, idx) => {
                    const slide = s as { title?: string; description?: string };
                    return `Slide ${idx + 1}: ${slide.title ?? ""} — ${slide.description ?? ""}`;
                  })
                  .join("\n");

                // Read caption style from ancestor outline node
                const batchAncestorStyles = await findAncestorStyleIds(ctx.prisma, node);
                const batchCaptionStyle = await getStylePrompts(ctx.prisma, null, batchAncestorStyles.captionStyleId);

                const outlineContext = [
                  slidesTextCap && `Outline:\n${slidesTextCap}`,
                  batchCaptionStyle.captionStylePrompt && `Caption style: ${batchCaptionStyle.captionStylePrompt}`,
                  batchCaptionStyle.captionSampleTexts.length > 0 && `Example captions in this style:\n${batchCaptionStyle.captionSampleTexts.map((t, i) => `${i + 1}. ${t}`).join("\n")}`,
                  `Image node ID: ${node.id}`,
                  `Organization ID: ${ctx.orgId}`,
                ].filter(Boolean).join("\n\n");

                const captionDeps = { prisma: ctx.prisma, fetchFromR2 };

                const captionJobs = childIds.map((childId, i) =>
                  limit(async () => {
                    try {
                      const current = await ctx.prisma.labNode.findUnique({ where: { id: childId } });
                      if (current?.status !== "generating") return;

                      const variationCtx = input.count > 1
                        ? `\n\nVariation ${i + 1} of ${input.count}: Write a distinct caption variation.`
                        : "";

                      const captionResult = await withRetry(() =>
                        aiGenerateCaption(outlineContext + variationCtx, node.id, ctx.orgId, captionDeps, input.systemPrompt ?? undefined),
                      );

                      const captionText = captionResult.caption +
                        (captionResult.hashtags.length > 0
                          ? "\n\n" + captionResult.hashtags.map((h) => `#${h}`).join(" ")
                          : "");

                      await ctx.prisma.labNode.update({
                        where: { id: childId },
                        data: { status: "completed", output: { text: captionText.trim() }, contentPrompt: outlineContext },
                      });
                    } catch {
                      await ctx.prisma.labNode.update({ where: { id: childId }, data: { status: "failed" } }).catch(() => {});
                    }
                  }),
                );
                await Promise.allSettled(captionJobs);
                break;
              }
            }
          } catch {
            for (const childId of childIds) {
              await ctx.prisma.labNode.update({ where: { id: childId }, data: { status: "failed" } }).catch(() => {});
            }
          }
        })();
      }

      return { nodeIds: allNodeIds };
    }),

  // ── AI Prompt Tweaking ────────────────────────────────────────

  tweakPrompt: orgProtectedProcedure
    .input(
      z.object({
        currentPrompt: z.string(),
        instruction: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const prompt = `Here is a prompt:\n"""\n${input.currentPrompt}\n"""\n\nThe user wants to: ${input.instruction}\n\nReturn only the updated prompt text. Do not include any explanation or formatting — just the new prompt.`;

      const result = await withRetry(async () => {
        const { text } = await generateText({
          model: textModel,
          prompt,
        });
        return text;
      });

      return { prompt: result.trim() };
    }),

  // ── Export to Gallery ─────────────────────────────────────────

  exportToGallery: orgProtectedProcedure
    .input(
      z.object({
        posts: z.array(
          z.object({
            captionNodeId: z.string(),
          })
        ).min(1),
        projectId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const postIds: string[] = [];

      for (const post of input.posts) {
        // Fetch caption node
        const captionNode = await ctx.prisma.labNode.findUnique({
          where: { id: post.captionNodeId },
          include: { tree: { select: { orgId: true } } },
        });

        if (!captionNode || captionNode.tree.orgId !== ctx.orgId) {
          throw new TRPCError({ code: "NOT_FOUND", message: `Caption node ${post.captionNodeId} not found` });
        }

        if (captionNode.layer !== "caption" || captionNode.status !== "completed") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Node ${post.captionNodeId} is not a completed caption node`,
          });
        }

        // Fetch parent image node
        if (!captionNode.parentId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Caption node has no parent image node" });
        }

        const imageNode = await ctx.prisma.labNode.findUnique({
          where: { id: captionNode.parentId },
        });

        if (!imageNode || imageNode.layer !== "image" || imageNode.status !== "completed") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Parent image node not found or not completed",
          });
        }

        if (!imageNode.r2Key) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Parent image node has no image file",
          });
        }

        // Extract caption text
        const captionOutput = captionNode.output as NodeOutput | null;
        const captionText = (captionOutput?.text as string) ?? "";

        // Create GeneratedPost
        const generatedPost = await ctx.prisma.generatedPost.create({
          data: {
            prompt: captionText,
            format: "static",
            aspectRatio: "1:1",
            model: "lab-export",
            status: "completed",
            description: captionText,
            platform: "instagram",
            orgId: ctx.orgId,
            projectId: input.projectId ?? null,
          },
        });

        // Create GeneratedImage referencing the R2 key (no blob)
        await ctx.prisma.generatedImage.create({
          data: {
            postId: generatedPost.id,
            slideNumber: 1,
            r2Key: imageNode.r2Key,
            mimeType: imageNode.mimeType ?? "image/png",
          },
        });

        postIds.push(generatedPost.id);
      }

      return { postIds };
    }),
});

// ── Recursive subtree collection ───────────────────────────────

/**
 * Recursively collect all descendant node IDs for a given node.
 * Uses iterative BFS to avoid stack overflow on deep trees.
 */
async function collectSubtreeIds(
  prisma: PrismaClient,
  rootId: string
): Promise<string[]> {
  const allIds: string[] = [];
  let currentParentIds = [rootId];

  while (currentParentIds.length > 0) {
    const children = await prisma.labNode.findMany({
      where: { parentId: { in: currentParentIds } },
      select: { id: true },
    });

    const childIds = children.map((c) => c.id);
    allIds.push(...childIds);
    currentParentIds = childIds;
  }

  return allIds;
}
