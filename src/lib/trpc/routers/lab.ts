import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, orgProtectedProcedure } from "../init";
import { deleteFromR2 } from "@/lib/r2";

const runSettingsSchema = z.object({
  contentPrompt: z.string().nullable(),
  contentIdeaId: z.string().nullable(),
  contentSourceId: z.string().nullable(),
  assetIds: z.array(z.string()),
  imageStyleId: z.string().nullable(),
  captionStyleId: z.string().nullable(),
  model: z.enum(["nano-banana-2", "nano-banana-pro"]),
  aspectRatio: z.enum(["3:4", "1:1", "4:5", "9:16"]),
  colorOverride: z
    .object({ accent: z.string(), bg: z.string() })
    .nullable(),
  conceptCount: z.number().int().min(1).max(20),
  imageVariations: z.number().int().min(1).max(20),
  captionVariations: z.number().int().min(1).max(20),
});

export type RunSettingsSchema = z.infer<typeof runSettingsSchema>;

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

  // ── Run procedures ──────────────────────────────────────────────

  createRun: orgProtectedProcedure
    .input(
      z.object({
        experimentId: z.string(),
        settingsSnapshot: runSettingsSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify experiment belongs to org
      const experiment = await ctx.prisma.experiment.findFirst({
        where: { id: input.experimentId, orgId: ctx.orgId },
      });

      if (!experiment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Experiment not found" });
      }

      // Auto-increment runNumber
      const lastRun = await ctx.prisma.run.findFirst({
        where: { experimentId: input.experimentId },
        orderBy: { runNumber: "desc" },
        select: { runNumber: true },
      });

      const runNumber = (lastRun?.runNumber ?? 0) + 1;

      const run = await ctx.prisma.run.create({
        data: {
          experimentId: input.experimentId,
          orgId: ctx.orgId,
          runNumber,
          status: "configuring",
          scope: "full",
          settingsSnapshot: input.settingsSnapshot,
        },
      });

      return run;
    }),

  updateRunSettings: orgProtectedProcedure
    .input(
      z.object({
        runId: z.string(),
        settingsSnapshot: runSettingsSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const run = await ctx.prisma.run.findUnique({
        where: { id: input.runId },
        include: { experiment: { select: { orgId: true } } },
      });

      if (!run || run.experiment.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
      }

      if (run.status !== "configuring") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Settings can only be updated while run is in configuring status",
        });
      }

      return ctx.prisma.run.update({
        where: { id: input.runId },
        data: { settingsSnapshot: input.settingsSnapshot },
      });
    }),

  getRun: orgProtectedProcedure
    .input(z.object({ runId: z.string() }))
    .query(async ({ ctx, input }) => {
      const run = await ctx.prisma.run.findUnique({
        where: { id: input.runId },
        include: {
          experiment: { select: { orgId: true } },
          concepts: {
            include: {
              imageVariations: {
                select: {
                  id: true,
                  variationNumber: true,
                  status: true,
                  r2Key: true,
                  mimeType: true,
                  rating: true,
                  ratingComment: true,
                },
              },
              captionVariations: {
                select: {
                  id: true,
                  variationNumber: true,
                  status: true,
                  text: true,
                  rating: true,
                  ratingComment: true,
                },
              },
            },
            orderBy: { conceptNumber: "asc" },
          },
        },
      });

      if (!run || run.experiment.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
      }

      // Strip the nested experiment from the response
      const { experiment: _experiment, ...runData } = run;
      return runData;
    }),

  getRunConcepts: orgProtectedProcedure
    .input(
      z.object({
        runId: z.string(),
        conceptId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify org ownership through experiment
      const run = await ctx.prisma.run.findUnique({
        where: { id: input.runId },
        include: { experiment: { select: { orgId: true } } },
      });

      if (!run || run.experiment.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
      }

      // Single concept with all variations
      if (input.conceptId) {
        const concept = await ctx.prisma.runConcept.findUnique({
          where: { id: input.conceptId },
          include: {
            imageVariations: {
              select: {
                id: true,
                variationNumber: true,
                status: true,
                r2Key: true,
                mimeType: true,
                rating: true,
                ratingComment: true,
              },
              orderBy: { variationNumber: "asc" },
            },
            captionVariations: {
              select: {
                id: true,
                variationNumber: true,
                status: true,
                text: true,
                rating: true,
                ratingComment: true,
              },
              orderBy: { variationNumber: "asc" },
            },
          },
        });

        if (!concept || concept.runId !== input.runId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Concept not found" });
        }

        return { type: "single" as const, concept };
      }

      // All concepts with variation counts only
      const concepts = await ctx.prisma.runConcept.findMany({
        where: { runId: input.runId },
        include: {
          _count: {
            select: {
              imageVariations: true,
              captionVariations: true,
            },
          },
        },
        orderBy: { conceptNumber: "asc" },
      });

      return { type: "list" as const, concepts };
    }),

  deleteRun: orgProtectedProcedure
    .input(z.object({ runId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const run = await ctx.prisma.run.findUnique({
        where: { id: input.runId },
        include: { experiment: { select: { orgId: true } } },
      });

      if (!run || run.experiment.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
      }

      // Collect all R2 keys from ImageVariations before cascade-deleting
      const imageVariations = await ctx.prisma.imageVariation.findMany({
        where: {
          concept: { runId: input.runId },
          r2Key: { not: null },
        },
        select: { r2Key: true },
      });

      const r2Keys = imageVariations
        .map((iv) => iv.r2Key)
        .filter((key): key is string => key !== null);

      // Delete run (cascades to concepts → variations → exports)
      await ctx.prisma.run.delete({ where: { id: input.runId } });

      // Batch-delete R2 objects — log failures as warnings, don't throw
      if (r2Keys.length > 0) {
        const results = await Promise.allSettled(
          r2Keys.map((key) => deleteFromR2(key))
        );

        const failures = results.filter((r) => r.status === "rejected");
        if (failures.length > 0) {
          console.warn(
            `[lab.deleteRun] Failed to delete ${failures.length}/${r2Keys.length} R2 objects for run ${input.runId}`
          );
        }
      }

      return { success: true };
    }),

  cancelRun: orgProtectedProcedure
    .input(z.object({ runId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const run = await ctx.prisma.run.findUnique({
        where: { id: input.runId },
        include: { experiment: { select: { orgId: true } } },
      });

      if (!run || run.experiment.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
      }

      return ctx.prisma.run.update({
        where: { id: input.runId },
        data: { status: "cancelled" },
      });
    }),
});
