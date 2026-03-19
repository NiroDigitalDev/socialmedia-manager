import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, orgProtectedProcedure } from "../init";
import { deleteFromR2 } from "@/lib/r2";
import type { PrismaClient } from "@/generated/prisma/client";

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
