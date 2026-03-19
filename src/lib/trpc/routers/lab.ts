import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, orgProtectedProcedure } from "../init";
import { deleteFromR2 } from "@/lib/r2";

export const labRouter = router({
  listExperiments: orgProtectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const experiments = await ctx.prisma.experiment.findMany({
        where: {
          projectId: input.projectId,
          orgId: ctx.orgId,
        },
        include: {
          _count: { select: { runs: true } },
        },
        orderBy: { updatedAt: "desc" },
      });

      return experiments;
    }),

  getExperiment: orgProtectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const experiment = await ctx.prisma.experiment.findUnique({
        where: { id: input.id },
        include: {
          runs: {
            select: {
              id: true,
              runNumber: true,
              status: true,
              scope: true,
              parentRunId: true,
              createdAt: true,
            },
            orderBy: { runNumber: "desc" },
          },
        },
      });

      if (!experiment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Experiment not found" });
      }

      if (experiment.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      return experiment;
    }),

  createExperiment: orgProtectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        projectId: z.string(),
        brandIdentityId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const experiment = await ctx.prisma.experiment.create({
        data: {
          name: input.name,
          projectId: input.projectId,
          orgId: ctx.orgId,
          brandIdentityId: input.brandIdentityId ?? null,
        },
      });

      return experiment;
    }),

  updateExperiment: orgProtectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        brandIdentityId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const experiment = await ctx.prisma.experiment.findFirst({
        where: { id, orgId: ctx.orgId },
      });

      if (!experiment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Experiment not found" });
      }

      return ctx.prisma.experiment.update({ where: { id }, data });
    }),

  deleteExperiment: orgProtectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const experiment = await ctx.prisma.experiment.findFirst({
        where: { id: input.id, orgId: ctx.orgId },
      });

      if (!experiment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Experiment not found" });
      }

      // Collect all R2 keys from ImageVariations before cascade-deleting
      const imageVariations = await ctx.prisma.imageVariation.findMany({
        where: {
          concept: {
            run: {
              experimentId: input.id,
            },
          },
          r2Key: { not: null },
        },
        select: { r2Key: true },
      });

      const r2Keys = imageVariations
        .map((iv) => iv.r2Key)
        .filter((key): key is string => key !== null);

      // Delete experiment (cascades to runs → concepts → variations → exports)
      await ctx.prisma.experiment.delete({ where: { id: input.id } });

      // Batch-delete R2 objects — log failures as warnings, don't throw
      if (r2Keys.length > 0) {
        const results = await Promise.allSettled(
          r2Keys.map((key) => deleteFromR2(key))
        );

        const failures = results.filter((r) => r.status === "rejected");
        if (failures.length > 0) {
          console.warn(
            `[lab.deleteExperiment] Failed to delete ${failures.length}/${r2Keys.length} R2 objects for experiment ${input.id}`
          );
        }
      }

      return { success: true };
    }),
});
