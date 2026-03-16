import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, orgProtectedProcedure } from "../init";

export const campaignRouter = router({
  list: orgProtectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, orgId: ctx.orgId },
      });
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      return ctx.prisma.campaign.findMany({
        where: { projectId: input.projectId },
        orderBy: { updatedAt: "desc" },
        include: {
          brandIdentity: { select: { id: true, name: true } },
          _count: { select: { posts: true, contentIdeas: true } },
        },
      });
    }),

  get: orgProtectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.campaign.findFirst({
        where: { id: input.id, project: { orgId: ctx.orgId } },
        include: {
          brandIdentity: true,
          project: { select: { id: true, name: true } },
          _count: { select: { posts: true, contentIdeas: true } },
        },
      });
      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }
      return campaign;
    }),

  create: orgProtectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        brandIdentityId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, orgId: ctx.orgId },
      });
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      return ctx.prisma.campaign.create({ data: input });
    }),

  update: orgProtectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).optional(),
        brandIdentityId: z.string().nullable().optional(),
        status: z.enum(["draft", "active", "completed", "archived"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const campaign = await ctx.prisma.campaign.findFirst({
        where: { id, project: { orgId: ctx.orgId } },
      });
      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }
      return ctx.prisma.campaign.update({ where: { id }, data });
    }),

  delete: orgProtectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.campaign.findFirst({
        where: { id: input.id, project: { orgId: ctx.orgId } },
      });
      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }
      await ctx.prisma.campaign.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
