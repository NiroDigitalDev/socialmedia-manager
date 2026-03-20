# Lab Arena — Design Spec

**Date**: 2026-03-20
**Scope**: New feature parallel to Lab Trees — iterative image style training with Tinder-like swiping

## Problem

The Lab Tree is exploratory — you branch out ideas and test one path at a time. But when you want to find the best visual style for a known concept, you need volume: generate many images across multiple styles, rate them fast, and let the AI learn from your feedback to produce better results.

## Solution

**Lab Arena** — a batch-generate → swipe → refine loop:
1. Pick a source + image styles → generate N images per style
2. Swipe through images Tinder-style (right = keep, left = reject with tags)
3. AI analyzes feedback across two dimensions — **content** (what the image shows) and **style** (how it looks)
4. Generate another round with optimized prompts based on learnings
5. Repeat until satisfied → export winners + save refined styles

## Two-Dimensional Feedback Model

Each image is the product of two inputs: an **outline** (content/concept/layout) and a **style** (visual aesthetic). Feedback must distinguish between these:

| Rating | Content | Style | Round N Action |
|--------|---------|-------|----------------|
| Super (gallery add) | 5/5 | 5/5 | Gold standard — replicate both |
| Thumbs up (5/5, 5/5) | Great | Great | Reinforce both |
| Thumbs up (5/5, 2/5) | Great | Weak | Same outline concept, refine style execution |
| Thumbs up (2/5, 5/5) | Weak | Great | Great visual treatment, new outline/concept |
| Thumbs down + style tags | — | Bad | Adjust style prompt based on tags |
| Thumbs down + content tags | Bad | — | Generate new outlines, keep style |
| Thumbs down + both/none | Bad | Bad | Drop entirely |

The AI uses rating tags to classify whether rejection was content-driven or style-driven, and adjusts accordingly in the next round.

## Data Model

### LabArena

```
id              String    @id @default(cuid())
name            String
projectId       String    (FK → Project)
orgId           String
sourceText      String    @db.Text      // Snapshot of ContentSource.rawText at creation time
brandIdentityId String?   (FK → BrandIdentity)
aspectRatio     String    @default("1:1")
model           String    @default("nano-banana-2")  // "nano-banana-2" | "nano-banana-pro"
status          String    @default("active")  // "active" | "completed"
createdAt       DateTime  @default(now())
updatedAt       DateTime  @updatedAt
```

### LabArenaRound

```
id              String    @id @default(cuid())
arenaId         String    (FK → LabArena, cascade delete)
roundNumber     Int
learnings       Json?     // Per-style: { [styleId]: { keepContent: [...], keepStyle: [...], avoidContent: [...], avoidStyle: [...], summary: string } }
createdAt       DateTime  @default(now())
updatedAt       DateTime  @updatedAt

@@unique([arenaId, roundNumber])
```

### LabArenaEntry

```
id              String    @id @default(cuid())
arenaId         String    (FK → LabArena, cascade delete)
roundId         String    (FK → LabArenaRound, cascade delete)
imageStyleId    String    (FK → Style)
outlineContent  Json?     // The outline used for this image: { overallTheme, slides }
r2Key           String?
mimeType        String?
status          String    @default("generating")  // "generating" | "completed" | "failed"
rating          String?   // "up" | "down" | "super" | null  — "super" = added to gallery (strongest signal)
contentScore    Int?      // 1-5, how good the content/concept is (set on "up" and "super")
styleScore      Int?      // 1-5, how good the style execution is (set on "up" and "super")
ratingTags      String[]  @default([])  // on "down": content or style tags
ratingComment   String?
exportedPostId  String?   // FK → GeneratedPost, set when "super" rated (added to gallery)
systemPrompt    String?   @db.Text
contentPrompt   String?   @db.Text
// Caption fields (populated after image rounds complete)
captions        Json?     // Array of { text: string, selected: boolean }
captionStyleId  String?   (FK → Style)
orgId           String
createdAt       DateTime  @default(now())
updatedAt       DateTime  @updatedAt
```

Key: `outlineContent` is stored on each entry so the system knows what content concept was used. This enables the content vs style distinction in feedback analysis.

### Indexes

- LabArena: `(orgId)`, `(projectId)`
- LabArenaRound: `(arenaId)`, `@@unique([arenaId, roundNumber])`
- LabArenaEntry: `(arenaId)`, `(roundId)`, `(arenaId, rating)`

## Rating Tags (Two-Dimensional)

```typescript
const CONTENT_TAGS = [
  "bad composition",
  "cluttered",
  "confusing layout",
  "wrong message",
] as const;

const STYLE_TAGS = [
  "wrong style",
  "ugly colors",
  "off-brand",
  "bad text/typography",
  "low quality",
] as const;

const RATING_TAGS = [...CONTENT_TAGS, ...STYLE_TAGS, "too busy"] as const;
```

When analyzing feedback, tags from `CONTENT_TAGS` signal content issues (→ generate new outline). Tags from `STYLE_TAGS` signal style execution issues (→ adjust style prompt, keep outline). "too busy" is ambiguous and counts toward both.

## Generation Flow

### Round 1 — Setup & Generate

1. User creates Arena: picks project source, selects N image styles, sets count per style, picks aspect ratio and model
2. System creates `LabArena` + `LabArenaRound(roundNumber: 1)` + N×count `LabArenaEntry` records with `status: "generating"`
3. For each style:
   - Generate a style-influenced outline from source text (using `aiGenerateOutlines` with `imageStyleId`)
   - Store outline in each entry's `outlineContent`
   - Generate `count` images from that outline (using `generateImageFromPrompt` with style prompt + brand context)
4. Fire-and-forget pattern: return entry IDs immediately, background processing with `pLimit(5)` updates status
5. Upload images to R2 at `arena/{entryId}/original.{ext}`

### Swiping Phase

1. Query: all entries for current round with `status: "completed"` and `rating: null`
2. Serve one at a time, ordered by creation
3. Three actions:
   - **Swipe right** → quick two-axis rating: content ★1-5, style ★1-5 → `rating: "up"`, stores `contentScore` + `styleScore`
   - **Swipe up / star button** → `rating: "super"` (implicitly 5/5 on both axes, add to gallery immediately — creates GeneratedPost + GeneratedImage referencing entry's `r2Key`, stores `exportedPostId`)
   - **Swipe left** → show tag chips (grouped: content vs style) + optional free text → `rating: "down"`, stores `ratingTags` + `ratingComment`
4. Scoring signals for AI learning:
   - High content + low style (e.g. 5/2): great concept, bad visual → same outline, refine style
   - Low content + high style (e.g. 2/5): bad concept, great visuals → new outline, keep style
   - High both: replicate this pattern
   - "Super": gold standard (5/5 implied)
5. All entries rated = swiping complete for this round

### Round N — Refinement

1. User views per-style results leaderboard
2. For each style, user toggles: **continue** or **drop**
3. System analyzes feedback for each continuing style across all previous rounds:
   - **Super-rated entries**: gold standard (5/5 both axes) — replicate content + style patterns
   - **Thumbs-up with high content + high style** (4-5 / 4-5): reinforce both directions
   - **Thumbs-up with high content + low style** (4-5 / 1-3): great concept, refine style execution → reuse similar outlines, adjust visual treatment
   - **Thumbs-up with low content + high style** (1-3 / 4-5): great visuals, weak concept → generate new outlines, keep style direction
   - **Thumbs-down with style tags**: style execution problems (ugly colors, off-brand, etc.)
   - **Thumbs-down with content tags**: content/layout problems (cluttered, bad composition, etc.)
   - **Thumbs-down with both or no tags**: general rejection
4. Generate `learnings` JSON via AI per style:
   ```json
   {
     "keepContent": ["side-by-side comparisons", "clean single-message layouts"],
     "keepStyle": ["bold contrast", "frosted glass panels"],
     "avoidContent": ["multi-element cluttered layouts", "text-heavy designs"],
     "avoidStyle": ["neon gradients", "busy textures"],
     "summary": "Users prefer clean comparison layouts with bold, minimal glassmorphism. Avoid cluttered multi-panel designs."
   }
   ```
5. Display learnings to user
6. User sets count for new round
7. Create `LabArenaRound(roundNumber: N)` + entries
8. For each continuing style, generation uses optimized prompts:
   - **New outlines generated** incorporating content learnings (what layouts/concepts worked)
   - **Style prompt enhanced** with style learnings (what visual treatments worked)
   - **Gold standard examples** (super-rated entry prompts) referenced explicitly

### Learnings Prompt Optimization

For each style in Round N, the image generation pipeline:

1. **Outline generation** prompt includes:
   - Source text
   - Style direction (original style promptText)
   - Content learnings: "Users liked: [keepContent]. Users disliked: [avoidContent]."
   - Reference to super-rated outlines as examples of great content

2. **Image generation** prompt includes:
   - The new outline
   - Original style promptText
   - Style learnings: "Users liked: [keepStyle]. Users disliked: [avoidStyle]."
   - Brand context (if brandIdentityId set)

The AI doesn't modify the Style record — it builds optimized prompts dynamically. The style is only saved/updated explicitly when the user clicks "Save Style".

### Completion

- User clicks "Done" → Arena status set to "completed"
- **Export winners**: `exportWinners` creates GeneratedPost + GeneratedImage for entries with `rating: "up"` that don't already have `exportedPostId` (skips "super" entries already exported). Fields: `prompt` = entry's contentPrompt, `format` = "static", `aspectRatio` from arena, `model` = "arena-export", `platform` = "instagram".
- **Save refined style**: per style, AI generates a new `promptText` incorporating all learnings. Creates a new Style with `kind: "image"`, `parentStyleIds: [originalStyleId]` for lineage tracking.

## Caption Generation (Post-Image-Rounds)

Captions are generated after the user is satisfied with image results:

1. User selects winning images in Results View → "Generate Captions"
2. Picks caption style(s) + count per image (e.g. 3)
3. For each selected entry, generate captions using `aiGenerateCaption` with the image + outline context + caption style
4. Store in entry's `captions` JSON field: `[{ text: string, selected: boolean }]`
5. User reviews captions under each image in Results View — radio-select the best one per image
6. Selected caption used in export

## UI Structure

### Arena List (Lab Page)

The existing lab list page gets tabs: "Trees" | "Arenas"

Arena cards show:
- Name, source text snippet
- Round count (e.g. "Round 3")
- Stats: total images / thumbs-up count / super count
- Status badge (active / completed)

### Arena Page — Three Views

**1. Setup View** (new arena):
- Source picker: dropdown of project content sources
- Image style multi-select: grid of style cards with checkboxes (shows style preview images)
- Count per style: number input
- Aspect ratio picker, model picker
- Optional: brand identity picker
- "Start Arena" button

**2. Swipe View** (rating images):
- Full-width centered image, large format
- Keyboard shortcuts: ← reject, → approve, ↑ super like / add to gallery
- On approve (swipe right): quick rating overlay appears:
  - Content: ★★★★★ (tap 1-5 stars)
  - Style: ★★★★★ (tap 1-5 stars)
  - Confirm → next image
- On super (swipe up): instant gallery add (5/5 implied), no extra input needed
- On reject (swipe left): bottom sheet slides up with:
  - Tag chips grouped: **Content** (bad composition, cluttered, confusing layout, wrong message) | **Style** (wrong style, ugly colors, off-brand, bad text/typography, low quality) | **Both** (too busy)
  - Free text input for custom feedback
  - Confirm button
- Top bar: progress "23/100", current style name badge, round number
- Can exit and resume — unrated entries persist

**3. Results View** (between rounds / final):
- Per-style breakdown cards:
  - Style name + preview
  - Ratio bar: 15/20 liked (green/red/gold proportional bar showing up/down/super)
  - Grid of thumbs-up and super images (small thumbnails, super highlighted)
  - Toggle: "Continue" / "Drop"
- AI learnings panel per style: content learnings + style learnings separately
- "Generate Round N" button with count-per-style input
- "Generate Captions" button (for winning images)
- Winners gallery: filterable grid of all thumbs-up + super images across all rounds
  - Each image shows caption options below (after caption generation)
  - Radio select for best caption
- "Export Selected" → creates GeneratedPost records (skips already-exported supers)
- "Save Style" per style → creates new Style with refined promptText
- "Done" button → marks arena completed

## tRPC Router: `arena.ts`

All procedures use `orgProtectedProcedure` and verify `orgId` on fetched records.

### Queries
- `listArenas({ projectId })` — list arenas for project, scoped to org
- `getArena({ arenaId })` — full arena with rounds and entries
- `getSwipeQueue({ roundId })` — unrated completed entries for swiping
- `getRoundResults({ roundId })` — per-style breakdown with stats
- `arenaProgress({ arenaId })` — poll for generating entries (same pattern as tree's `treeProgress`, 2s refetchInterval)

### Mutations
- `createArena({ name, projectId, sourceText, imageStyleIds, countPerStyle, aspectRatio, model?, brandIdentityId? })` — creates arena + round 1 + entries, starts generation
- `rateEntry({ entryId, rating, contentScore?, styleScore?, tags?, comment? })` — rate a single entry. "up" requires contentScore + styleScore (1-5). "super" creates GeneratedPost + GeneratedImage, stores exportedPostId (implied 5/5). "down" uses tags + optional comment.
- `generateNextRound({ arenaId, styles: { styleId, count }[], previousRoundId })` — analyzes feedback, generates learnings, creates new round with optimized prompts
- `generateCaptions({ entryIds, captionStyleId, countPerImage })` — generate captions for winning entries
- `selectCaption({ entryId, captionIndex })` — mark which caption is selected
- `exportWinners({ arenaId, entryIds })` — create GeneratedPost + GeneratedImage for entries without exportedPostId
- `saveRefinedStyle({ arenaId, styleId, name? })` — AI refines promptText, creates new Style with `kind: "image"` and `parentStyleIds` lineage
- `completeArena({ arenaId })` — mark as completed
- `deleteArena({ arenaId })` — collect all r2Keys first, cascade delete, then batchDeleteR2 (following lab.ts pattern)

## Progress Polling

Arena uses the same polling pattern as trees:
- `arenaProgress({ arenaId })` query returns entries with `status: "generating"` or recently updated
- Client polls every 2s with `refetchInterval` while any entries are generating
- When fingerprint changes, invalidate `getArena` query to refresh UI

## Route Structure

```
src/app/(roks-workspace)/dashboard/projects/[id]/lab/arena/[arenaId]/page.tsx
```

The arena page renders the appropriate view (Setup / Swipe / Results) based on arena state and current round.

## Key Differences from Tree

| Aspect | Tree | Arena |
|--------|------|-------|
| Structure | Hierarchical (5 layers) | Flat (entries per round) |
| Purpose | Explore one idea deeply | Test many visual variations fast |
| Rating | Per-node, optional | Central mechanic with 3 tiers (down/up/super) |
| Feedback | No structured tags | Two-dimensional: content vs style tags |
| Styles | Per-outline, manual | Per-arena, AI-optimized across rounds |
| Learning | None | AI analyzes feedback, refines prompts per round |
| Output | Single post export | Batch export + refined styles |
| Captions | Part of the tree | Generated after image rounds |
| UI | Canvas (React Flow) | Swipe view + results grid |

## Dependencies

- Existing: `src/lib/ai/` module (generateOutlines, generateImageFromPrompt, generateCaption)
- Existing: R2 upload/delete/batchDeleteR2 utilities
- Existing: Style model and queries
- Existing: GeneratedPost/GeneratedImage for export
- Existing: BrandIdentity for brand context
- New: AI prompt for analyzing two-dimensional feedback and generating learnings
- New: AI prompt for refining style prompts based on learnings

## Out of Scope

- Video/carousel support (images only)
- Collaborative rating (single user per arena)
- Auto-scheduling of exported posts
- Caption swiping (captions are reviewed in a simple list, not swiped)
