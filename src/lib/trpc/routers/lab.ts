import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, orgProtectedProcedure } from "../init";
import { deleteFromR2, fetchFromR2, uploadToR2 } from "@/lib/r2";
import { geminiText, generateImage, type ModelKey, type AspectRatioKey } from "@/lib/gemini";

// ── Retry Helper ──────────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delays = [1000, 3000]): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, delays[attempt] ?? 3000));
    }
  }
  throw new Error("unreachable");
}

// ── Types ────────────────────────────────────────────────────────

interface SlideOutline {
  id: string;
  slideNumber: number;
  imagePrompt: string;
  layoutNotes: string;
}

interface ConceptOutline {
  slides: SlideOutline[];
  caption: string;
}

// ── Outline Generation Helper ────────────────────────────────────

async function generateOutlines(
  contentInput: { prompt?: string | null; ideaText?: string | null; sourceText?: string | null },
  conceptCount: number
): Promise<ConceptOutline[]> {
  const source =
    contentInput.prompt ||
    contentInput.ideaText ||
    contentInput.sourceText ||
    "Create an engaging Instagram post";

  const outlinePrompt = `You are a senior Instagram content strategist. Given the user's brief below, produce ${conceptCount} distinct Instagram post concepts.

USER BRIEF:
"""
${source}
"""

For EACH concept, produce:
- slides: an array of 1-5 slide objects, each with:
  - id: a unique short identifier (e.g., "s1", "s2")
  - slideNumber: integer starting at 1
  - imagePrompt: a detailed visual description for AI image generation (what the image should depict, composition, mood, colors)
  - layoutNotes: layout guidance (text placement, visual hierarchy, overlay instructions)
- caption: a compelling Instagram caption with relevant hashtags

OUTPUT: Return a JSON array of ${conceptCount} concept objects. No markdown fencing, no extra text.
Example: [{ "slides": [{ "id": "s1", "slideNumber": 1, "imagePrompt": "...", "layoutNotes": "..." }], "caption": "..." }]`;

  const text = await geminiText.generateContent(outlinePrompt);

  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      throw new Error("Expected array");
    }
    // Validate and normalize each concept
    return parsed.map((concept: Record<string, unknown>, i: number) => ({
      slides: Array.isArray(concept.slides)
        ? concept.slides.map((slide: Record<string, unknown>, j: number) => ({
            id: String(slide.id ?? `s${j + 1}`),
            slideNumber: Number(slide.slideNumber ?? j + 1),
            imagePrompt: String(slide.imagePrompt ?? ""),
            layoutNotes: String(slide.layoutNotes ?? ""),
          }))
        : [
            {
              id: "s1",
              slideNumber: 1,
              imagePrompt: String(concept.imagePrompt ?? ""),
              layoutNotes: String(concept.layoutNotes ?? ""),
            },
          ],
      caption: String(concept.caption ?? `Concept ${i + 1}`),
    }));
  } catch {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to parse outline from AI. Please try again.",
    });
  }
}

// ── Prompt Builder Helpers ───────────────────────────────────────

function buildImagePrompt(
  basePrompt: string,
  stylePromptText: string | null,
  colorOverride: { accent: string; bg: string } | null,
  brandColors: { accentColor: string; bgColor: string } | null,
  variationNumber: number,
  totalVariations: number,
  logoInstructions: string | null
): string {
  const parts: string[] = [basePrompt];

  if (stylePromptText) {
    parts.push(`VISUAL STYLE: ${stylePromptText}`);
  }

  if (colorOverride) {
    parts.push(
      `You MUST use these exact colors: Accent/Primary color: ${colorOverride.accent}, Background color: ${colorOverride.bg}. The accent color should be used for headlines, buttons, icons, and highlights. The background color should be the primary background of the design. These two colors must dominate the image.`
    );
  } else if (brandColors) {
    parts.push(
      `You MUST use these exact brand colors: Accent: ${brandColors.accentColor}, Background: ${brandColors.bgColor}. These colors should dominate the image.`
    );
  }

  if (totalVariations > 1) {
    parts.push(
      `Variation ${variationNumber} of ${totalVariations} — explore different compositions, angles, and lighting.`
    );
  }

  if (logoInstructions) {
    parts.push(logoInstructions);
  }

  return parts.join("\n\n");
}

function buildCaptionPrompt(
  baseCaptionText: string,
  captionStylePromptText: string | null,
  variationNumber: number,
  totalVariations: number
): string {
  const parts: string[] = [baseCaptionText];

  if (captionStylePromptText) {
    parts.push(`WRITING STYLE: ${captionStylePromptText}`);
  }

  parts.push("Write an Instagram caption. Include relevant hashtags.");

  if (totalVariations > 1) {
    parts.push(
      `Variation ${variationNumber} of ${totalVariations} — vary the tone, structure, and hook while keeping the core message.`
    );
  }

  return parts.join("\n\n");
}

// ── Schema ───────────────────────────────────────────────────────

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

  // ── Progress Polling ──────────────────────────────────────────

  runProgress: orgProtectedProcedure
    .input(z.object({ runId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify org ownership through run → experiment
      const run = await ctx.prisma.run.findUnique({
        where: { id: input.runId },
        include: { experiment: { select: { orgId: true } } },
      });

      if (!run || run.experiment.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
      }

      const concepts = await ctx.prisma.runConcept.findMany({
        where: { runId: input.runId },
        include: {
          imageVariations: { select: { status: true } },
          captionVariations: { select: { status: true } },
        },
        orderBy: { conceptNumber: "asc" },
      });

      return concepts.map((c) => ({
        conceptId: c.id,
        conceptNumber: c.conceptNumber,
        images: {
          generating: c.imageVariations.filter((v) => v.status === "generating").length,
          completed: c.imageVariations.filter((v) => v.status === "completed").length,
          failed: c.imageVariations.filter((v) => v.status === "failed").length,
        },
        captions: {
          generating: c.captionVariations.filter((v) => v.status === "generating").length,
          completed: c.captionVariations.filter((v) => v.status === "completed").length,
          failed: c.captionVariations.filter((v) => v.status === "failed").length,
        },
      }));
    }),

  // ── Rating ────────────────────────────────────────────────────

  rateImageVariation: orgProtectedProcedure
    .input(
      z.object({
        variationId: z.string(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify org ownership: variation → concept → run → experiment
      const variation = await ctx.prisma.imageVariation.findUnique({
        where: { id: input.variationId },
        include: {
          concept: {
            include: {
              run: {
                include: { experiment: { select: { orgId: true } } },
              },
            },
          },
        },
      });

      if (!variation || variation.concept.run.experiment.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Image variation not found" });
      }

      return ctx.prisma.imageVariation.update({
        where: { id: input.variationId },
        data: {
          rating: input.rating,
          ratingComment: input.comment ?? null,
        },
      });
    }),

  rateCaptionVariation: orgProtectedProcedure
    .input(
      z.object({
        variationId: z.string(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify org ownership: variation → concept → run → experiment
      const variation = await ctx.prisma.captionVariation.findUnique({
        where: { id: input.variationId },
        include: {
          concept: {
            include: {
              run: {
                include: { experiment: { select: { orgId: true } } },
              },
            },
          },
        },
      });

      if (!variation || variation.concept.run.experiment.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Caption variation not found" });
      }

      return ctx.prisma.captionVariation.update({
        where: { id: input.variationId },
        data: {
          rating: input.rating,
          ratingComment: input.comment ?? null,
        },
      });
    }),

  // ── Re-run (tweak) ───────────────────────────────────────────

  rerun: orgProtectedProcedure
    .input(
      z.object({
        sourceRunId: z.string(),
        scope: z.enum(["full", "batch", "single"]),
        tweaks: runSettingsSchema.partial(),
        sourceVariationId: z.string().optional(),
        sourceVariationType: z.enum(["image", "caption"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Fetch source run and verify org ownership
      const sourceRun = await ctx.prisma.run.findUnique({
        where: { id: input.sourceRunId },
        include: {
          experiment: {
            select: {
              orgId: true,
              id: true,
              brandIdentityId: true,
            },
          },
          concepts: {
            include: {
              imageVariations: true,
              captionVariations: true,
            },
            orderBy: { conceptNumber: "asc" },
          },
        },
      });

      if (!sourceRun || sourceRun.experiment.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Source run not found" });
      }

      // 2. Parse source settings and merge tweaks
      const sourceSettings = runSettingsSchema.parse(sourceRun.settingsSnapshot);
      const mergedSettings: RunSettingsSchema = {
        ...sourceSettings,
        ...input.tweaks,
        // Deep merge for colorOverride
        colorOverride:
          input.tweaks.colorOverride !== undefined
            ? input.tweaks.colorOverride
            : sourceSettings.colorOverride,
      };

      // 3. Auto-increment runNumber
      const lastRun = await ctx.prisma.run.findFirst({
        where: { experimentId: sourceRun.experimentId },
        orderBy: { runNumber: "desc" },
        select: { runNumber: true },
      });

      const runNumber = (lastRun?.runNumber ?? 0) + 1;

      // 4. Create new Run
      const newRun = await ctx.prisma.run.create({
        data: {
          experimentId: sourceRun.experimentId,
          orgId: ctx.orgId,
          runNumber,
          status: "generating",
          scope: input.scope,
          parentRunId: input.sourceRunId,
          settingsSnapshot: mergedSettings,
        },
      });

      // 5. Fetch styles and brand identity for prompt building
      const [imageStyle, captionStyle, brandIdentity] = await Promise.all([
        mergedSettings.imageStyleId
          ? ctx.prisma.style.findUnique({
              where: { id: mergedSettings.imageStyleId },
              select: { promptText: true },
            })
          : null,
        mergedSettings.captionStyleId
          ? ctx.prisma.style.findUnique({
              where: { id: mergedSettings.captionStyleId },
              select: { promptText: true },
            })
          : null,
        sourceRun.experiment.brandIdentityId
          ? ctx.prisma.brandIdentity.findUnique({
              where: { id: sourceRun.experiment.brandIdentityId },
              include: { palettes: { take: 1 } },
            })
          : null,
      ]);

      const brandColors =
        !mergedSettings.colorOverride && brandIdentity?.palettes?.[0]
          ? {
              accentColor: brandIdentity.palettes[0].accentColor,
              bgColor: brandIdentity.palettes[0].bgColor,
            }
          : null;

      // Resolve logo
      let logoInstructions: string | null = null;
      let referenceImages: { base64: string; mimeType: string }[] | undefined;
      if (brandIdentity?.logoAssetId) {
        const logoAsset = await ctx.prisma.asset.findUnique({
          where: { id: brandIdentity.logoAssetId },
          select: { r2Key: true },
        });
        if (logoAsset) {
          try {
            const { data: logoData, contentType } = await fetchFromR2(logoAsset.r2Key);
            referenceImages = [{ base64: logoData.toString("base64"), mimeType: contentType }];
            logoInstructions =
              "The brand has a logo. Incorporate the brand logo prominently but tastefully in the design (e.g., corner, header, or watermark position).";
          } catch {
            logoInstructions =
              "Include the brand logo prominently but tastefully in the design (e.g., corner, header, or watermark position).";
          }
        }
      }

      // 6. Create concept + variation records based on scope
      const createdConcepts: {
        id: string;
        imageVariations: { id: string; imagePrompt: string }[];
        captionVariations: { id: string; captionPrompt: string }[];
      }[] = [];

      if (input.scope === "single") {
        // Find the source variation's concept to copy
        if (!input.sourceVariationId || !input.sourceVariationType) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "sourceVariationId and sourceVariationType are required for single scope",
          });
        }

        let sourceConcept: (typeof sourceRun.concepts)[0] | undefined;
        if (input.sourceVariationType === "image") {
          sourceConcept = sourceRun.concepts.find((c) =>
            c.imageVariations.some((v) => v.id === input.sourceVariationId)
          );
        } else {
          sourceConcept = sourceRun.concepts.find((c) =>
            c.captionVariations.some((v) => v.id === input.sourceVariationId)
          );
        }

        if (!sourceConcept) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Source variation's concept not found" });
        }

        const concept = await ctx.prisma.runConcept.create({
          data: {
            runId: newRun.id,
            conceptNumber: 1,
            outline: sourceConcept.outline as object,
            imagePrompt: sourceConcept.imagePrompt,
            captionPrompt: sourceConcept.captionPrompt,
          },
        });

        if (input.sourceVariationType === "image") {
          const sourceVar = sourceConcept.imageVariations.find(
            (v) => v.id === input.sourceVariationId
          )!;
          await ctx.prisma.imageVariation.create({
            data: {
              conceptId: concept.id,
              variationNumber: 1,
              imagePrompt: buildImagePrompt(
                sourceVar.imagePrompt,
                imageStyle?.promptText ?? null,
                mergedSettings.colorOverride,
                brandColors,
                1,
                1,
                logoInstructions
              ),
              status: "generating",
            },
          });
        } else {
          const sourceVar = sourceConcept.captionVariations.find(
            (v) => v.id === input.sourceVariationId
          )!;
          await ctx.prisma.captionVariation.create({
            data: {
              conceptId: concept.id,
              variationNumber: 1,
              captionPrompt: buildCaptionPrompt(
                sourceVar.captionPrompt,
                captionStyle?.promptText ?? null,
                1,
                1
              ),
              status: "generating",
            },
          });
        }

        const [imgVars, capVars] = await Promise.all([
          ctx.prisma.imageVariation.findMany({
            where: { conceptId: concept.id },
            select: { id: true, imagePrompt: true },
            orderBy: { variationNumber: "asc" },
          }),
          ctx.prisma.captionVariation.findMany({
            where: { conceptId: concept.id },
            select: { id: true, captionPrompt: true },
            orderBy: { variationNumber: "asc" },
          }),
        ]);

        createdConcepts.push({
          id: concept.id,
          imageVariations: imgVars,
          captionVariations: capVars,
        });
      } else if (input.scope === "batch") {
        // Batch: create 1 concept with M images or K captions
        if (!input.sourceVariationId || !input.sourceVariationType) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "sourceVariationId and sourceVariationType are required for batch scope",
          });
        }

        let sourceConcept: (typeof sourceRun.concepts)[0] | undefined;
        if (input.sourceVariationType === "image") {
          sourceConcept = sourceRun.concepts.find((c) =>
            c.imageVariations.some((v) => v.id === input.sourceVariationId)
          );
        } else {
          sourceConcept = sourceRun.concepts.find((c) =>
            c.captionVariations.some((v) => v.id === input.sourceVariationId)
          );
        }

        if (!sourceConcept) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Source variation's concept not found" });
        }

        const concept = await ctx.prisma.runConcept.create({
          data: {
            runId: newRun.id,
            conceptNumber: 1,
            outline: sourceConcept.outline as object,
            imagePrompt: sourceConcept.imagePrompt,
            captionPrompt: sourceConcept.captionPrompt,
          },
        });

        if (input.sourceVariationType === "image") {
          const variationData = Array.from(
            { length: mergedSettings.imageVariations },
            (_, v) => ({
              conceptId: concept.id,
              variationNumber: v + 1,
              imagePrompt: buildImagePrompt(
                sourceConcept!.imagePrompt,
                imageStyle?.promptText ?? null,
                mergedSettings.colorOverride,
                brandColors,
                v + 1,
                mergedSettings.imageVariations,
                logoInstructions
              ),
              status: "generating" as const,
            })
          );
          await ctx.prisma.imageVariation.createMany({ data: variationData });
        } else {
          const variationData = Array.from(
            { length: mergedSettings.captionVariations },
            (_, v) => ({
              conceptId: concept.id,
              variationNumber: v + 1,
              captionPrompt: buildCaptionPrompt(
                sourceConcept!.captionPrompt,
                captionStyle?.promptText ?? null,
                v + 1,
                mergedSettings.captionVariations
              ),
              status: "generating" as const,
            })
          );
          await ctx.prisma.captionVariation.createMany({ data: variationData });
        }

        const [imgVars, capVars] = await Promise.all([
          ctx.prisma.imageVariation.findMany({
            where: { conceptId: concept.id },
            select: { id: true, imagePrompt: true },
            orderBy: { variationNumber: "asc" },
          }),
          ctx.prisma.captionVariation.findMany({
            where: { conceptId: concept.id },
            select: { id: true, captionPrompt: true },
            orderBy: { variationNumber: "asc" },
          }),
        ]);

        createdConcepts.push({
          id: concept.id,
          imageVariations: imgVars,
          captionVariations: capVars,
        });
      } else {
        // scope === "full": generate new outlines and create all records (like startGeneration)
        let contentInput: { prompt?: string | null; ideaText?: string | null; sourceText?: string | null } = {
          prompt: mergedSettings.contentPrompt,
        };

        if (mergedSettings.contentIdeaId) {
          const idea = await ctx.prisma.contentIdea.findUnique({
            where: { id: mergedSettings.contentIdeaId },
            select: { ideaText: true },
          });
          if (idea) {
            contentInput = { ...contentInput, ideaText: idea.ideaText };
          }
        }

        if (mergedSettings.contentSourceId) {
          const source = await ctx.prisma.contentSource.findUnique({
            where: { id: mergedSettings.contentSourceId },
            select: { rawText: true },
          });
          if (source) {
            contentInput = { ...contentInput, sourceText: source.rawText };
          }
        }

        const outlines = await generateOutlines(contentInput, mergedSettings.conceptCount);

        for (let c = 0; c < outlines.length; c++) {
          const outline = outlines[c];
          const conceptNumber = c + 1;

          const representativeImagePrompt = outline.slides
            .map(
              (slide) =>
                `[Slide ${slide.slideNumber}] ${slide.imagePrompt}${slide.layoutNotes ? ` | Layout: ${slide.layoutNotes}` : ""}`
            )
            .join("\n");

          const resolvedImagePrompt = buildImagePrompt(
            representativeImagePrompt,
            imageStyle?.promptText ?? null,
            mergedSettings.colorOverride,
            brandColors,
            1,
            1,
            logoInstructions
          );

          const resolvedCaptionPrompt = buildCaptionPrompt(
            outline.caption,
            captionStyle?.promptText ?? null,
            1,
            1
          );

          const concept = await ctx.prisma.runConcept.create({
            data: {
              runId: newRun.id,
              conceptNumber,
              outline: JSON.parse(JSON.stringify(outline)),
              imagePrompt: resolvedImagePrompt,
              captionPrompt: resolvedCaptionPrompt,
            },
          });

          const imageVariationData = Array.from(
            { length: mergedSettings.imageVariations },
            (_, v) => ({
              conceptId: concept.id,
              variationNumber: v + 1,
              imagePrompt: buildImagePrompt(
                representativeImagePrompt,
                imageStyle?.promptText ?? null,
                mergedSettings.colorOverride,
                brandColors,
                v + 1,
                mergedSettings.imageVariations,
                logoInstructions
              ),
              status: "generating" as const,
            })
          );

          await ctx.prisma.imageVariation.createMany({ data: imageVariationData });

          const captionVariationData = Array.from(
            { length: mergedSettings.captionVariations },
            (_, v) => ({
              conceptId: concept.id,
              variationNumber: v + 1,
              captionPrompt: buildCaptionPrompt(
                outline.caption,
                captionStyle?.promptText ?? null,
                v + 1,
                mergedSettings.captionVariations
              ),
              status: "generating" as const,
            })
          );

          await ctx.prisma.captionVariation.createMany({ data: captionVariationData });

          const [imgVars, capVars] = await Promise.all([
            ctx.prisma.imageVariation.findMany({
              where: { conceptId: concept.id },
              select: { id: true, imagePrompt: true },
              orderBy: { variationNumber: "asc" },
            }),
            ctx.prisma.captionVariation.findMany({
              where: { conceptId: concept.id },
              select: { id: true, captionPrompt: true },
              orderBy: { variationNumber: "asc" },
            }),
          ]);

          createdConcepts.push({
            id: concept.id,
            imageVariations: imgVars,
            captionVariations: capVars,
          });
        }
      }

      // 7. Fire-and-forget background generation (same pattern as startGeneration)
      const runId = newRun.id;
      const model = mergedSettings.model as ModelKey;
      const aspectRatio = mergedSettings.aspectRatio as AspectRatioKey;

      void (async () => {
        const pLimit = (await import("p-limit")).default;
        const imageLimit = pLimit(5);
        const captionLimit = pLimit(10);

        const allJobs: Promise<void>[] = [];

        for (const concept of createdConcepts) {
          for (const imgVar of concept.imageVariations) {
            allJobs.push(
              imageLimit(async () => {
                const currentRun = await ctx.prisma.run.findUnique({
                  where: { id: runId },
                  select: { status: true },
                });
                if (currentRun?.status === "cancelled") return;

                try {
                  await withRetry(async () => {
                    const result = await generateImage(
                      imgVar.imagePrompt,
                      model,
                      aspectRatio,
                      referenceImages
                    );
                    const buffer = Buffer.from(result.base64, "base64");
                    const r2Key = `lab/${imgVar.id}/original.${result.mimeType === "image/png" ? "png" : "webp"}`;
                    await uploadToR2(r2Key, buffer, result.mimeType);
                    await ctx.prisma.imageVariation.update({
                      where: { id: imgVar.id },
                      data: { status: "completed", r2Key, mimeType: result.mimeType },
                    });
                  });
                } catch {
                  await ctx.prisma.imageVariation.update({
                    where: { id: imgVar.id },
                    data: { status: "failed" },
                  });
                }
              })
            );
          }

          for (const capVar of concept.captionVariations) {
            allJobs.push(
              captionLimit(async () => {
                const currentRun = await ctx.prisma.run.findUnique({
                  where: { id: runId },
                  select: { status: true },
                });
                if (currentRun?.status === "cancelled") return;

                try {
                  await withRetry(async () => {
                    const text = await geminiText.generateContent(capVar.captionPrompt);
                    await ctx.prisma.captionVariation.update({
                      where: { id: capVar.id },
                      data: { status: "completed", text },
                    });
                  });
                } catch {
                  await ctx.prisma.captionVariation.update({
                    where: { id: capVar.id },
                    data: { status: "failed" },
                  });
                }
              })
            );
          }
        }

        await Promise.allSettled(allJobs);

        const finalRun = await ctx.prisma.run.findUnique({
          where: { id: runId },
          select: { status: true },
        });
        if (finalRun?.status === "cancelled") return;

        const allVariations = await ctx.prisma.imageVariation.findMany({
          where: { concept: { runId } },
          select: { status: true },
        });
        const allCaptions = await ctx.prisma.captionVariation.findMany({
          where: { concept: { runId } },
          select: { status: true },
        });
        const all = [...allVariations, ...allCaptions];
        const allFailed = all.every((v) => v.status === "failed");

        await ctx.prisma.run.update({
          where: { id: runId },
          data: { status: allFailed ? "failed" : "completed" },
        });
      })();

      return { runId: newRun.id, runNumber: newRun.runNumber };
    }),

  // ── Retry Single Variation ────────────────────────────────────

  retryVariation: orgProtectedProcedure
    .input(
      z.object({
        variationId: z.string(),
        type: z.enum(["image", "caption"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.type === "image") {
        // Verify ownership and fetch variation
        const variation = await ctx.prisma.imageVariation.findUnique({
          where: { id: input.variationId },
          include: {
            concept: {
              include: {
                run: {
                  include: {
                    experiment: {
                      select: { orgId: true, brandIdentityId: true },
                    },
                  },
                },
              },
            },
          },
        });

        if (!variation || variation.concept.run.experiment.orgId !== ctx.orgId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Image variation not found" });
        }

        if (variation.status !== "failed") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Only failed variations can be retried",
          });
        }

        // Reset status to generating
        await ctx.prisma.imageVariation.update({
          where: { id: input.variationId },
          data: { status: "generating", r2Key: null, mimeType: null },
        });

        // Parse run settings for model and aspect ratio
        const settings = runSettingsSchema.parse(variation.concept.run.settingsSnapshot);
        const model = settings.model as ModelKey;
        const aspectRatio = settings.aspectRatio as AspectRatioKey;

        // Fetch logo reference images if brand has a logo
        let referenceImages: { base64: string; mimeType: string }[] | undefined;
        if (variation.concept.run.experiment.brandIdentityId) {
          const brand = await ctx.prisma.brandIdentity.findUnique({
            where: { id: variation.concept.run.experiment.brandIdentityId },
            select: { logoAssetId: true },
          });
          if (brand?.logoAssetId) {
            const logoAsset = await ctx.prisma.asset.findUnique({
              where: { id: brand.logoAssetId },
              select: { r2Key: true },
            });
            if (logoAsset) {
              try {
                const { data: logoData, contentType } = await fetchFromR2(logoAsset.r2Key);
                referenceImages = [{ base64: logoData.toString("base64"), mimeType: contentType }];
              } catch {
                // continue without logo
              }
            }
          }
        }

        // Run generation inline (not fire-and-forget since it's just one)
        try {
          await withRetry(async () => {
            const result = await generateImage(
              variation.imagePrompt,
              model,
              aspectRatio,
              referenceImages
            );
            const buffer = Buffer.from(result.base64, "base64");
            const r2Key = `lab/${variation.id}/original.${result.mimeType === "image/png" ? "png" : "webp"}`;
            await uploadToR2(r2Key, buffer, result.mimeType);
            await ctx.prisma.imageVariation.update({
              where: { id: variation.id },
              data: { status: "completed", r2Key, mimeType: result.mimeType },
            });
          });
        } catch {
          await ctx.prisma.imageVariation.update({
            where: { id: variation.id },
            data: { status: "failed" },
          });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Image generation failed after retries",
          });
        }

        return ctx.prisma.imageVariation.findUnique({
          where: { id: input.variationId },
          select: {
            id: true,
            variationNumber: true,
            status: true,
            r2Key: true,
            mimeType: true,
            rating: true,
            ratingComment: true,
          },
        });
      } else {
        // Caption retry
        const variation = await ctx.prisma.captionVariation.findUnique({
          where: { id: input.variationId },
          include: {
            concept: {
              include: {
                run: {
                  include: {
                    experiment: { select: { orgId: true } },
                  },
                },
              },
            },
          },
        });

        if (!variation || variation.concept.run.experiment.orgId !== ctx.orgId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Caption variation not found" });
        }

        if (variation.status !== "failed") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Only failed variations can be retried",
          });
        }

        // Reset status to generating
        await ctx.prisma.captionVariation.update({
          where: { id: input.variationId },
          data: { status: "generating", text: null },
        });

        // Run generation inline
        try {
          await withRetry(async () => {
            const text = await geminiText.generateContent(variation.captionPrompt);
            await ctx.prisma.captionVariation.update({
              where: { id: variation.id },
              data: { status: "completed", text },
            });
          });
        } catch {
          await ctx.prisma.captionVariation.update({
            where: { id: variation.id },
            data: { status: "failed" },
          });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Caption generation failed after retries",
          });
        }

        return ctx.prisma.captionVariation.findUnique({
          where: { id: input.variationId },
          select: {
            id: true,
            variationNumber: true,
            status: true,
            text: true,
            rating: true,
            ratingComment: true,
          },
        });
      }
    }),

  // ── Start Generation (record creation only) ────────────────────

  startGeneration: orgProtectedProcedure
    .input(z.object({ runId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // 1. Verify run belongs to org, status is configuring
      const run = await ctx.prisma.run.findUnique({
        where: { id: input.runId },
        include: {
          experiment: {
            select: {
              orgId: true,
              brandIdentityId: true,
            },
          },
        },
      });

      if (!run || run.experiment.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
      }

      if (run.status !== "configuring") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Run must be in configuring status to start generation",
        });
      }

      // 2. Parse settings
      const settings = runSettingsSchema.parse(run.settingsSnapshot);

      // 3. Fetch referenced styles and brand identity
      const [imageStyle, captionStyle, brandIdentity] = await Promise.all([
        settings.imageStyleId
          ? ctx.prisma.style.findUnique({
              where: { id: settings.imageStyleId },
              select: { promptText: true },
            })
          : null,
        settings.captionStyleId
          ? ctx.prisma.style.findUnique({
              where: { id: settings.captionStyleId },
              select: { promptText: true },
            })
          : null,
        run.experiment.brandIdentityId
          ? ctx.prisma.brandIdentity.findUnique({
              where: { id: run.experiment.brandIdentityId },
              include: {
                palettes: { take: 1 },
              },
            })
          : null,
      ]);

      // Resolve brand colors — colorOverride takes precedence, then palette
      const brandColors =
        !settings.colorOverride && brandIdentity?.palettes?.[0]
          ? {
              accentColor: brandIdentity.palettes[0].accentColor,
              bgColor: brandIdentity.palettes[0].bgColor,
            }
          : null;

      // Resolve logo instructions
      let logoInstructions: string | null = null;
      if (brandIdentity?.logoAssetId) {
        const logoAsset = await ctx.prisma.asset.findUnique({
          where: { id: brandIdentity.logoAssetId },
          select: { r2Key: true },
        });
        if (logoAsset) {
          try {
            await fetchFromR2(logoAsset.r2Key);
            logoInstructions =
              "The brand has a logo. Incorporate the brand logo prominently but tastefully in the design (e.g., corner, header, or watermark position).";
          } catch {
            logoInstructions =
              "Include the brand logo prominently but tastefully in the design (e.g., corner, header, or watermark position).";
          }
        }
      }

      // 4. Set run status to generating
      await ctx.prisma.run.update({
        where: { id: input.runId },
        data: { status: "generating" },
      });

      // 5. Build content input for outline generation
      let contentInput: { prompt?: string | null; ideaText?: string | null; sourceText?: string | null } = {
        prompt: settings.contentPrompt,
      };

      if (settings.contentIdeaId) {
        const idea = await ctx.prisma.contentIdea.findUnique({
          where: { id: settings.contentIdeaId },
          select: { ideaText: true },
        });
        if (idea) {
          contentInput = { ...contentInput, ideaText: idea.ideaText };
        }
      }

      if (settings.contentSourceId) {
        const source = await ctx.prisma.contentSource.findUnique({
          where: { id: settings.contentSourceId },
          select: { rawText: true },
        });
        if (source) {
          contentInput = { ...contentInput, sourceText: source.rawText };
        }
      }

      // 6. Generate N outlines
      const outlines = await generateOutlines(contentInput, settings.conceptCount);

      // 7. Fetch logo reference images for image generation (if brand has a logo)
      let referenceImages: { base64: string; mimeType: string }[] | undefined;
      if (brandIdentity?.logoAssetId) {
        const logoAsset = await ctx.prisma.asset.findUnique({
          where: { id: brandIdentity.logoAssetId },
          select: { r2Key: true },
        });
        if (logoAsset) {
          try {
            const { data: logoData, contentType } = await fetchFromR2(logoAsset.r2Key);
            referenceImages = [{ base64: logoData.toString("base64"), mimeType: contentType }];
          } catch {
            // R2 fetch failed — continue without logo reference
          }
        }
      }

      // 8. Create RunConcept records + ImageVariation + CaptionVariation records
      const createdConcepts: {
        id: string;
        imageVariations: { id: string; imagePrompt: string }[];
        captionVariations: { id: string; captionPrompt: string }[];
      }[] = [];

      for (let c = 0; c < outlines.length; c++) {
        const outline = outlines[c];
        const conceptNumber = c + 1;

        // Build the resolved image prompt for this concept (using first slide as representative)
        const representativeImagePrompt = outline.slides
          .map(
            (slide) =>
              `[Slide ${slide.slideNumber}] ${slide.imagePrompt}${slide.layoutNotes ? ` | Layout: ${slide.layoutNotes}` : ""}`
          )
          .join("\n");

        const resolvedImagePrompt = buildImagePrompt(
          representativeImagePrompt,
          imageStyle?.promptText ?? null,
          settings.colorOverride,
          brandColors,
          1, // concept-level prompt, variations diverge below
          1,
          logoInstructions
        );

        const resolvedCaptionPrompt = buildCaptionPrompt(
          outline.caption,
          captionStyle?.promptText ?? null,
          1,
          1
        );

        const concept = await ctx.prisma.runConcept.create({
          data: {
            runId: input.runId,
            conceptNumber,
            outline: JSON.parse(JSON.stringify(outline)),
            imagePrompt: resolvedImagePrompt,
            captionPrompt: resolvedCaptionPrompt,
          },
        });

        // Create M ImageVariation records
        const imageVariationData = Array.from(
          { length: settings.imageVariations },
          (_, v) => ({
            conceptId: concept.id,
            variationNumber: v + 1,
            imagePrompt: buildImagePrompt(
              representativeImagePrompt,
              imageStyle?.promptText ?? null,
              settings.colorOverride,
              brandColors,
              v + 1,
              settings.imageVariations,
              logoInstructions
            ),
            status: "generating" as const,
          })
        );

        await ctx.prisma.imageVariation.createMany({
          data: imageVariationData,
        });

        // Create K CaptionVariation records
        const captionVariationData = Array.from(
          { length: settings.captionVariations },
          (_, v) => ({
            conceptId: concept.id,
            variationNumber: v + 1,
            captionPrompt: buildCaptionPrompt(
              outline.caption,
              captionStyle?.promptText ?? null,
              v + 1,
              settings.captionVariations
            ),
            status: "generating" as const,
          })
        );

        await ctx.prisma.captionVariation.createMany({
          data: captionVariationData,
        });

        // Fetch back the created variations so we have their IDs and prompts
        const [imgVars, capVars] = await Promise.all([
          ctx.prisma.imageVariation.findMany({
            where: { conceptId: concept.id },
            select: { id: true, imagePrompt: true },
            orderBy: { variationNumber: "asc" },
          }),
          ctx.prisma.captionVariation.findMany({
            where: { conceptId: concept.id },
            select: { id: true, captionPrompt: true },
            orderBy: { variationNumber: "asc" },
          }),
        ]);

        createdConcepts.push({
          id: concept.id,
          imageVariations: imgVars,
          captionVariations: capVars,
        });
      }

      // 9. Capture values for the background closure
      const runId = input.runId;
      const model = settings.model as ModelKey;
      const aspectRatio = settings.aspectRatio as AspectRatioKey;

      // 10. Fire-and-forget background generation
      void (async () => {
        const pLimit = (await import("p-limit")).default;
        const imageLimit = pLimit(5);   // max 5 parallel image gen calls
        const captionLimit = pLimit(10); // max 10 parallel caption calls

        const allJobs: Promise<void>[] = [];

        for (const concept of createdConcepts) {
          // Image variations
          for (const imgVar of concept.imageVariations) {
            allJobs.push(imageLimit(async () => {
              // Check cancellation before each job
              const currentRun = await ctx.prisma.run.findUnique({ where: { id: runId }, select: { status: true } });
              if (currentRun?.status === "cancelled") return;

              try {
                await withRetry(async () => {
                  const result = await generateImage(imgVar.imagePrompt, model, aspectRatio, referenceImages);
                  const buffer = Buffer.from(result.base64, "base64");
                  const r2Key = `lab/${imgVar.id}/original.${result.mimeType === "image/png" ? "png" : "webp"}`;
                  await uploadToR2(r2Key, buffer, result.mimeType);
                  await ctx.prisma.imageVariation.update({
                    where: { id: imgVar.id },
                    data: { status: "completed", r2Key, mimeType: result.mimeType },
                  });
                });
              } catch {
                await ctx.prisma.imageVariation.update({
                  where: { id: imgVar.id },
                  data: { status: "failed" },
                });
              }
            }));
          }

          // Caption variations
          for (const capVar of concept.captionVariations) {
            allJobs.push(captionLimit(async () => {
              const currentRun = await ctx.prisma.run.findUnique({ where: { id: runId }, select: { status: true } });
              if (currentRun?.status === "cancelled") return;

              try {
                await withRetry(async () => {
                  const text = await geminiText.generateContent(capVar.captionPrompt);
                  await ctx.prisma.captionVariation.update({
                    where: { id: capVar.id },
                    data: { status: "completed", text },
                  });
                });
              } catch {
                await ctx.prisma.captionVariation.update({
                  where: { id: capVar.id },
                  data: { status: "failed" },
                });
              }
            }));
          }
        }

        await Promise.allSettled(allJobs);

        // Final status update (skip if cancelled)
        const finalRun = await ctx.prisma.run.findUnique({ where: { id: runId }, select: { status: true } });
        if (finalRun?.status === "cancelled") return;

        const allVariations = await ctx.prisma.imageVariation.findMany({
          where: { concept: { runId } }, select: { status: true },
        });
        const allCaptions = await ctx.prisma.captionVariation.findMany({
          where: { concept: { runId } }, select: { status: true },
        });
        const all = [...allVariations, ...allCaptions];
        const allFailed = all.every(v => v.status === "failed");

        await ctx.prisma.run.update({
          where: { id: runId },
          data: { status: allFailed ? "failed" : "completed" },
        });
      })();

      // 11. Return runId immediately
      return { runId: input.runId };
    }),

  // ── Export to Gallery ──────────────────────────────────────────

  exportToGallery: orgProtectedProcedure
    .input(
      z.object({
        exports: z.array(
          z.object({
            conceptId: z.string(),
            imageVariationId: z.string(),
            captionVariationId: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const postIds: string[] = [];

      for (const entry of input.exports) {
        // 1. Fetch the concept and verify it belongs to a run owned by this org
        const concept = await ctx.prisma.runConcept.findUnique({
          where: { id: entry.conceptId },
          include: {
            run: {
              include: {
                experiment: {
                  select: { orgId: true, projectId: true },
                },
              },
            },
          },
        });

        if (!concept || concept.run.experiment.orgId !== ctx.orgId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Concept ${entry.conceptId} not found or access denied`,
          });
        }

        // 2. Verify imageVariationId belongs to this concept
        const imageVariation = await ctx.prisma.imageVariation.findUnique({
          where: { id: entry.imageVariationId },
          select: { id: true, conceptId: true, r2Key: true, mimeType: true },
        });

        if (!imageVariation || imageVariation.conceptId !== entry.conceptId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Image variation ${entry.imageVariationId} does not belong to concept ${entry.conceptId}`,
          });
        }

        // 3. Verify captionVariationId belongs to this concept
        const captionVariation = await ctx.prisma.captionVariation.findUnique({
          where: { id: entry.captionVariationId },
          select: { id: true, conceptId: true, text: true },
        });

        if (!captionVariation || captionVariation.conceptId !== entry.conceptId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Caption variation ${entry.captionVariationId} does not belong to concept ${entry.conceptId}`,
          });
        }

        if (!imageVariation.r2Key) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Image variation ${entry.imageVariationId} has no generated image (missing r2Key)`,
          });
        }

        if (!captionVariation.text) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Caption variation ${entry.captionVariationId} has no generated text`,
          });
        }

        // 4. Parse run settings to get model/aspectRatio for the GeneratedPost
        const settings = runSettingsSchema.parse(concept.run.settingsSnapshot);

        // 5. Create GeneratedPost
        const post = await ctx.prisma.generatedPost.create({
          data: {
            prompt: concept.imagePrompt,
            format: "carousel",
            aspectRatio: settings.aspectRatio,
            model: settings.model,
            status: "completed",
            description: captionVariation.text,
            platform: "instagram",
            orgId: ctx.orgId,
            projectId: concept.run.experiment.projectId,
          },
        });

        // 6. Create GeneratedImage pointing to the Lab image via r2Key
        await ctx.prisma.generatedImage.create({
          data: {
            postId: post.id,
            slideNumber: 1,
            r2Key: imageVariation.r2Key,
            mimeType: imageVariation.mimeType ?? "image/png",
          },
        });

        // 7. Create RunExport record
        await ctx.prisma.runExport.create({
          data: {
            runId: concept.runId,
            conceptId: entry.conceptId,
            imageVariationId: entry.imageVariationId,
            captionVariationId: entry.captionVariationId,
            generatedPostId: post.id,
          },
        });

        postIds.push(post.id);
      }

      return { postIds };
    }),
});
