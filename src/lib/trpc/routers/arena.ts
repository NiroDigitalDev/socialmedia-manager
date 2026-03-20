import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, orgProtectedProcedure } from "../init";
import { deleteFromR2 } from "@/lib/r2";

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

// suppress unused warning — withRetry is kept for future generation procedures in Tasks 3-7
void withRetry;

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
