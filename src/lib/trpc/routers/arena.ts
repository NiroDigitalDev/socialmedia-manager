import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, orgProtectedProcedure } from "../init";
import { deleteFromR2, uploadToR2 } from "@/lib/r2";
import {
  generateOutlines as aiGenerateOutlines,
  generateImageFromPrompt,
  PROMPTS,
  type ModelKey,
  type AspectRatio,
} from "@/lib/ai";
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

/** Retry an async function with exponential backoff */
async function withRetry<T>(fn: () => Promise<T>, retries = 2, baseDelay = 1000): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, attempt)));
    }
  }
  throw new Error("Unreachable");
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
        const superCount = arena.entries.filter((e) => e.rating === "super").length;
        const generatingCount = arena.entries.filter((e) => e.status === "generating").length;

        const { entries: _entries, ...rest } = arena;
        return {
          ...rest,
          entryStats: {
            total: totalEntries,
            up: upCount,
            super: superCount,
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

      // 5. Fetch brand context if brandIdentityId provided
      let brandContext = "";
      if (input.brandIdentityId) {
        const brand = await ctx.prisma.brandIdentity.findUnique({
          where: { id: input.brandIdentityId },
          include: { palettes: true },
        });
        if (brand) {
          const parts: string[] = [];
          if (brand.name) parts.push(`Brand: ${brand.name}`);
          if (brand.tagline) parts.push(`Tagline: "${brand.tagline}"`);
          if (brand.palettes.length > 0) {
            const palette = brand.palettes[0];
            parts.push(`Brand colors — Accent: ${palette.accentColor}, Background: ${palette.bgColor}`);
          }
          brandContext = parts.join(". ");
        }
      }

      // 6. Fire-and-forget background generation
      const limit = pLimit(5);

      void (async () => {
        // Group entries by style
        let entryIndex = 0;
        for (const styleId of input.imageStyleIds) {
          const styleEntryIds = entryIds.slice(entryIndex, entryIndex + input.countPerStyle);
          entryIndex += input.countPerStyle;

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

            // Generate images for each entry
            const jobs = styleEntryIds.map((entryId, i) =>
              limit(async () => {
                try {
                  // Cancellation check
                  const current = await ctx.prisma.labArenaEntry.findUnique({ where: { id: entryId } });
                  if (current?.status !== "generating") return;

                  // Use outline if available, otherwise use source text
                  const outline = i < outlines.length ? outlines[i] : outlines[outlines.length - 1];
                  const overallTheme = outline?.overallTheme ?? "";
                  const slides = outline?.slides ?? [];

                  const slidesText = slides
                    .map((s, idx) => {
                      return `Slide ${idx + 1}: ${s.title ?? ""} — ${s.description ?? ""}${s.layoutNotes ? ` (Layout: ${s.layoutNotes})` : ""}`;
                    })
                    .join("\n");

                  // Build image prompt
                  const promptParts = [
                    PROMPTS.images,
                    stylePrompt && `Visual style: ${stylePrompt}`,
                    overallTheme && `Theme: ${overallTheme}`,
                    slidesText && `Outline:\n${slidesText}`,
                    brandContext && `Brand context: ${brandContext}`,
                    input.countPerStyle > 1 && `Variation ${i + 1} of ${input.countPerStyle}: Make this visually distinct.`,
                  ].filter(Boolean);
                  const imagePrompt = promptParts.join("\n\n");

                  const imgResult = await withRetry(() =>
                    generateImageFromPrompt(
                      imagePrompt,
                      input.model as ModelKey,
                      input.aspectRatio as AspectRatio,
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
                } catch {
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
        }
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
});
