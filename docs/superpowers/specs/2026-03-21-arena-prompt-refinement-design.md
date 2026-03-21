# Arena Prompt Refinement Refactor

**Date:** 2026-03-21
**Status:** Approved

## Problem

The arena's between-round prompt refinement **appends** learnings as extra lines to the original prompts rather than **rewriting** them. This creates contradictions (e.g., original says "use serif" while appended learning says "users disliked serif"), forces the model to resolve conflicting signals, and results in prompts that grow longer each round without getting cleaner.

Additionally, the rating system has unnecessary complexity (star scores, "super" rating) that doesn't map well to the refinement signals we actually need.

## Solution

### 1. Prompt Rewrite Between Rounds (Approach A — Conservative Rewrite)

Replace the append-based learnings injection with AI-powered prompt rewrites. After each round's feedback analysis, two new AI functions produce **clean, evolved prompts** that bake in learnings naturally.

#### New: `refineOutlinePrompt(currentPrompt, contentLearnings, positiveOutlines)`

```typescript
async function refineOutlinePrompt(
  currentPrompt: string,                    // Previous round's outline prompt, or PROMPTS.outlines(count)
  contentLearnings: {
    keepContent: string[];
    avoidContent: string[];
  },
  positiveOutlines: OutlineContent[],        // See type below
): Promise<string>
```

- **`positiveOutlines` type:** `Array<{ overallTheme: string; slides: Array<{ title: string; description: string; layoutNotes?: string }> }>` — parsed from `LabArenaEntry.outlineContent` (Json field) of all thumbs-up entries across **all rounds** for this style in the current arena.
- **AI instruction:** "Evolve this prompt based on the learnings. Keep the structure and anything that's working. Integrate the feedback naturally — don't append it as a separate section. Remove or rephrase anything that contradicts the learnings."
- **Output:** new outline system prompt string
- **File:** `src/lib/ai/refine-outline-prompt.ts`

#### Updated: `refineImagePrompt(currentPrompt, styleLearnings, positivePrompts)`

```typescript
async function refineImagePrompt(
  currentPrompt: string,                    // Previous round's image prompt, or PROMPTS.images
  styleLearnings: {
    keepStyle: string[];
    avoidStyle: string[];
  },
  positivePrompts: string[],                // contentPrompt strings from thumbs-up entries
): Promise<string>
```

- **`positivePrompts` scope:** `contentPrompt` strings from all thumbs-up entries across **all rounds** for this style in the current arena.
- **AI instruction:** same conservative rewrite approach
- **Output:** new image system prompt string
- **File:** `src/lib/ai/refine-style.ts` (rename function from `refineStylePrompt`)

#### Parallelization

Both refine calls for a style run in **parallel** (`Promise.all`). All styles' refine calls also run in parallel before generation begins. This adds ~1-2s latency (one text-model call) before image generation starts — negligible compared to image generation time.

### 2. Simplified Rating System

#### Thumbs Up = Good to Post

- Simple confirm, no scores
- No contentScore, no styleScore, no stars
- Binary signal: this is publishable

#### Thumbs Down = Not for Posting

- Pick from expanded tags (multi-select) + optional comment
- Tags are grouped by what they inform in refinement

#### Remove "Super" Rating

- All thumbs-up entries serve as positive examples (previously only "super" did)
- No special gold-standard tier
- **Gallery export:** currently "super" auto-exports to gallery via `GeneratedPost` + `GeneratedImage` creation. This is removed. Gallery export is now **only** via the existing `exportWinners` mutation, which the user triggers explicitly from the results view.

#### Expanded Rejection Tags

Tags are stored as the **exact display string** (e.g., `"cluttered / too much text"`). The `analyzeFeedback` AI prompt receives tags pre-grouped by category so it knows which dimension each tag belongs to.

**Canonical constants:**

```typescript
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
```

### 3. Updated `analyzeFeedback` Interface

#### New `FeedbackEntry` type

```typescript
interface FeedbackEntry {
  rating: "up" | "down";
  ratingTags: string[];         // From the tag constants above
  ratingComment?: string | null;
  contentPrompt?: string | null;
  outlineContent?: unknown;     // OutlineContent JSON or null
}
```

Removed: `contentScore`, `styleScore`, `"super"` rating.

#### Tag grouping: caller-side

The caller (`generateNextRound`) pre-groups tags before passing to `analyzeFeedback`. The function receives the entries as-is, but the **AI system prompt** is updated to use tag-group awareness:

**Updated AI system prompt:**

```
You are an AI design feedback analyst. Given user ratings for AI-generated images
in a specific style, extract two-dimensional learnings:
- CONTENT learnings: what layouts, concepts, compositions, and messaging approaches
  worked or didn't
- STYLE learnings: what visual treatments, colors, textures, and aesthetic choices
  worked or didn't

Thumbs-up entries are positive examples — learn from what made them publishable.

Thumbs-down entries have rejection tags grouped into categories:
- Content tags (bad composition, cluttered / too much text, confusing layout,
  wrong message / off-topic, boring / generic, text too small to read,
  missing key information, awkward text placement) → extract CONTENT learnings
- Style tags (wrong style / doesn't match, ugly colors, off-brand, bad typography,
  low quality / blurry, too dark / too bright, colors clash, feels outdated,
  too generic / stock-photo feel) → extract STYLE learnings
- Both tags (too busy, doesn't feel Instagram-ready, would never post this) →
  extract both CONTENT and STYLE learnings

Comments may contain additional context for either dimension.
Be specific and actionable in your learnings.
```

### 4. Storage — Prompt Evolution Chain

Expand `LabArenaRound.learnings` JSON to include rewritten prompts per style:

```typescript
{
  [styleId]: {
    // From analyzeFeedback (analysis of feedback from prior rounds)
    keepContent: string[]
    avoidContent: string[]
    keepStyle: string[]
    avoidStyle: string[]
    summary: string
    // Rewritten prompts (used for THIS round's generation)
    refinedOutlinePrompt: string
    refinedImagePrompt: string
  }
}
```

**Semantic note:** `learnings[styleId]` on round N stores two things:
1. **Feedback analysis** — what we learned from rating entries in rounds 1..N-1
2. **Refined prompts** — the prompts used to generate round N's content

When generating round N+1, read `refinedOutlinePrompt` and `refinedImagePrompt` from round N's learnings as the base for further refinement.

No Prisma schema migration needed — `learnings` is already `Json?`.

### 5. Generation Flow Changes

#### `generateNextRound` in `arena.ts`

**Current flow (append):**
```
outlinePrompt = sourceText + stylePrompt + "Users liked: ..." + "Users disliked: ..."
imagePrompt = PROMPTS.images + stylePrompt + "Style learnings — liked/disliked" + outline + brand
```

**New flow (rewrite):**
```
// 1. Get previous round's prompts (or defaults for round 1→2)
previousOutlinePrompt = prevRound.learnings[styleId].refinedOutlinePrompt ?? PROMPTS.outlines(count)
previousImagePrompt = prevRound.learnings[styleId].refinedImagePrompt ?? PROMPTS.images

// 2. Fetch positive examples — all thumbs-up entries across ALL rounds for this style
positiveEntries = await prisma.labArenaEntry.findMany({
  where: { arenaId, imageStyleId: styleId, rating: "up" }
})
positiveOutlines = positiveEntries.map(e => e.outlineContent).filter(Boolean)
positivePrompts = positiveEntries.map(e => e.contentPrompt).filter(Boolean)

// 3. Rewrite prompts via AI (parallel per style)
[refinedOutlinePrompt, refinedImagePrompt] = await Promise.all([
  refineOutlinePrompt(previousOutlinePrompt, contentLearnings, positiveOutlines),
  refineImagePrompt(previousImagePrompt, styleLearnings, positivePrompts),
])

// 4. Store on the new round's learnings
round.learnings[styleId].refinedOutlinePrompt = refinedOutlinePrompt
round.learnings[styleId].refinedImagePrompt = refinedImagePrompt

// 5. Use for generation — clean prompts, no appending
outlinePrompt = sourceText + "\n\n" + refinedOutlinePrompt + "\n\n" + styleDirection
imagePrompt = refinedImagePrompt + "\n\n" + styleDirection + "\n\n" + outline + "\n\n" + brandContext
```

The refinedImagePrompt is a self-contained system prompt with evolved CRITICAL RULES, style direction, and learned preferences. No more `PROMPTS.images` + stuff tacked on.

#### `rateEntry` mutation

- Accept: `rating: "up" | "down"`, `tags?: string[]`, `comment?: string`
- Remove: `contentScore`, `styleScore`, `"super"` rating value
- Remove: auto-export to gallery on "super" (gallery export is now only via `exportWinners`)

#### `analyzeFeedback`

- Updated `FeedbackEntry` type (see section 3)
- Updated AI system prompt with explicit tag-to-dimension mapping (see section 3)
- Remove score-based weighting logic
- All thumbs-up entries = positive examples

#### `saveRefinedStyle`

- **Directly use** the latest round's `refinedImagePrompt` as the new style's `promptText`. No additional AI call needed — the refined prompt already has all learnings baked in from progressive rounds.
- Use all thumbs-up entries as positive examples for the learning merge (unchanged behavior, just scope expanded from "super" to all "up").

### 6. `listArenas` and frontend stats

- `listArenas` query: remove `superCount` from `entryStats`. Keep `total`, `up`, `generating`.
- `lab/page.tsx` line 384: remove the `arena.entryStats.super > 0 && ...gallery` display.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/ai/refine-outline-prompt.ts` | **New** — `refineOutlinePrompt()` |
| `src/lib/ai/refine-style.ts` | Rename `refineStylePrompt` → `refineImagePrompt`, update for between-round use |
| `src/lib/ai/analyze-feedback.ts` | Updated `FeedbackEntry` type, updated AI system prompt, remove score-based weighting |
| `src/lib/trpc/routers/arena.ts` | `rateEntry`: simplify (remove scores, super, auto-export). `generateNextRound`: rewrite flow with parallel refine calls. `saveRefinedStyle`: use latest refined prompt directly. `listArenas`: remove super count. |
| `src/components/arena/rating-overlay.tsx` | ApprovePanel → simple confirm. RejectPanel → expanded tags (8+9+3). Remove StarRow. Update tag constants. |
| `src/app/(roks-workspace)/dashboard/projects/[id]/lab/page.tsx` | Remove `entryStats.super` display |

## No Migration Required

- `LabArenaRound.learnings` is `Json?` — new fields are additive
- `LabArenaEntry.rating` already accepts strings — "super" simply won't be used
- `contentScore` and `styleScore` are already nullable `Int?`
