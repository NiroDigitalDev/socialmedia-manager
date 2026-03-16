import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, orgProtectedProcedure } from "../init";

export const projectRouter = router({
  list: orgProtectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.project.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { campaigns: true, posts: true },
        },
      },
    });
  }),

  get: orgProtectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.id, orgId: ctx.orgId },
        include: {
          _count: {
            select: {
              campaigns: true,
              brandIdentities: true,
              contentSources: true,
              posts: true,
              assets: true,
            },
          },
        },
      });
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      return project;
    }),

  create: orgProtectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.project.create({
        data: { ...input, orgId: ctx.orgId },
      });
    }),

  update: orgProtectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const project = await ctx.prisma.project.findFirst({
        where: { id, orgId: ctx.orgId },
      });
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      return ctx.prisma.project.update({ where: { id }, data });
    }),

  delete: orgProtectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.id, orgId: ctx.orgId },
      });
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      await ctx.prisma.project.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
