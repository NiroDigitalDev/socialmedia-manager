# Arena Prompt Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the append-based learnings injection with AI-powered prompt rewrites between rounds, and simplify the rating system to binary thumbs up/down with expanded rejection tags.

**Architecture:** Two new AI refine functions produce clean, evolved prompts each round. The `generateNextRound` mutation calls them after feedback analysis, stores refined prompts on the round's learnings JSON, and uses them directly for generation. The rating system drops scores and "super" in favor of binary up/down with tag-based rejection feedback.

**Tech Stack:** tRPC v11, Prisma (Json fields), Vercel AI SDK (`generateText` + `Output.object`), React (shadcn/ui components)

**Spec:** `docs/superpowers/specs/2026-03-21-arena-prompt-refinement-design.md`

---

### Task 1: Create `refineOutlinePrompt` AI function

**Files:**
- Create: `src/lib/ai/refine-outline-prompt.ts`
- Modify: `src/lib/ai/index.ts`

- [ ] **Step 1: Create refine-outline-prompt.ts**

```typescript
// src/lib/ai/refine-outline-prompt.ts
import { generateText } from "ai";
import { textModel } from "./config";

interface OutlineContent {
  overallTheme: string;
  slides: Array<{ title: string; description: string; layoutNotes?: string }>;
}

export async function refineOutlinePrompt(
  currentPrompt: string,
  contentLearnings: { keepContent: string[]; avoidContent: string[] },
  positiveOutlines: OutlineContent[],
): Promise<string> {
  const positiveExamples =
    positiveOutlines.length > 0
      ? `\n\nPositive examples (outlines users approved):\n${positiveOutlines
          .map(
            (o) =>
              `- Theme: "${o.overallTheme}" | Slides: ${o.slides.map((s) => s.title).join(", ")}`,
          )
          .join("\n")}`
      : "";

  const { text } = await generateText({
    model: textModel,
    system: `You are a prompt engineer specializing in content design prompts. Your job is to conservatively evolve a system prompt based on user feedback.

Rules:
- Keep the structure and anything that's working
- Integrate the feedback naturally into the prompt — do NOT append it as a separate "learnings" section
- Remove or rephrase anything that contradicts the feedback
- If positive examples are provided, subtly steer the prompt toward those patterns
- Return ONLY the new prompt text, no explanation or commentary`,
    prompt: `Current outline system prompt:
"""
${currentPrompt}
"""

User feedback:
- Content that worked well: ${contentLearnings.keepContent.join(", ") || "none specified"}
- Content to avoid: ${contentLearnings.avoidContent.join(", ") || "none specified"}${positiveExamples}

Write an improved version of this system prompt.`,
  });

  return text.trim();
}
```

- [ ] **Step 2: Add export to index.ts**

Add to `src/lib/ai/index.ts`:
```typescript
export { refineOutlinePrompt } from "./refine-outline-prompt";
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/rokgoropevsek/Documents/NiroDigital/projects/socialmedia-manager && bunx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `refine-outline-prompt.ts`

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/refine-outline-prompt.ts src/lib/ai/index.ts
git commit -m "feat(arena): add refineOutlinePrompt AI function"
```

---

### Task 2: Update `refineImagePrompt` (rename from `refineStylePrompt`)

**Files:**
- Modify: `src/lib/ai/refine-style.ts`
- Modify: `src/lib/ai/index.ts`

- [ ] **Step 1: Rewrite refine-style.ts**

Replace the contents of `src/lib/ai/refine-style.ts` with:

```typescript
import { generateText } from "ai";
import { textModel } from "./config";

/**
 * Conservatively rewrite an image generation system prompt based on style learnings.
 * Used between arena rounds to evolve the prompt rather than appending.
 */
export async function refineImagePrompt(
  currentPrompt: string,
  styleLearnings: { keepStyle: string[]; avoidStyle: string[] },
  positivePrompts: string[],
): Promise<string> {
  const positiveExamples =
    positivePrompts.length > 0
      ? `\n\nPositive examples (image prompts users approved — extract patterns, don't copy verbatim):\n${positivePrompts
          .slice(0, 5) // Limit to 5 to avoid token bloat
          .map((p) => `- ${p.slice(0, 300)}`)
          .join("\n")}`
      : "";

  const { text } = await generateText({
    model: textModel,
    system: `You are a prompt engineer specializing in image generation prompts. Your job is to conservatively evolve a system prompt based on user feedback.

Rules:
- Keep the structure and anything that's working — especially CRITICAL RULES sections
- Integrate the feedback naturally into the prompt — do NOT append it as a separate "learnings" section
- Remove or rephrase anything that contradicts the feedback
- If positive examples are provided, extract patterns that made them successful and weave those into the prompt
- Return ONLY the new prompt text, no explanation or commentary`,
    prompt: `Current image generation system prompt:
"""
${currentPrompt}
"""

User feedback:
- Style elements that worked well: ${styleLearnings.keepStyle.join(", ") || "none specified"}
- Style elements to avoid: ${styleLearnings.avoidStyle.join(", ") || "none specified"}${positiveExamples}

Write an improved version of this system prompt.`,
  });

  return text.trim();
}
```

- [ ] **Step 2: Update export in index.ts**

In `src/lib/ai/index.ts`, change:
```typescript
// Old:
export { refineStylePrompt } from "./refine-style";
// New:
export { refineImagePrompt } from "./refine-style";
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/rokgoropevsek/Documents/NiroDigital/projects/socialmedia-manager && bunx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Will show errors in `arena.ts` where `refineStylePrompt` is imported — that's expected, we'll fix it in Task 5.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/refine-style.ts src/lib/ai/index.ts
git commit -m "feat(arena): rename refineStylePrompt to refineImagePrompt with between-round support"
```

---

### Task 3: Update `analyzeFeedback` — remove score-based weighting

**Files:**
- Modify: `src/lib/ai/analyze-feedback.ts`

- [ ] **Step 1: Rewrite analyze-feedback.ts**

Replace the contents of `src/lib/ai/analyze-feedback.ts`:

```typescript
import { generateText, Output } from "ai";
import { z } from "zod";
import { textModel } from "./config";

const learningsSchema = z.object({
  keepContent: z.array(z.string()),
  keepStyle: z.array(z.string()),
  avoidContent: z.array(z.string()),
  avoidStyle: z.array(z.string()),
  summary: z.string(),
});

export type StyleLearnings = z.infer<typeof learningsSchema>;

export interface FeedbackEntry {
  rating: "up" | "down";
  ratingTags: string[];
  ratingComment?: string | null;
  contentPrompt?: string | null;
  outlineContent?: unknown;
}

export async function analyzeFeedback(
  styleName: string,
  stylePrompt: string,
  entries: FeedbackEntry[],
): Promise<StyleLearnings> {
  const upEntries = entries.filter((e) => e.rating === "up");
  const downEntries = entries.filter((e) => e.rating === "down");

  const feedbackSummary = [
    `Style: "${styleName}" — ${stylePrompt}`,
    `Total entries: ${entries.length}`,
    `Approved (good to post): ${upEntries.length}`,
    upEntries.length > 0 &&
      `Approved entry prompts:\n${upEntries.map((e) => `- ${e.contentPrompt?.slice(0, 200)}`).join("\n")}`,
    `Rejected: ${downEntries.length}`,
    downEntries.length > 0 &&
      `Rejection details:\n${downEntries
        .map(
          (e) =>
            `- Tags: [${e.ratingTags.join(", ")}]${e.ratingComment ? ` Comment: ${e.ratingComment}` : ""}`,
        )
        .join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { output } = await generateText({
    model: textModel,
    system: `You are an AI design feedback analyst. Given user ratings for AI-generated images in a specific style, extract two-dimensional learnings:
- CONTENT learnings: what layouts, concepts, compositions, and messaging approaches worked or didn't
- STYLE learnings: what visual treatments, colors, textures, and aesthetic choices worked or didn't

Thumbs-up entries are positive examples — learn from what made them publishable.

Thumbs-down entries have rejection tags grouped into categories:
- Content tags (bad composition, cluttered / too much text, confusing layout, wrong message / off-topic, boring / generic, text too small to read, missing key information, awkward text placement) → extract CONTENT learnings
- Style tags (wrong style / doesn't match, ugly colors, off-brand, bad typography, low quality / blurry, too dark / too bright, colors clash, feels outdated, too generic / stock-photo feel) → extract STYLE learnings
- Both tags (too busy, doesn't feel Instagram-ready, would never post this) → extract both CONTENT and STYLE learnings

Comments may contain additional context for either dimension.
Be specific and actionable in your learnings.`,
    prompt: feedbackSummary,
    output: Output.object({ schema: learningsSchema }),
  });

  return (
    output ?? {
      keepContent: [],
      keepStyle: [],
      avoidContent: [],
      avoidStyle: [],
      summary: "No learnings generated.",
    }
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/rokgoropevsek/Documents/NiroDigital/projects/socialmedia-manager && bunx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Errors in `arena.ts` due to changed `FeedbackEntry` type (no more `contentScore`, `styleScore`, `"super"`) — fixed in Task 5.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/analyze-feedback.ts
git commit -m "feat(arena): simplify analyzeFeedback to tag-based analysis, remove score weighting"
```

---

### Task 4: Simplify rating UI — rating-overlay.tsx and swipe-view.tsx

**Files:**
- Modify: `src/components/arena/rating-overlay.tsx`
- Modify: `src/components/arena/swipe-view.tsx`

- [ ] **Step 1: Rewrite rating-overlay.tsx**

Replace the entire contents of `src/components/arena/rating-overlay.tsx`:

```typescript
"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Tag definitions ──────────────────────────────────────────────

const CONTENT_TAGS = [
  "bad composition",
  "cluttered / too much text",
  "confusing layout",
  "wrong message / off-topic",
  "boring / generic",
  "text too small to read",
  "missing key information",
  "awkward text placement",
] as const;

const STYLE_TAGS = [
  "wrong style / doesn't match",
  "ugly colors",
  "off-brand",
  "bad typography",
  "low quality / blurry",
  "too dark / too bright",
  "colors clash",
  "feels outdated",
  "too generic / stock-photo feel",
] as const;

const BOTH_TAGS = [
  "too busy",
  "doesn't feel Instagram-ready",
  "would never post this",
] as const;

const ALL_REJECT_TAGS = [
  { group: "Content", tags: CONTENT_TAGS },
  { group: "Style", tags: STYLE_TAGS },
  { group: "Both", tags: BOTH_TAGS },
];

// ── Props ────────────────────────────────────────────────────────

export interface RatingOverlayProps {
  mode: "approve" | "reject";
  onConfirm: (data: { tags?: string[]; comment?: string }) => void;
  onCancel: () => void;
}

// ── Approve Panel ────────────────────────────────────────────────

function ApprovePanel({
  onConfirm,
  onCancel,
}: {
  onConfirm: RatingOverlayProps["onConfirm"];
  onCancel: () => void;
}) {
  const handleConfirm = useCallback(() => {
    onConfirm({});
  }, [onConfirm]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleConfirm, onCancel]);

  return (
    <div className="space-y-5">
      <h3 className="text-center text-lg font-semibold">Good to post?</h3>
      <p className="text-center text-sm text-muted-foreground">
        This image will be marked as publishable.
      </p>
      <p className="text-center text-xs text-muted-foreground">
        Enter confirm, Esc cancel
      </p>
      <div className="flex gap-3">
        <Button variant="ghost" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          onClick={handleConfirm}
        >
          Confirm
        </Button>
      </div>
    </div>
  );
}

// ── Reject Panel ─────────────────────────────────────────────────

function RejectPanel({
  onConfirm,
  onCancel,
}: {
  onConfirm: RatingOverlayProps["onConfirm"];
  onCancel: () => void;
}) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleConfirm = useCallback(() => {
    onConfirm({
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      comment: comment.trim() || undefined,
    });
  }, [selectedTags, comment, onConfirm]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleConfirm, onCancel]);

  return (
    <div className="space-y-4">
      <h3 className="text-center text-lg font-semibold">
        What&apos;s wrong with it?
      </h3>
      {ALL_REJECT_TAGS.map(({ group, tags }) => (
        <div key={group} className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {group}
          </span>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors",
                    isSelected
                      ? "border-red-500/60 bg-red-500/15 text-red-400"
                      : "border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground",
                  )}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <Input
        placeholder="Additional comment (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleConfirm();
          }
        }}
      />
      <p className="text-center text-xs text-muted-foreground">
        Enter confirm, Esc cancel
      </p>
      <div className="flex gap-3">
        <Button variant="ghost" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="destructive" className="flex-1" onClick={handleConfirm}>
          Confirm
        </Button>
      </div>
    </div>
  );
}

// ── Main Overlay ─────────────────────────────────────────────────

export function RatingOverlay({
  mode,
  onConfirm,
  onCancel,
}: RatingOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Sheet */}
      <div className="relative z-10 w-full max-w-md animate-in slide-in-from-bottom-4 duration-300 rounded-t-2xl border border-border bg-card p-6 pb-8 shadow-xl">
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <XIcon className="size-5" />
        </button>
        {mode === "approve" ? (
          <ApprovePanel onConfirm={onConfirm} onCancel={onCancel} />
        ) : (
          <RejectPanel onConfirm={onConfirm} onCancel={onCancel} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update swipe-view.tsx — remove super, simplify approve**

In `src/components/arena/swipe-view.tsx`, make these changes:

**a)** Remove `handleSuper` callback (lines ~82-89). Delete the entire function.

**b)** Remove the super button JSX (lines 255-269) — delete the entire `{/* Super */}` button block.

**c)** Remove `StarIcon` from the lucide-react import (line 12) — it's no longer used.

**d)** Simplify `handleOverlayConfirm` — remove `contentScore`/`styleScore`:

Change the callback signature and approve branch:
```typescript
const handleOverlayConfirm = useCallback(
  (data: { tags?: string[]; comment?: string }) => {
    if (!currentEntry) return;

    setRatedIds((prev) => new Set(prev).add(currentEntry.id));

    if (overlayMode === "approve") {
      rateEntry.mutate(
        { entryId: currentEntry.id, rating: "up" },
        { onSettled: advanceToNext },
      );
    } else {
      rateEntry.mutate(
        {
          entryId: currentEntry.id,
          rating: "down",
          tags: data.tags,
          comment: data.comment,
        },
        { onSettled: advanceToNext },
      );
    }
  },
  [currentEntry, overlayMode, rateEntry, advanceToNext],
);
```

**e)** Remove `ArrowUp` → `handleSuper` from keyboard handler. Find the switch case for `"ArrowUp"` and delete it.

**f)** Update keyboard hint text:
```typescript
// Old:
Arrow keys: Left reject, Right approve, Up super
// New:
Arrow keys: Left reject, Right approve
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/rokgoropevsek/Documents/NiroDigital/projects/socialmedia-manager && bunx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Errors in `arena.ts` (rateEntry input schema still has old fields) — fixed in Task 5.

- [ ] **Step 4: Commit**

```bash
git add src/components/arena/rating-overlay.tsx src/components/arena/swipe-view.tsx
git commit -m "feat(arena): simplify rating UI — binary up/down, expanded tags, remove super/scores"
```

---

### Task 5: Refactor `arena.ts` — rateEntry, generateNextRound, saveRefinedStyle, listArenas

This is the largest task — the core logic change. The router file at `src/lib/trpc/routers/arena.ts` needs 4 mutations updated.

**Files:**
- Modify: `src/lib/trpc/routers/arena.ts`

- [ ] **Step 1: Update imports**

At the top of `arena.ts`, change the import from `@/lib/ai`:

```typescript
// Old:
import {
  generateOutlines as aiGenerateOutlines,
  generateImageFromPrompt,
  analyzeFeedback,
  refineStylePrompt,
  generateArenaCaption,
  PROMPTS,
  type ModelKey,
  type AspectRatio,
  type StyleLearnings,
  type ReferenceImage,
} from "@/lib/ai";

// New:
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
```

- [ ] **Step 2: Simplify `rateEntry` mutation**

Replace the `rateEntry` mutation input schema and handler (lines ~498-587):

```typescript
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
        data: { rating: "up" },
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
```

- [ ] **Step 3: Refactor `generateNextRound` — feedback collection**

In the `generateNextRound` mutation, update the feedback entry mapping (around lines 631-678). Replace the `for` loop that builds `learningsMap`:

```typescript
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
```

- [ ] **Step 4: Refactor `generateNextRound` — prompt rewrite + storage**

After creating `learningsMap` and before creating the new round, add the prompt refinement step. Also update the round creation to store refined prompts.

**Before the `newRound` creation** (around line 682), add prompt refinement:

```typescript
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

    // Rewrite both prompts in parallel
    const [refinedOutline, refinedImage] = await Promise.all([
      refineOutlinePrompt(
        previousOutlinePrompt,
        { keepContent: learnings.keepContent, avoidContent: learnings.avoidContent },
        positiveOutlines,
      ),
      refineImagePrompt(
        previousImagePrompt,
        { keepStyle: learnings.keepStyle, avoidStyle: learnings.avoidStyle },
        positivePrompts,
      ),
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
```

The `newRound` creation at line ~682 already stores `learnings: learningsMap as object`, so the refined prompts will be included automatically.

- [ ] **Step 5: Refactor `generateNextRound` — use refined prompts for generation**

In the background generation section (fire-and-forget, around lines 724-878), replace the outline and image prompt building with the refined prompts.

**Remove the `superEntries` fetch block entirely** (lines ~739-751) — the gold standard queries are no longer needed since positive examples are fetched in Step 4.

**Replace the outline prompt building** (lines ~753-766):

```typescript
// Use refined outline prompt instead of appending learnings
const refinedOutline = refinedPromptsMap[styleId].refinedOutlinePrompt;
const outlinePromptParts = [
  arena.sourceText,
  refinedOutline,
  stylePrompt &&
    `Visual style direction: ${stylePrompt}. Design the outline to work well with this aesthetic.`,
]
  .filter(Boolean)
  .join("\n\n");
```

**Replace the image prompt building** (lines ~797-811):

```typescript
// Use refined image prompt instead of appending learnings
const refinedImage = refinedPromptsMap[styleId].refinedImagePrompt;
const promptParts = [
  refinedImage,
  stylePrompt && `Visual style: ${stylePrompt}`,
  overallTheme && `Theme: ${overallTheme}`,
  slidesText && `Outline:\n${slidesText}`,
  brandContext.text && `Brand context: ${brandContext.text}`,
  count > 1 &&
    `Create a unique visual interpretation. Use different composition, layout angles, or emphasis — but do NOT write any variation numbers or meta-text in the image.`,
].filter(Boolean);
const imagePrompt = promptParts.join("\n\n");
```

Also update the entry update to store the refined prompt as `systemPrompt`:

```typescript
// In the entry update (around line 842):
systemPrompt: refinedImage, // Was: PROMPTS.images
```

- [ ] **Step 6: Update `listArenas` — remove superCount**

In the `listArenas` query (around lines 172-187), remove the `superCount` line and the `super` field from `entryStats`:

```typescript
// Remove this line:
const superCount = arena.entries.filter((e) => e.rating === "super").length;

// Change entryStats to:
entryStats: {
  total: totalEntries,
  up: upCount,
  generating: generatingCount,
},
```

- [ ] **Step 7: Update `getRoundResults` — remove super count**

In the `getRoundResults` query (around lines 962-982), update the `styleResults` mapping:

```typescript
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
```

- [ ] **Step 8: Update `exportWinners` — remove super references**

In `exportWinners` (around lines 1018-1022), simplify the filter:

```typescript
// Old:
if (entry.exportedPostId) continue;
if (entry.rating !== "up" && entry.rating !== "super") continue;

// New:
if (entry.exportedPostId) continue;
if (entry.rating !== "up") continue;
```

- [ ] **Step 9: Update `saveRefinedStyle` — use latest refined prompt directly**

Replace the `saveRefinedStyle` mutation (lines ~1192-1272):

```typescript
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
```

- [ ] **Step 10: Verify it compiles**

Run: `cd /Users/rokgoropevsek/Documents/NiroDigital/projects/socialmedia-manager && bunx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Clean compilation (no errors)

- [ ] **Step 11: Commit**

```bash
git add src/lib/trpc/routers/arena.ts
git commit -m "feat(arena): rewrite prompt refinement flow — AI rewrites instead of appending"
```

---

### Task 6: Update frontend — lab page stats and results-view super references

**Files:**
- Modify: `src/app/(roks-workspace)/dashboard/projects/[id]/lab/page.tsx`
- Modify: `src/components/arena/results-view.tsx`

- [ ] **Step 1: Update lab page — remove super stats**

In `src/app/(roks-workspace)/dashboard/projects/[id]/lab/page.tsx`, around line 384, change:

```typescript
// Old:
{arena.entryStats.total} images
{arena.entryStats.up > 0 && ` · ${arena.entryStats.up} liked`}
{arena.entryStats.super > 0 && ` · ${arena.entryStats.super} gallery`}

// New:
{arena.entryStats.total} images
{arena.entryStats.up > 0 && ` · ${arena.entryStats.up} liked`}
```

- [ ] **Step 2: Update results-view.tsx — change winner filter**

In `src/components/arena/results-view.tsx`, around line 153, change:

```typescript
// Old:
(e) => e.rating === "up" || e.rating === "super",

// New:
(e) => e.rating === "up",
```

Also check for any `super` count displays in the style results and remove them (the `super` field from `getRoundResults` is removed in Task 5 Step 7).

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/rokgoropevsek/Documents/NiroDigital/projects/socialmedia-manager && bunx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Clean compilation

- [ ] **Step 4: Commit**

```bash
git add src/app/\(roks-workspace\)/dashboard/projects/\[id\]/lab/page.tsx src/components/arena/results-view.tsx
git commit -m "feat(arena): remove super references from lab page stats and results view"
```

---

### Task 7: Update `style-breakdown-card.tsx` — remove super references

**Files:**
- Modify: `src/components/arena/style-breakdown-card.tsx`

- [ ] **Step 1: Remove `StarIcon` import**

In the lucide-react import (line 17), remove `StarIcon`:
```typescript
// Old:
import { ThumbsUpIcon, ThumbsDownIcon, StarIcon, ChevronDownIcon } from "lucide-react";
// New:
import { ThumbsUpIcon, ThumbsDownIcon, ChevronDownIcon } from "lucide-react";
```

- [ ] **Step 2: Remove `contentScore`/`styleScore` from `BreakdownEntry` type**

Remove lines 30-31 from the interface:
```typescript
// Remove these two lines:
contentScore: number | null;
styleScore: number | null;
```

- [ ] **Step 3: Remove `superCount` and simplify tallies**

Replace the tally section (lines 68-82):
```typescript
// Tally ratings
const upCount = entries.filter((e) => e.rating === "up").length;
const downCount = entries.filter((e) => e.rating === "down").length;
const ratedTotal = upCount + downCount;

// Winners: up entries with images
const winners = entries.filter((e) => e.rating === "up" && e.r2Key);

// Ratio bar widths (percentages)
const upPct = ratedTotal > 0 ? (upCount / ratedTotal) * 100 : 0;
const downPct = ratedTotal > 0 ? (downCount / ratedTotal) * 100 : 0;
```

- [ ] **Step 4: Remove amber bar segment from ratio bar**

Remove the `superPct` bar segment (lines 118-123):
```typescript
// Delete this block:
{superPct > 0 && (
  <div
    className="bg-amber-500 transition-all"
    style={{ width: `${superPct}%` }}
  />
)}
```

- [ ] **Step 5: Remove gallery stat from stats row**

Remove the amber star stat (lines 144-147):
```typescript
// Delete this block:
<span className="flex items-center gap-1">
  <StarIcon className="size-3 text-amber-500" />
  {superCount} gallery
</span>
```

- [ ] **Step 6: Remove super ring highlight and star badge from thumbnail grid**

On the thumbnail `div` (line 164), remove the super ring:
```typescript
// Old:
className={cn(
  "relative aspect-square overflow-hidden rounded-md",
  entry.rating === "super" && "ring-2 ring-amber-500",
)}
// New:
className="relative aspect-square overflow-hidden rounded-md"
```

Remove the star badge (lines 173-175):
```typescript
// Delete this block:
{entry.rating === "super" && (
  <StarIcon className="absolute right-0.5 top-0.5 size-3 fill-amber-500 text-amber-500" />
)}
```

- [ ] **Step 7: Verify it compiles**

Run: `cd /Users/rokgoropevsek/Documents/NiroDigital/projects/socialmedia-manager && bunx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Clean compilation

- [ ] **Step 8: Commit**

```bash
git add src/components/arena/style-breakdown-card.tsx
git commit -m "feat(arena): remove super references from style breakdown card"
```

---

### Task 8: Final verification

- [ ] **Step 1: Full type check**

Run: `cd /Users/rokgoropevsek/Documents/NiroDigital/projects/socialmedia-manager && bunx tsc --noEmit --pretty`
Expected: 0 errors

- [ ] **Step 2: Build check**

Run: `cd /Users/rokgoropevsek/Documents/NiroDigital/projects/socialmedia-manager && bun run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 3: Verify no remaining super/contentScore/styleScore references in arena code**

Run grep to check for leftover references:
```bash
cd /Users/rokgoropevsek/Documents/NiroDigital/projects/socialmedia-manager
grep -rn '"super"' src/lib/trpc/routers/arena.ts src/components/arena/ src/lib/ai/analyze-feedback.ts src/hooks/ || echo "Clean"
grep -rn 'contentScore\|styleScore' src/lib/trpc/routers/arena.ts src/components/arena/ src/lib/ai/analyze-feedback.ts src/hooks/ || echo "Clean"
grep -rn 'refineStylePrompt' src/ || echo "Clean"
grep -rn 'superCount\|superPct' src/components/arena/ src/app/ || echo "Clean"
```
Expected: All four return "Clean"

- [ ] **Step 4: Commit any remaining fixes if needed**
