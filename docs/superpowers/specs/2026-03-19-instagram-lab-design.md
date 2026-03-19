# Instagram Generation Lab — Design Spec

**Date**: 2026-03-19
**Status**: Approved
**Scope**: Instagram only (other platforms out of scope)

## Overview

A dedicated "Lab" workspace for batch-generating Instagram post variations, rating them, tweaking prompts at every stage, and converging on optimal outputs. Separate from the existing quick-generate flow, which remains unchanged.

The Lab is organized around **Experiments** (named test sessions) containing multiple **Runs** (generation batches with frozen settings). Each run produces **N concepts × M image variations × K caption variations**, all independently rated and tweakable.

## Goals

1. Generate large batches of variations (images and captions independently) for systematic comparison
2. Rate and annotate every variation to understand what works and why
3. Tweak any parameter in the generation pipeline and re-generate for A/B comparison
4. Full audit trail — every run preserves exactly what settings produced what output
5. Export winning image + caption combinations as finalized posts to the Gallery

## Data Model

### Experiment

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| name | String | User-provided experiment name |
| projectId | String | FK → Project |
| orgId | String | FK → Organization |
| brandIdentityId | String? | Optional locked brand identity |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### Run

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| experimentId | String | FK → Experiment |
| orgId | String | FK → Organization (denormalized for auth scoping) |
| runNumber | Int | Auto-increment per experiment |
| status | Enum | `configuring`, `generating`, `completed`, `failed`, `cancelled` |
| scope | Enum | `full`, `batch`, `single` — full run, partial batch re-run, or single variation re-gen |
| settingsSnapshot | Json | Full frozen copy of all generation parameters |
| parentRunId | String? | FK → Run (self-referential, tracks tweak lineage) |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**settingsSnapshot structure:**

```json
{
  "contentPrompt": "string | null",
  "contentIdeaId": "string | null",
  "contentSourceId": "string | null",
  "assetIds": ["string"],
  "imageStyleId": "string | null",
  "captionStyleId": "string | null",
  "model": "nano-banana-2 | nano-banana-pro",
  "aspectRatio": "3:4 | 1:1 | 4:5 | 9:16",
  "colorOverride": { "accent": "string", "bg": "string" } | null,
  "conceptCount": 10,
  "imageVariations": 10,
  "captionVariations": 10
}
```

### RunConcept

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| runId | String | FK → Run |
| conceptNumber | Int | 1-based index within the run |
| outline | Json | Frozen outline (structure below) |
| imagePrompt | String | Resolved base image prompt |
| captionPrompt | String | Resolved base caption prompt |

**outline JSON structure** (matches existing `GenerateOutline` type):

```typescript
interface RunConceptOutline {
  slides: {
    id: string
    slideNumber: number
    imagePrompt: string   // content + layout description, style-agnostic
    layoutNotes: string   // composition guidance
  }[]
  caption: string         // base caption text for the concept
}
```

### ImageVariation

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| conceptId | String | FK → RunConcept |
| variationNumber | Int | 1-based index |
| imagePrompt | String | Exact prompt used (may differ from concept-level if tweaked) |
| r2Key | String? | R2 object key for the generated image |
| mimeType | String? | Image MIME type |
| status | Enum | `generating`, `completed`, `failed` |
| rating | Int? | 1-5 star rating |
| ratingComment | String? | Optional note on why this rating |

### CaptionVariation

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| conceptId | String | FK → RunConcept |
| variationNumber | Int | 1-based index |
| captionPrompt | String | Exact prompt used |
| text | String? | The generated caption text |
| status | Enum | `generating`, `completed`, `failed` |
| rating | Int? | 1-5 star rating |
| ratingComment | String? | Optional note on why this rating |

### RunExport

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| runId | String | FK → Run |
| conceptId | String | FK → RunConcept (scopes export to a specific concept) |
| imageVariationId | String | FK → ImageVariation (picked winner) |
| captionVariationId | String | FK → CaptionVariation (picked winner) |
| generatedPostId | String? | FK → GeneratedPost (created on export to Gallery) |
| exportedAt | DateTime | |

**Note**: Export is always within a concept — you pair an image and caption from the same concept. Cross-concept mixing is not supported.

## UI Structure

### Route

`/dashboard/projects/[id]/lab` — inside the `(roks-workspace)` route group.

### Experiments List (`/lab`)

- Card grid of all experiments for the project
- Each card: name, run count, creation date, best-rated thumbnail
- "New Experiment" button — creates with just a name + optional brand identity

### Experiment Workspace (`/lab/[experimentId]`)

Split layout:

**Left: Run Sidebar**
- List of runs with status badges (generating, completed, failed)
- Runs tweaked from another show "from Run #X" label
- "New Run" button
- Click to load a run in the main area

**Right: Main Area — Three Tabs**

#### Tab 1: Configure

For the selected or new run:

- Content source: prompt text, select from ideas, select from sources, upload assets
- Style selection: image style picker + caption style picker (from existing style system)
- Variation counts:
  - Concepts (N): number input, default 5
  - Images per concept (M): number input, default 5
  - Captions per concept (K): number input, default 5
- Model: Flash / Pro toggle
- Aspect ratio: 3:4, 1:1, 4:5, 9:16 selector
- Color override: optional accent + background pickers
- **"Generate" button** — starts the batch

#### Tab 2: Results

After generation starts:

- **Concept selector**: tabs or accordion — Concept 1, Concept 2, ..., Concept N
- Within each concept:
  - **Image grid**: M thumbnails in a responsive grid. Click to expand full-size. Each has:
    - Star rating (1-5), clickable inline
    - Comment icon → expands inline text field
    - "Edit & Re-run" button
  - **Caption grid**: K text cards side by side. Each has:
    - Star rating (1-5), clickable inline
    - Comment icon → inline text field
    - "Edit & Re-run" button
- Grid default sort: rated first (highest → lowest), then unrated
- Progress indicators while generating: "Concept 1: 7/10 images, 4/10 captions"
- Individual variations flip from skeleton to content as they complete

#### Tab 3: Export

- Per concept: pick one winning image + one winning caption
- Preview assembled post (image with caption below)
- "Export to Gallery" — creates `GeneratedPost` + `GeneratedImage` records, appears in existing Gallery
- Bulk export: export all assembled posts at once

### Pipeline Tweaker (Drawer)

Triggered by "Edit & Re-run" on any variation:

- Shows full pipeline snapshot for that specific variation:
  - Content/outline (outline text editable)
  - Image prompt or caption prompt (editable, depending on variation type)
  - Style (changeable via dropdown)
  - Model, aspect ratio, color override (all editable)
  - Variation count for re-run (adjustable)
- **Scope control**:
  - "Just this one" — re-generate 1 variation
  - "New batch" — re-generate M images or K captions with tweaks
  - "Full re-run" — re-generate all concepts, all variations
- Creates a new Run with `parentRunId` set to source run
- New run appears in sidebar for comparison

### Cross-Run Comparison

- Select 2 runs in the sidebar (checkbox mode)
- Side-by-side view: same concept's top-rated variations from each run
- **Concept matching**: By `conceptNumber` — Concept 1 from Run A compared to Concept 1 from Run B. If runs have different concept counts, only overlapping concepts are shown.
- Visual diff of what changed between runs (highlight differing settings in the snapshot)
- Comparison only available between runs in the same experiment

## Generation Pipeline

### Execution Flow

1. User hits "Generate" on a configured run
2. System creates `Run` record with `settingsSnapshot` (status: `generating`)
3. Generates N outlines via Gemini (or varies from an existing idea)
4. Creates N `RunConcept` records with frozen outlines
5. For each concept, creates M `ImageVariation` + K `CaptionVariation` records (status: `generating`)
6. Returns immediately — UI starts polling

### Image Generation (batched with concurrency control)

- Base image prompt from concept's outline
- Each variation gets a diversity hint: "variation X of M — explore different compositions/angles/lighting"
- Style prompt, brand colors, logo instructions appended (same as current generation router)
- **Concurrency**: Max 5 parallel image generation calls (matching existing `GENERATION_BATCH_SIZE` in style router). Use `p-limit` or equivalent semaphore.
- **Retries**: 2 retries with exponential backoff (1s, 3s) on transient failures
- Results stored to R2 under `lab/{variationId}/original.{ext}` namespace, variation status updated to `completed`
- On failure after retries: variation status → `failed`, generation continues for remaining variations

### Caption Generation (batched, independent from images)

- Base caption prompt from concept's outline
- Caption style applied
- Diversity hints for variation
- **Concurrency**: Max 10 parallel caption calls (text is cheaper/faster than image gen)
- **Retries**: Same retry strategy as images
- Variation status updated with generated text

### Partial Failure Handling

- Individual variation failures do NOT fail the whole run
- Run status → `completed` when all variations have resolved (any mix of `completed` + `failed`)
- Run status → `failed` only if ALL variations fail
- UI shows failed variations with a retry button (re-generates just that one)

### Cancellation

- User can cancel an in-progress run from the Results tab or run sidebar
- Sets a `cancelled` flag on the Run record
- Background generation loop checks the flag between batches and stops early
- Already-completed variations are preserved; in-flight ones are abandoned
- Run status → `cancelled` — distinct from `completed` so the UI can show partial results were intentional

### Progress Polling

- **Lightweight poll endpoint** (`lab.runProgress`): returns status counts per concept, not full variation data
  ```typescript
  { conceptId: string, images: { generating: number, completed: number, failed: number }, captions: { ... } }[]
  ```
- Poll interval: 2 seconds while any variation is `generating`, stop when all resolved
- **Full variation data** fetched on-demand per concept when user clicks into a concept tab
- This keeps poll payloads small even for 200-variation runs

### Scale & Cost

10 concepts × 10 images × 10 captions = 100 image calls + 100 text calls per run.

At concurrency 5, image generation takes ~40-100s (100 images / 5 parallel × 2-5s each). Caption generation runs concurrently alongside images at its own concurrency limit, so captions finish well before images.

**Cost estimate** (displayed in UI before generation):
- Flash model: ~$0.01-0.02 per image, ~$0.001 per caption → ~$1-2 per full 10×10×10 run
- Pro model: ~$0.03-0.05 per image → ~$3-5 per full run
- The Configure tab shows an estimated cost based on selected variation counts and model before the user hits Generate

## Integration

### Unchanged

- Existing 5-step quick-generate flow — no modifications
- All existing tRPC routers (generation, content, style) — untouched
- Brand identity, style, and content source systems — reused directly
- R2 storage, image processing, Gemini integration — reused

### New Code

| Location | Purpose |
|----------|---------|
| `prisma/schema.prisma` | New models: Experiment, Run, RunConcept, ImageVariation, CaptionVariation, RunExport |
| `src/lib/trpc/routers/lab.ts` | All Lab endpoints |
| `src/app/(roks-workspace)/dashboard/projects/[id]/lab/` | Lab route pages |
| `src/components/lab/` | All Lab UI components |
| `src/stores/use-lab-store.ts` | Local UI state (selected run, active tab, comparison mode) |
| `src/hooks/use-lab.ts` | React hooks wrapping lab tRPC mutations |

### Sidebar

- New "Lab" nav item in project sidebar (beaker/flask icon)
- Positioned alongside Content, Styles, Gallery

### Export → Gallery Bridge

- Exporting from Lab creates `GeneratedPost` records with `r2Key` referencing the Lab image in R2 (no data duplication)
- **Prerequisite**: The existing `GeneratedImage` model needs an `r2Key` field added (alongside the legacy `data` Bytes column) so the image serving endpoint can serve from R2 when available. This is a small migration that aligns with the ongoing R2 migration.
- The image serving endpoint (`/api/images/[id]`) checks `r2Key` first, falls back to `data` Bytes for legacy images
- Exported results appear in existing Gallery page
- Clean boundary: Lab = testing, Gallery = finalized content

### R2 Storage Namespace

- Lab images stored under `lab/{variationId}/original.{ext}` — separate from existing `images/` namespace
- On export to Gallery, the `GeneratedImage` record points to the same R2 key (no copy needed)
- This keeps Lab storage isolated for easy cleanup

### Deletion & Cleanup

- **Delete experiment**: Cascade-deletes all runs → concepts → variations → exports with R2 cleanup.
- **Delete run**: Same cascade for that run's concepts/variations with R2 cleanup.
- **R2 cleanup ordering**: Query all variation `r2Key` values FIRST, then delete DB records (Prisma cascade), then batch-delete R2 objects. This prevents orphaned R2 objects from losing their keys during cascade. R2 delete failures are logged but non-blocking (matches existing pattern in asset deletion).
- **No automatic archival** — experiments persist until manually deleted. Can add archival later if storage becomes a concern.

## Out of Scope

- AI auto-learning from ratings (manual reference only)
- Platforms other than Instagram
- Changes to existing quick-generate flow
- Collaborative features (single-user testing)
- Scheduling or auto-posting to Instagram
