import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, orgProtectedProcedure } from "../init";

export const contentRouter = router({
  // Sources
  listSources: orgProtectedProcedure
    .input(z.object({ projectId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      if (input.projectId) {
        const project = await ctx.prisma.project.findFirst({
          where: { id: input.projectId, orgId: ctx.orgId },
        });
        if (!project)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
      }
      return ctx.prisma.contentSource.findMany({
        where: {
          orgId: ctx.orgId,
          ...(input.projectId ? { projectId: input.projectId } : {}),
        },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { ideas: true } } },
      });
    }),

  createSource: orgProtectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        rawText: z.string().min(1),
        projectId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.projectId) {
        const project = await ctx.prisma.project.findFirst({
          where: { id: input.projectId, orgId: ctx.orgId },
        });
        if (!project)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
      }
      return ctx.prisma.contentSource.create({
        data: { ...input, orgId: ctx.orgId },
      });
    }),

  deleteSource: orgProtectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const source = await ctx.prisma.contentSource.findFirst({
        where: { id: input.id, orgId: ctx.orgId },
      });
      if (!source)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Source not found",
        });
      await ctx.prisma.contentSource.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // Ideas
  listIdeas: orgProtectedProcedure
    .input(
      z.object({
        projectId: z.string().optional(),
        sourceId: z.string().optional(),
        contentType: z.string().optional(),
        isSaved: z.boolean().optional(),
        campaignId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.contentIdea.findMany({
        where: {
          orgId: ctx.orgId,
          ...(input.projectId ? { projectId: input.projectId } : {}),
          ...(input.sourceId ? { sourceId: input.sourceId } : {}),
          ...(input.contentType ? { contentType: input.contentType } : {}),
          ...(input.isSaved !== undefined ? { isSaved: input.isSaved } : {}),
          ...(input.campaignId ? { campaignId: input.campaignId } : {}),
        },
        orderBy: { createdAt: "desc" },
        include: { source: { select: { id: true, title: true } } },
      });
    }),

  toggleIdeaSave: orgProtectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const idea = await ctx.prisma.contentIdea.findFirst({
        where: { id: input.id, orgId: ctx.orgId },
      });
      if (!idea)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Idea not found",
        });
      return ctx.prisma.contentIdea.update({
        where: { id: input.id },
        data: { isSaved: !idea.isSaved },
      });
    }),

  bulkDeleteIdeas: orgProtectedProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.contentIdea.deleteMany({
        where: { id: { in: input.ids }, orgId: ctx.orgId },
      });
      return { success: true };
    }),
});
