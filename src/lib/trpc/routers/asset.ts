import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, orgProtectedProcedure } from "../init";
import { deleteFromR2 } from "@/lib/r2";

export const assetRouter = router({
  list: orgProtectedProcedure
    .input(
      z.object({
        projectId: z.string().nullable().optional(),
        category: z.enum(["reference", "asset"]).optional(),
        mimeType: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.asset.findMany({
        where: {
          orgId: ctx.orgId,
          ...(input.projectId !== undefined
            ? { projectId: input.projectId }
            : {}),
          ...(input.category ? { category: input.category } : {}),
          ...(input.mimeType ? { mimeType: input.mimeType } : {}),
        },
        orderBy: { createdAt: "desc" },
        include: {
          project: { select: { id: true, name: true } },
        },
      });
    }),

  create: orgProtectedProcedure
    .input(
      z.object({
        r2Key: z.string(),
        mimeType: z.string(),
        fileName: z.string(),
        category: z.enum(["reference", "asset"]),
        projectId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.projectId) {
        const project = await ctx.prisma.project.findFirst({
          where: { id: input.projectId, orgId: ctx.orgId },
        });
        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }
      }
      return ctx.prisma.asset.create({
        data: { ...input, orgId: ctx.orgId },
      });
    }),

  move: orgProtectedProcedure
    .input(
      z.object({
        id: z.string(),
        projectId: z.string().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const asset = await ctx.prisma.asset.findFirst({
        where: { id: input.id, orgId: ctx.orgId },
      });
      if (!asset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Asset not found",
        });
      }
      if (input.projectId) {
        const project = await ctx.prisma.project.findFirst({
          where: { id: input.projectId, orgId: ctx.orgId },
        });
        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }
      }
      return ctx.prisma.asset.update({
        where: { id: input.id },
        data: { projectId: input.projectId },
      });
    }),

  delete: orgProtectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const asset = await ctx.prisma.asset.findFirst({
        where: { id: input.id, orgId: ctx.orgId },
      });
      if (!asset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Asset not found",
        });
      }
      // Delete from DB first, then try R2 (don't block on R2 errors)
      await ctx.prisma.asset.delete({ where: { id: input.id } });
      try {
        await deleteFromR2(asset.r2Key);
      } catch {
        // R2 deletion failure is non-blocking
        console.warn(`Failed to delete R2 object: ${asset.r2Key}`);
      }
      return { success: true };
    }),
});
