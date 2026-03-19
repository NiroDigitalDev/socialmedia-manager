import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, orgProtectedProcedure } from "../init";
import { deleteFromR2, fetchFromR2 } from "@/lib/r2";
import { geminiText } from "@/lib/gemini";

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

      // 7. Create RunConcept records + ImageVariation + CaptionVariation records
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
      }

      // 8. Return runId immediately — background generation is Task 4b
      return { runId: input.runId };
    }),
});
