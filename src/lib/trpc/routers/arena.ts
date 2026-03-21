import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, orgProtectedProcedure } from "../init";
import { deleteFromR2, uploadToR2 } from "@/lib/r2";
import {
  generateOutlines as aiGenerateOutlines,
  generateImageFromPrompt,
  analyzeFeedback,
  refineImagePrompt,
  refineOutlinePrompt,
  generateArenaCaption,
  PROMPTS,
  type ModelKey,
  type AspectRatio,
  type StyleLearnings,
  type ReferenceImage,
} from "@/lib/ai";
import { fetchFromR2 } from "@/lib/r2";
import pLimit from "p-limit";

// ── Helpers ─────────────────────────────────────────────────────

/** Collect all non-null r2Keys from a set of entries */
function collectR2Keys(items: { r2Key: string | null }[]): string[] {
  return items
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

/** Check if an error is a rate limit (429 / RESOURCE_EXHAUSTED) */
function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("resource_exhausted") || msg.includes("429") || msg.includes("rate limit") || msg.includes("quota");
  }
  return false;
}

/** Retry an async function with exponential backoff, longer delays for rate limits */
async function withRetry<T>(fn: () => Promise<T>, retries = 3, baseDelay = 1000): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === retries) throw error;
      // Rate limits get longer backoff (10s, 20s, 40s) vs normal errors (1s, 2s, 4s)
      const delay = isRateLimitError(error)
        ? 10000 * Math.pow(2, attempt)
        : baseDelay * Math.pow(2, attempt);
      console.warn(`[arena] Retry ${attempt + 1}/${retries} after ${delay}ms${isRateLimitError(error) ? " (rate limit)" : ""}:`, error instanceof Error ? error.message : error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("Unreachable");
}

/** Convert hex color to a human-readable description (prevents Gemini from rendering hex text) */
function describeColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Simple hue-based naming
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2 / 255;

  if (max - min < 20) {
    if (lightness > 0.85) return "white";
    if (lightness < 0.15) return "near-black dark";
    return "gray";
  }

  let hue = 0;
  const d = max - min;
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) hue = ((b - r) / d + 2) * 60;
  else hue = ((r - g) / d + 4) * 60;

  const prefix = lightness > 0.7 ? "light " : lightness < 0.3 ? "dark " : "";
  if (hue < 15 || hue >= 345) return `${prefix}red`;
  if (hue < 45) return `${prefix}orange`;
  if (hue < 70) return `${prefix}yellow`;
  if (hue < 160) return `${prefix}green`;
  if (hue < 200) return `${prefix}cyan`;
  if (hue < 260) return `${prefix}blue`;
  if (hue < 300) return `${prefix}purple`;
  return `${prefix}pink`;
}

interface BrandContextResult {
  text: string;
  logoData?: { data: Buffer; mimeType: string };
}

/** Build brand context for image generation prompts, including logo if available */
async function buildBrandContext(
  prisma: import("@/generated/prisma/client").PrismaClient,
  brandIdentityId: string | null | undefined,
): Promise<BrandContextResult> {
  if (!brandIdentityId) return { text: "" };

  const brand = await prisma.brandIdentity.findUnique({
    where: { id: brandIdentityId },
    include: { palettes: true },
  });
  if (!brand) return { text: "" };

  const parts: string[] = [];
  if (brand.name) parts.push(`Brand name: ${brand.name} (include once at most, never repeat)`);
  if (brand.tagline) parts.push(`Brand tagline: "${brand.tagline}" (include at most once if relevant)`);
  if (brand.palettes.length > 0) {
    const palette = brand.palettes[0];
    const accent = describeColor(palette.accentColor);
    const bg = describeColor(palette.bgColor);
    parts.push(`Brand color palette: use ${accent} as the accent/highlight color and ${bg} as the background/base color. Apply these colors visually — do NOT write color codes or names as text`);
  }

  // Fetch logo if available
  let logoData: BrandContextResult["logoData"] = undefined;
  if (brand.logoAssetId) {
    try {
      const asset = await prisma.asset.findUnique({ where: { id: brand.logoAssetId }, select: { r2Key: true, mimeType: true } });
      if (asset?.r2Key) {
        const fetched = await fetchFromR2(asset.r2Key);
        logoData = { data: fetched.data, mimeType: fetched.contentType };
        parts.push("A brand logo image is attached — reference its visual style and incorporate it naturally if appropriate. Do NOT distort or heavily modify the logo");
      }
    } catch {
      // Logo fetch failed, continue without it
    }
  }

  return { text: parts.join(". "), logoData };
}

/** Build a content-focused user prompt from an outline, using new schema fields when available */
function buildOutlineContentPrompt(outline: {
  format?: string;
  overallTheme?: string;
  headline?: string;
  supportingText?: string;
  textPlacement?: string;
  visualDirection?: string;
  slides?: Array<{ title?: string; description?: string; layoutNotes?: string }>;
}): string {
  const parts: string[] = [];

  if (outline.format) parts.push(`Content format: ${outline.format}`);
  if (outline.overallTheme) parts.push(`Theme: ${outline.overallTheme}`);

  // Prefer new fields, fall back to slides
  if (outline.headline) {
    parts.push(`Headline text (render this prominently): "${outline.headline}"`);
    if (outline.supportingText) {
      parts.push(`Supporting text (render smaller, secondary): "${outline.supportingText}"`);
    }
    if (outline.textPlacement) parts.push(`Text placement: ${outline.textPlacement}`);
    if (outline.visualDirection) parts.push(`Visual direction: ${outline.visualDirection}`);
  } else if (outline.slides && outline.slides.length > 0) {
    // Legacy fallback
    const s = outline.slides[0];
    if (s.title) parts.push(`Headline: "${s.title}"`);
    if (s.description) parts.push(`Description: ${s.description}`);
    if (s.layoutNotes) parts.push(`Layout: ${s.layoutNotes}`);
  }

  return parts.join("\n");
}

// ── Router ──────────────────────────────────────────────────────

export const arenaRouter = router({
  listArenas: orgProtectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const arenas = await ctx.prisma.labArena.findMany({
        where: {
          projectId: input.projectId,
          orgId: ctx.orgId,
        },
        include: {
          _count: { select: { rounds: true } },
          entries: {
            select: { rating: true, status: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      return arenas.map((arena) => {
        const totalEntries = arena.entries.length;
        const upCount = arena.entries.filter((e) => e.rating === "up").length;
        const generatingCount = arena.entries.filter((e) => e.status === "generating").length;

        const { entries: _entries, ...rest } = arena;
        return {
          ...rest,
          entryStats: {
            total: totalEntries,
            up: upCount,
            generating: generatingCount,
          },
        };
      });
    }),

  getArena: orgProtectedProcedure
    .input(z.object({ arenaId: z.string() }))
    .query(async ({ ctx, input }) => {
      const arena = await ctx.prisma.labArena.findUnique({
        where: { id: input.arenaId },
        include: {
          rounds: {
            orderBy: { roundNumber: "asc" },
            include: {
              entries: true,
            },
          },
          entries: true,
        },
      });

      if (!arena) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Arena not found" });
      }

      if (arena.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      return arena;
    }),

  arenaProgress: orgProtectedProcedure
    .input(z.object({ arenaId: z.string() }))
    .query(async ({ ctx, input }) => {
      const arena = await ctx.prisma.labArena.findFirst({
        where: { id: input.arenaId, orgId: ctx.orgId },
      });

      if (!arena) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Arena not found" });
      }

      // Stale generation cleanup: mark entries stuck generating >5min as failed
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      await ctx.prisma.labArenaEntry.updateMany({
        where: {
          arenaId: input.arenaId,
          status: "generating",
          updatedAt: { lt: fiveMinutesAgo },
        },
        data: { status: "failed" },
      });

      const fiveSecondsAgo = new Date(Date.now() - 5000);

      const entries = await ctx.prisma.labArenaEntry.findMany({
        where: {
          arenaId: input.arenaId,
          OR: [
            { status: "generating" },
            { updatedAt: { gte: fiveSecondsAgo } },
          ],
        },
        select: {
          id: true,
          status: true,
          r2Key: true,
          rating: true,
          updatedAt: true,
        },
      });

      return entries;
    }),

  deleteArena: orgProtectedProcedure
    .input(z.object({ arenaId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const arena = await ctx.prisma.labArena.findFirst({
        where: { id: input.arenaId, orgId: ctx.orgId },
      });

      if (!arena) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Arena not found" });
      }

      // Collect all R2 keys from entries before cascade-deleting
      const entries = await ctx.prisma.labArenaEntry.findMany({
        where: { arenaId: input.arenaId, r2Key: { not: null } },
        select: { r2Key: true },
      });

      const r2Keys = collectR2Keys(entries);

      // Delete arena (cascades to all rounds and entries)
      await ctx.prisma.labArena.delete({ where: { id: input.arenaId } });

      // Batch-delete R2 objects
      await batchDeleteR2(r2Keys, "arena.deleteArena");

      return { success: true };
    }),

  createArena: orgProtectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        projectId: z.string(),
        sourceText: z.string().min(1),
        imageStyleIds: z.array(z.string()).min(1).max(20),
        countPerStyle: z.number().min(1).max(50).default(10),
        aspectRatio: z.enum(["1:1", "3:4", "4:5", "9:16"]).default("1:1"),
        model: z.enum(["nano-banana-2", "nano-banana-pro"]).default("nano-banana-2"),
        brandIdentityId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Create the arena record
      const arena = await ctx.prisma.labArena.create({
        data: {
          name: input.name,
          projectId: input.projectId,
          orgId: ctx.orgId,
          sourceText: input.sourceText,
          imageStyleIds: input.imageStyleIds,
          brandIdentityId: input.brandIdentityId ?? null,
          aspectRatio: input.aspectRatio,
          model: input.model,
        },
      });

      // 2. Create round 1
      const round = await ctx.prisma.labArenaRound.create({
        data: {
          arenaId: arena.id,
          roundNumber: 1,
        },
      });

      // 3. Create entries for each style x countPerStyle
      const entryIds: string[] = [];
      for (const styleId of input.imageStyleIds) {
        for (let i = 0; i < input.countPerStyle; i++) {
          const entry = await ctx.prisma.labArenaEntry.create({
            data: {
              arenaId: arena.id,
              roundId: round.id,
              imageStyleId: styleId,
              status: "generating",
              orgId: ctx.orgId,
            },
          });
          entryIds.push(entry.id);
        }
      }

      // 4. Return immediately
      const result = { arenaId: arena.id, roundId: round.id, entryIds };

      // 5. Fetch brand context
      const brandContext = await buildBrandContext(ctx.prisma, input.brandIdentityId);

      // 6. Fire-and-forget background generation
      const limit = pLimit(3);

      void (async () => {
        // Process all styles in parallel — outlines first, then images via shared pLimit
        let entryIndex = 0;
        const styleJobs = input.imageStyleIds.map((styleId) => {
          const styleEntryIds = entryIds.slice(entryIndex, entryIndex + input.countPerStyle);
          entryIndex += input.countPerStyle;

          return (async () => {
            try {
              // Fetch style promptText
              const style = await ctx.prisma.style.findUnique({
                where: { id: styleId },
                select: { promptText: true },
              });
              const stylePrompt = style?.promptText ?? "";

              // Generate outlines for this style — one per entry
              const outlinePromptParts = [
                input.sourceText,
                stylePrompt && `Visual style direction: ${stylePrompt}. Design the outline to work well with this aesthetic.`,
              ].filter(Boolean);
              const outlinePrompt = outlinePromptParts.join("\n\n");

              const outlines = await withRetry(() =>
                aiGenerateOutlines(outlinePrompt, input.countPerStyle),
              );

              // Generate images for each entry — all styles share the same pLimit
              const jobs = styleEntryIds.map((entryId, i) =>
                limit(async () => {
                try {
                  // Cancellation check
                  const current = await ctx.prisma.labArenaEntry.findUnique({ where: { id: entryId } });
                  if (current?.status !== "generating") return;

                  // Use outline if available, otherwise use source text
                  const outline = i < outlines.length ? outlines[i] : outlines[outlines.length - 1];

                  // Build content prompt (user prompt) from outline
                  const outlineContent = outline ? buildOutlineContentPrompt(outline) : "";

                  // User prompt = content + style + brand (what to create)
                  const userPromptParts = [
                    stylePrompt && `Visual style: ${stylePrompt}`,
                    outlineContent,
                    brandContext.text && `Brand context: ${brandContext.text}`,
                    input.countPerStyle > 1 && `Create a unique visual interpretation. Use different composition, layout angles, or emphasis — but do NOT write any variation numbers or meta-text in the image.`,
                  ].filter(Boolean);
                  const imagePrompt = userPromptParts.join("\n\n");

                  // Build reference images (brand logo)
                  const refImages: ReferenceImage[] = [];
                  if (brandContext.logoData) {
                    refImages.push(brandContext.logoData);
                  }

                  const imgResult = await withRetry(() =>
                    generateImageFromPrompt(
                      imagePrompt,
                      input.model as ModelKey,
                      input.aspectRatio as AspectRatio,
                      refImages.length > 0 ? refImages : undefined,
                      PROMPTS.images, // System prompt: design principles + rules
                    ),
                  );

                  // Upload to R2
                  const ext = imgResult.mimeType.split("/")[1] || "png";
                  const r2Key = `arena/${entryId}/original.${ext}`;
                  const imageBuffer = Buffer.from(imgResult.base64, "base64");
                  await uploadToR2(r2Key, imageBuffer, imgResult.mimeType);

                  // Update entry
                  await ctx.prisma.labArenaEntry.update({
                    where: { id: entryId },
                    data: {
                      status: "completed",
                      r2Key,
                      mimeType: imgResult.mimeType,
                      outlineContent: outline as object,
                      systemPrompt: PROMPTS.images,
                      contentPrompt: imagePrompt,
                    },
                  });
                } catch (err) {
                  console.error(`[arena] Image generation failed for entry ${entryId}:`, err instanceof Error ? err.message : err);
                  try {
                    await ctx.prisma.labArenaEntry.update({
                      where: { id: entryId },
                      data: { status: "failed" },
                    });
                  } catch {
                    // Ignore — entry may have been deleted
                  }
                }
              })
            );

              await Promise.allSettled(jobs);
            } catch (err) {
              // If outline generation fails for this style, mark all its entries as failed
              console.error(`[arena.createArena] Outline generation failed for style ${styleId}:`, err);
              for (const entryId of styleEntryIds) {
                try {
                  await ctx.prisma.labArenaEntry.update({
                    where: { id: entryId },
                    data: { status: "failed" },
                  });
                } catch {
                  // Ignore
                }
              }
            }
          })();
        });

        // All styles process in parallel
        await Promise.allSettled(styleJobs);
      })();

      return result;
    }),

  completeArena: orgProtectedProcedure
    .input(z.object({ arenaId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const arena = await ctx.prisma.labArena.findFirst({
        where: { id: input.arenaId, orgId: ctx.orgId },
      });

      if (!arena) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Arena not found" });
      }

      return ctx.prisma.labArena.update({
        where: { id: input.arenaId },
        data: { status: "completed" },
      });
    }),

  rateEntry: orgProtectedProcedure
    .input(
      z.object({
        entryId: z.string(),
        rating: z.enum(["up", "down"]),
        tags: z.array(z.string()).optional(),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.prisma.labArenaEntry.findUnique({
        where: { id: input.entryId },
        include: { arena: true },
      });

      if (!entry) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Entry not found" });
      }

      if (entry.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      if (input.rating === "up") {
        return ctx.prisma.labArenaEntry.update({
          where: { id: input.entryId },
          data: { rating: "up", ratingTags: [], ratingComment: null },
        });
      }

      // rating === "down"
      return ctx.prisma.labArenaEntry.update({
        where: { id: input.entryId },
        data: {
          rating: "down",
          ratingTags: input.tags ?? [],
          ratingComment: input.comment ?? null,
        },
      });
    }),

  generateNextRound: orgProtectedProcedure
    .input(
      z.object({
        arenaId: z.string(),
        previousRoundId: z.string(),
        styles: z
          .array(
            z.object({
              styleId: z.string(),
              count: z.number().min(1).max(50),
            })
          )
          .min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Fetch arena + previous round, verify org
      const arena = await ctx.prisma.labArena.findUnique({
        where: { id: input.arenaId },
      });

      if (!arena) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Arena not found" });
      }
      if (arena.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      const previousRound = await ctx.prisma.labArenaRound.findUnique({
        where: { id: input.previousRoundId },
      });

      if (!previousRound || previousRound.arenaId !== input.arenaId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Previous round not found",
        });
      }

      // 2. For each continuing style, collect all entries across ALL rounds and analyze feedback
      const learningsMap: Record<string, StyleLearnings> = {};

      for (const { styleId } of input.styles) {
        const allEntries = await ctx.prisma.labArenaEntry.findMany({
          where: {
            arenaId: input.arenaId,
            imageStyleId: styleId,
            rating: { not: null },
          },
          select: {
            rating: true,
            ratingTags: true,
            ratingComment: true,
            contentPrompt: true,
            outlineContent: true,
          },
        });

        if (allEntries.length > 0) {
          const style = await ctx.prisma.style.findUnique({
            where: { id: styleId },
            select: { name: true, promptText: true },
          });

          const feedbackEntries = allEntries
            .filter((e): e is typeof e & { rating: "up" | "down" } =>
              e.rating === "up" || e.rating === "down"
            )
            .map((e) => ({
              rating: e.rating,
              ratingTags: e.ratingTags,
              ratingComment: e.ratingComment,
              contentPrompt: e.contentPrompt,
              outlineContent: e.outlineContent,
            }));

          learningsMap[styleId] = await analyzeFeedback(
            style?.name ?? "Unknown",
            style?.promptText ?? "",
            feedbackEntries,
          );
        } else {
          learningsMap[styleId] = {
            keepContent: [],
            keepStyle: [],
            avoidContent: [],
            avoidStyle: [],
            summary: "No rated entries yet.",
          };
        }
      }

      // 2b. Refine prompts for each style (parallel)
      interface RefinedPrompts {
        refinedOutlinePrompt: string;
        refinedImagePrompt: string;
      }
      const refinedPromptsMap: Record<string, RefinedPrompts> = {};

      await Promise.all(
        input.styles.map(async ({ styleId, count }) => {
          const learnings = learningsMap[styleId];

          // Get previous round's refined prompts (or defaults)
          const prevLearnings = previousRound.learnings as Record<string, Record<string, unknown>> | null;
          const prevStyleLearnings = prevLearnings?.[styleId];
          const previousOutlinePrompt =
            (prevStyleLearnings?.refinedOutlinePrompt as string) ?? PROMPTS.outlines(count);
          const previousImagePrompt =
            (prevStyleLearnings?.refinedImagePrompt as string) ?? PROMPTS.images;

          // Fetch positive examples (all thumbs-up across all rounds)
          const positiveEntries = await ctx.prisma.labArenaEntry.findMany({
            where: {
              arenaId: input.arenaId,
              imageStyleId: styleId,
              rating: "up",
            },
            select: { contentPrompt: true, outlineContent: true },
          });

          const positiveOutlines = positiveEntries
            .map((e) => e.outlineContent as { overallTheme: string; slides: Array<{ title: string; description: string; layoutNotes?: string }> } | null)
            .filter((o): o is NonNullable<typeof o> => o !== null);

          const positivePrompts = positiveEntries
            .map((e) => e.contentPrompt)
            .filter((p): p is string => p !== null);

          // Rewrite both prompts in parallel (anchor against originals to prevent drift)
          const [refinedOutline, refinedImage] = await Promise.all([
            withRetry(() =>
              refineOutlinePrompt(
                previousOutlinePrompt,
                {
                  keepContent: learnings.keepContent,
                  avoidContent: learnings.avoidContent,
                  contentDirectives: learnings.contentDirectives,
                },
                positiveOutlines,
                PROMPTS.outlines(count),
              )
            ).catch(() => previousOutlinePrompt),
            withRetry(() =>
              refineImagePrompt(
                previousImagePrompt,
                {
                  keepStyle: learnings.keepStyle,
                  avoidStyle: learnings.avoidStyle,
                  styleDirectives: learnings.styleDirectives,
                },
                positivePrompts,
                PROMPTS.images,
              )
            ).catch(() => previousImagePrompt),
          ]);

          refinedPromptsMap[styleId] = {
            refinedOutlinePrompt: refinedOutline,
            refinedImagePrompt: refinedImage,
          };
        }),
      );

      // Merge refined prompts into learningsMap for storage
      for (const { styleId } of input.styles) {
        (learningsMap[styleId] as Record<string, unknown>).refinedOutlinePrompt =
          refinedPromptsMap[styleId].refinedOutlinePrompt;
        (learningsMap[styleId] as Record<string, unknown>).refinedImagePrompt =
          refinedPromptsMap[styleId].refinedImagePrompt;
      }

      // 3. Create new round
      const newRound = await ctx.prisma.labArenaRound.create({
        data: {
          arenaId: input.arenaId,
          roundNumber: previousRound.roundNumber + 1,
          learnings: learningsMap as object,
        },
      });

      // 4. Create entries with status: "generating"
      const entryIds: string[] = [];
      const styleEntryMap: Record<string, string[]> = {};

      for (const { styleId, count } of input.styles) {
        styleEntryMap[styleId] = [];
        for (let i = 0; i < count; i++) {
          const entry = await ctx.prisma.labArenaEntry.create({
            data: {
              arenaId: input.arenaId,
              roundId: newRound.id,
              imageStyleId: styleId,
              status: "generating",
              orgId: ctx.orgId,
            },
          });
          entryIds.push(entry.id);
          styleEntryMap[styleId].push(entry.id);
        }
      }

      // 5. Return immediately
      const result = {
        roundId: newRound.id,
        entryIds,
        learnings: learningsMap,
      };

      // 6. Fetch brand context
      const brandContext = await buildBrandContext(ctx.prisma, arena.brandIdentityId);

      // 7. Fire-and-forget background generation with learnings
      const limit = pLimit(3);

      void (async () => {
        const styleJobs = input.styles.map(({ styleId, count }) => {
          const currentStyleEntryIds = styleEntryMap[styleId];
          const learnings = learningsMap[styleId];

          return (async () => {

          try {
            // Fetch style promptText
            const style = await ctx.prisma.style.findUnique({
              where: { id: styleId },
              select: { promptText: true },
            });
            const stylePrompt = style?.promptText ?? "";

            const refinedOutline = refinedPromptsMap[styleId].refinedOutlinePrompt;
            const outlineUserPrompt = [
              arena.sourceText,
              stylePrompt &&
                `Visual style direction: ${stylePrompt}. Design the outline to work well with this aesthetic.`,
            ]
              .filter(Boolean)
              .join("\n\n");

            const outlines = await withRetry(() =>
              aiGenerateOutlines(outlineUserPrompt, count, refinedOutline)
            );

            // Generate images for each entry
            const jobs = currentStyleEntryIds.map((entryId, i) =>
              limit(async () => {
                try {
                  // Cancellation check
                  const current =
                    await ctx.prisma.labArenaEntry.findUnique({
                      where: { id: entryId },
                    });
                  if (current?.status !== "generating") return;

                  // Use outline if available
                  const outline =
                    i < outlines.length
                      ? outlines[i]
                      : outlines[outlines.length - 1];

                  // Build content prompt from outline
                  const outlineContent = outline ? buildOutlineContentPrompt(outline) : "";

                  // Refined image prompt = system prompt (design rules evolved by feedback)
                  const refinedImage = refinedPromptsMap[styleId].refinedImagePrompt;

                  // User prompt = content + style + brand
                  const userPromptParts = [
                    stylePrompt && `Visual style: ${stylePrompt}`,
                    outlineContent,
                    brandContext.text && `Brand context: ${brandContext.text}`,
                    count > 1 &&
                      `Create a unique visual interpretation. Use different composition, layout angles, or emphasis — but do NOT write any variation numbers or meta-text in the image.`,
                  ].filter(Boolean);
                  const imagePrompt = userPromptParts.join("\n\n");

                  // Build reference images (brand logo)
                  const refImages: ReferenceImage[] = [];
                  if (brandContext.logoData) {
                    refImages.push(brandContext.logoData);
                  }

                  const imgResult = await withRetry(() =>
                    generateImageFromPrompt(
                      imagePrompt,
                      arena.model as ModelKey,
                      arena.aspectRatio as AspectRatio,
                      refImages.length > 0 ? refImages : undefined,
                      refinedImage, // System prompt: refined design rules
                    )
                  );

                  // Upload to R2
                  const ext = imgResult.mimeType.split("/")[1] || "png";
                  const r2Key = `arena/${entryId}/original.${ext}`;
                  const imageBuffer = Buffer.from(imgResult.base64, "base64");
                  await uploadToR2(r2Key, imageBuffer, imgResult.mimeType);

                  // Update entry
                  await ctx.prisma.labArenaEntry.update({
                    where: { id: entryId },
                    data: {
                      status: "completed",
                      r2Key,
                      mimeType: imgResult.mimeType,
                      outlineContent: outline as object,
                      systemPrompt: refinedImage,
                      contentPrompt: imagePrompt,
                    },
                  });
                } catch (err) {
                  console.error(`[arena] Image generation failed for entry ${entryId}:`, err instanceof Error ? err.message : err);
                  try {
                    await ctx.prisma.labArenaEntry.update({
                      where: { id: entryId },
                      data: { status: "failed" },
                    });
                  } catch {
                    // Ignore — entry may have been deleted
                  }
                }
              })
            );

              await Promise.allSettled(jobs);
            } catch (err) {
              // If outline generation fails for this style, mark all its entries as failed
              console.error(
                `[arena.generateNextRound] Outline generation failed for style ${styleId}:`,
                err
              );
              for (const entryId of currentStyleEntryIds) {
                try {
                  await ctx.prisma.labArenaEntry.update({
                    where: { id: entryId },
                    data: { status: "failed" },
                  });
                } catch {
                  // Ignore
                }
              }
            }
          })();
        });

        // All styles process in parallel
        await Promise.allSettled(styleJobs);
      })();

      return result;
    }),

  getSwipeQueue: orgProtectedProcedure
    .input(z.object({ roundId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify round belongs to an arena the user has access to
      const round = await ctx.prisma.labArenaRound.findUnique({
        where: { id: input.roundId },
        include: { arena: true },
      });

      if (!round) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Round not found" });
      }
      if (round.arena.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      const entries = await ctx.prisma.labArenaEntry.findMany({
        where: {
          roundId: input.roundId,
          status: "completed",
          rating: null,
        },
        orderBy: { createdAt: "asc" },
      });

      return entries;
    }),

  getRoundResults: orgProtectedProcedure
    .input(z.object({ roundId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify round belongs to an arena the user has access to
      const round = await ctx.prisma.labArenaRound.findUnique({
        where: { id: input.roundId },
        include: { arena: true },
      });

      if (!round) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Round not found" });
      }
      if (round.arena.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      // Fetch all entries for this round
      const entries = await ctx.prisma.labArenaEntry.findMany({
        where: { roundId: input.roundId },
        orderBy: { createdAt: "asc" },
      });

      // Group by imageStyleId
      const styleGroups: Record<
        string,
        typeof entries
      > = {};
      for (const entry of entries) {
        if (!styleGroups[entry.imageStyleId]) {
          styleGroups[entry.imageStyleId] = [];
        }
        styleGroups[entry.imageStyleId].push(entry);
      }

      // Fetch style names
      const styleIds = Object.keys(styleGroups);
      const styles = await ctx.prisma.style.findMany({
        where: { id: { in: styleIds } },
        select: { id: true, name: true },
      });
      const styleNameMap: Record<string, string> = {};
      for (const s of styles) {
        styleNameMap[s.id] = s.name;
      }

      // Build results per style
      const styleResults = styleIds.map((styleId) => {
        const styleEntries = styleGroups[styleId];
        const up = styleEntries.filter((e) => e.rating === "up").length;
        const down = styleEntries.filter((e) => e.rating === "down").length;
        const total = styleEntries.length;
        const rated = up + down;

        return {
          styleId,
          styleName: styleNameMap[styleId] ?? "Unknown",
          total,
          up,
          down,
          ratio: rated > 0 ? up / rated : 0,
          entries: styleEntries,
        };
      });

      return {
        styles: styleResults,
        learnings: (round.learnings ?? {}) as Record<string, StyleLearnings>,
      };
    }),

  // ── Export, Captions, Style Saving ────────────────────────────

  exportWinners: orgProtectedProcedure
    .input(
      z.object({
        arenaId: z.string(),
        entryIds: z.array(z.string()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const arena = await ctx.prisma.labArena.findFirst({
        where: { id: input.arenaId, orgId: ctx.orgId },
      });

      if (!arena) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Arena not found" });
      }

      const entries = await ctx.prisma.labArenaEntry.findMany({
        where: {
          id: { in: input.entryIds },
          arenaId: input.arenaId,
        },
      });

      const exported: string[] = [];

      for (const entry of entries) {
        // Skip if already exported
        if (entry.exportedPostId) continue;

        // Only export up-rated entries
        if (entry.rating !== "up") continue;

        // Determine description: use selected caption if available, else contentPrompt
        let description: string | null = null;
        if (entry.captions && Array.isArray(entry.captions)) {
          const selected = (entry.captions as Array<{ text: string; selected: boolean }>).find(
            (c) => c.selected
          );
          if (selected) {
            description = selected.text;
          }
        }

        const generatedPost = await ctx.prisma.generatedPost.create({
          data: {
            prompt: entry.contentPrompt ?? "",
            description: description ?? undefined,
            format: "static",
            aspectRatio: arena.aspectRatio,
            model: "arena-export",
            status: "completed",
            platform: "instagram",
            orgId: ctx.orgId,
            projectId: arena.projectId ?? null,
          },
        });

        await ctx.prisma.generatedImage.create({
          data: {
            postId: generatedPost.id,
            slideNumber: 1,
            r2Key: entry.r2Key,
            mimeType: entry.mimeType ?? "image/png",
          },
        });

        await ctx.prisma.labArenaEntry.update({
          where: { id: entry.id },
          data: { exportedPostId: generatedPost.id },
        });

        exported.push(entry.id);
      }

      return { exported };
    }),

  generateCaptions: orgProtectedProcedure
    .input(
      z.object({
        entryIds: z.array(z.string()).min(1),
        captionStyleId: z.string(),
        countPerImage: z.number().min(1).max(10).default(3),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch all entries and verify ownership
      const entries = await ctx.prisma.labArenaEntry.findMany({
        where: {
          id: { in: input.entryIds },
          orgId: ctx.orgId,
          status: "completed",
          r2Key: { not: null },
        },
        include: { arena: true },
      });

      if (entries.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No valid entries found",
        });
      }

      const limit = pLimit(3);
      const results: Record<string, Array<{ text: string; selected: boolean }>> = {};

      const jobs = entries.map((entry) =>
        limit(async () => {
          // Build outline context from entry data
          const outlineContext = entry.contentPrompt ?? entry.arena.sourceText;

          // Generate countPerImage captions in parallel
          const captionJobs = Array.from({ length: input.countPerImage }, () =>
            generateArenaCaption(
              outlineContext,
              entry.r2Key!,
              ctx.orgId,
              input.captionStyleId,
              { prisma: ctx.prisma, fetchFromR2 },
            )
          );

          const captionResults = await Promise.allSettled(captionJobs);

          const captions = captionResults
            .filter(
              (r): r is PromiseFulfilledResult<{ caption: string; hashtags: string[] }> =>
                r.status === "fulfilled"
            )
            .map((r) => ({
              text: r.value.hashtags.length > 0
                ? `${r.value.caption}\n\n${r.value.hashtags.map((h) => `#${h}`).join(" ")}`
                : r.value.caption,
              selected: false,
            }));

          // Update entry with captions
          await ctx.prisma.labArenaEntry.update({
            where: { id: entry.id },
            data: {
              captions: captions as object,
              captionStyleId: input.captionStyleId,
            },
          });

          results[entry.id] = captions;
        })
      );

      await Promise.allSettled(jobs);

      return { results };
    }),

  selectCaption: orgProtectedProcedure
    .input(
      z.object({
        entryId: z.string(),
        captionIndex: z.number().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.prisma.labArenaEntry.findFirst({
        where: { id: input.entryId, orgId: ctx.orgId },
      });

      if (!entry) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Entry not found" });
      }

      if (!entry.captions || !Array.isArray(entry.captions)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Entry has no captions",
        });
      }

      const captions = entry.captions as Array<{ text: string; selected: boolean }>;

      if (input.captionIndex >= captions.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Caption index out of range",
        });
      }

      const updated = captions.map((c, i) => ({
        ...c,
        selected: i === input.captionIndex,
      }));

      await ctx.prisma.labArenaEntry.update({
        where: { id: input.entryId },
        data: { captions: updated as object },
      });

      return { success: true };
    }),

  saveRefinedStyle: orgProtectedProcedure
    .input(
      z.object({
        arenaId: z.string(),
        styleId: z.string(),
        name: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const arena = await ctx.prisma.labArena.findFirst({
        where: { id: input.arenaId, orgId: ctx.orgId },
      });

      if (!arena) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Arena not found" });
      }

      const originalStyle = await ctx.prisma.style.findUnique({
        where: { id: input.styleId },
      });

      if (!originalStyle) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Style not found" });
      }

      // Get the latest round's refined image prompt for this style
      const latestRound = await ctx.prisma.labArenaRound.findFirst({
        where: { arenaId: input.arenaId },
        orderBy: { roundNumber: "desc" },
        select: { learnings: true },
      });

      const roundLearnings = latestRound?.learnings as Record<
        string,
        Record<string, unknown>
      > | null;
      const refinedImagePrompt = roundLearnings?.[input.styleId]
        ?.refinedImagePrompt as string | undefined;

      // Use the refined prompt directly, or fall back to original if no refinement exists
      const newPromptText = refinedImagePrompt ?? originalStyle.promptText;

      const newStyle = await ctx.prisma.style.create({
        data: {
          name: input.name ?? `${originalStyle.name} (Arena-refined)`,
          promptText: newPromptText,
          kind: "image",
          parentStyleIds: [input.styleId],
          orgId: ctx.orgId,
        },
      });

      return newStyle;
    }),
});
