# Instagram Generation Lab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated Lab workspace for batch-generating Instagram post variations (N concepts × M images × K captions), rating them, tweaking prompts, and exporting winners to Gallery.

**Architecture:** New `Experiment → Run → RunConcept → ImageVariation/CaptionVariation` data model with a dedicated tRPC router (`lab.ts`). UI lives under `(roks-workspace)/dashboard/projects/[id]/lab/` with experiments list and workspace pages. Generation uses existing Gemini utilities with concurrency-controlled batching via `p-limit`. Images stored in R2 under `lab/` namespace.

**Tech Stack:** Prisma, tRPC v11, Zustand, React (Next.js 16 App Router), shadcn/ui, Gemini AI, Cloudflare R2, p-limit

**Spec:** `docs/superpowers/specs/2026-03-19-instagram-lab-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/trpc/routers/lab.ts` | All Lab tRPC endpoints (experiment CRUD, run CRUD, generation pipeline, polling, rating, export, deletion) |
| `src/hooks/use-lab.ts` | React hooks wrapping lab tRPC queries/mutations |
| `src/stores/use-lab-store.ts` | Zustand store for Lab UI state (selected run, active tab, comparison mode) |
| `src/app/(roks-workspace)/dashboard/projects/[id]/lab/page.tsx` | Experiments list page |
| `src/app/(roks-workspace)/dashboard/projects/[id]/lab/[experimentId]/page.tsx` | Experiment workspace page |
| `src/components/lab/experiment-card.tsx` | Experiment card for list view |
| `src/components/lab/run-sidebar.tsx` | Run list sidebar with status badges |
| `src/components/lab/configure-tab.tsx` | Run configuration form |
| `src/components/lab/results-tab.tsx` | Results grid with concept tabs |
| `src/components/lab/export-tab.tsx` | Winner assembly + Gallery export |
| `src/components/lab/image-variation-card.tsx` | Image thumbnail with rating + actions |
| `src/components/lab/caption-variation-card.tsx` | Caption text card with rating + actions |
| `src/components/lab/star-rating.tsx` | Reusable 1-5 star rating component |
| `src/components/lab/pipeline-tweaker.tsx` | Edit & Re-run drawer |
| `src/components/lab/run-comparison.tsx` | Side-by-side run comparison view |
| `src/components/lab/cost-estimate.tsx` | Cost estimation display for Configure tab |

### Modified Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add Experiment, Run, RunConcept, ImageVariation, CaptionVariation, RunExport models + enums. Add `r2Key` to GeneratedImage. |
| `src/lib/trpc/router.ts` | Register `labRouter` |
| `src/components/nav-active-project.tsx` | Add "Lab" entry to the `subPages` array (line ~26) |
| `src/app/api/images/[id]/route.ts` | Add R2 fallback — check `r2Key` before `data` Bytes |

---

## Task 1: Prisma Schema — New Models + Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enums to Prisma schema**

Add after existing enums in `prisma/schema.prisma`:

```prisma
enum RunStatus {
  configuring
  generating
  completed
  failed
  cancelled
}

enum RunScope {
  full
  batch
  single
}

enum VariationStatus {
  generating
  completed
  failed
}
```

- [ ] **Step 2: Add Experiment model**

```prisma
model Experiment {
  id              String         @id @default(cuid())
  name            String
  projectId       String
  orgId           String
  brandIdentityId String?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  project         Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  brandIdentity   BrandIdentity? @relation(fields: [brandIdentityId], references: [id], onDelete: SetNull)
  runs            Run[]

  @@index([orgId])
  @@index([projectId])
}
```

- [ ] **Step 3: Add Run model**

```prisma
model Run {
  id               String    @id @default(cuid())
  experimentId     String
  orgId            String
  runNumber        Int
  status           RunStatus @default(configuring)
  scope            RunScope  @default(full)
  settingsSnapshot Json
  parentRunId      String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  experiment       Experiment  @relation(fields: [experimentId], references: [id], onDelete: Cascade)
  parentRun        Run?        @relation("RunLineage", fields: [parentRunId], references: [id], onDelete: SetNull)
  childRuns        Run[]       @relation("RunLineage")
  concepts         RunConcept[]
  exports          RunExport[]

  @@index([experimentId])
  @@index([orgId])
  @@index([parentRunId])
}
```

- [ ] **Step 4: Add RunConcept model**

```prisma
model RunConcept {
  id            String  @id @default(cuid())
  runId         String
  conceptNumber Int
  outline       Json
  imagePrompt   String  @db.Text
  captionPrompt String  @db.Text

  run              Run               @relation(fields: [runId], references: [id], onDelete: Cascade)
  imageVariations  ImageVariation[]
  captionVariations CaptionVariation[]
  exports          RunExport[]

  @@index([runId])
}
```

- [ ] **Step 5: Add ImageVariation model**

```prisma
model ImageVariation {
  id              String          @id @default(cuid())
  conceptId       String
  variationNumber Int
  imagePrompt     String          @db.Text
  r2Key           String?
  mimeType        String?
  status          VariationStatus @default(generating)
  rating          Int?
  ratingComment   String?

  concept         RunConcept      @relation(fields: [conceptId], references: [id], onDelete: Cascade)
  exports         RunExport[]

  @@index([conceptId])
}
```

- [ ] **Step 6: Add CaptionVariation model**

```prisma
model CaptionVariation {
  id              String          @id @default(cuid())
  conceptId       String
  variationNumber Int
  captionPrompt   String          @db.Text
  text            String?         @db.Text
  status          VariationStatus @default(generating)
  rating          Int?
  ratingComment   String?

  concept         RunConcept      @relation(fields: [conceptId], references: [id], onDelete: Cascade)
  exports         RunExport[]

  @@index([conceptId])
}
```

- [ ] **Step 7: Add RunExport model**

```prisma
model RunExport {
  id                 String   @id @default(cuid())
  runId              String
  conceptId          String
  imageVariationId   String
  captionVariationId String
  generatedPostId    String?
  exportedAt         DateTime @default(now())

  run              Run              @relation(fields: [runId], references: [id], onDelete: Cascade)
  concept          RunConcept       @relation(fields: [conceptId], references: [id], onDelete: Cascade)
  imageVariation   ImageVariation   @relation(fields: [imageVariationId], references: [id], onDelete: Cascade)
  captionVariation CaptionVariation @relation(fields: [captionVariationId], references: [id], onDelete: Cascade)
  generatedPost    GeneratedPost?   @relation(fields: [generatedPostId], references: [id], onDelete: SetNull)

  @@index([runId])
}
```

- [ ] **Step 8: Modify existing GeneratedImage model**

In the existing `GeneratedImage` model:
1. Make `data` optional: change `data Bytes` to `data Bytes?` (required for export-to-gallery — Lab exports create `GeneratedImage` with only `r2Key`, no blob data)
2. Add `r2Key`: add `r2Key String?` field

```prisma
model GeneratedImage {
  // ... existing fields
  data    Bytes?  // CHANGED from required to optional — Lab exports use r2Key instead
  r2Key   String? // NEW — R2 object key, used instead of `data` when available
}
```

- [ ] **Step 9: Add relation fields to existing models**

Add `experiments Experiment[]` to the `Project` model.
Add `experiments Experiment[]` to the `BrandIdentity` model.
Add `exports RunExport[]` to the `GeneratedPost` model.

- [ ] **Step 10: Run migration**

```bash
bunx prisma migrate dev --name add-lab-models
```

- [ ] **Step 11: Verify migration and generate client**

```bash
bunx prisma generate
```

- [ ] **Step 12: Commit**

```bash
git add prisma/
git commit -m "feat(lab): add Experiment, Run, RunConcept, ImageVariation, CaptionVariation, RunExport models"
```

---

## Task 2: Lab tRPC Router — Experiment CRUD

**Files:**
- Create: `src/lib/trpc/routers/lab.ts`
- Modify: `src/lib/trpc/router.ts`

- [ ] **Step 1: Create lab router with experiment CRUD**

Create `src/lib/trpc/routers/lab.ts` with these procedures:

- `listExperiments` — query: fetch all experiments for project + org, include `_count.runs` and best-rated image thumbnail (join through runs → concepts → imageVariations where rating is highest, get r2Key). Order by `updatedAt desc`.
- `getExperiment` — query: by id, verify orgId, include runs list (id, runNumber, status, scope, parentRunId, createdAt).
- `createExperiment` — mutation: input `{ name: string, projectId: string, brandIdentityId?: string }`. Create with orgId from ctx.
- `updateExperiment` — mutation: input `{ id: string, name?: string, brandIdentityId?: string }`. Verify orgId ownership.
- `deleteExperiment` — mutation: input `{ id: string }`. Query all ImageVariation r2Keys first, then delete experiment (cascade), then batch-delete R2 objects. Log R2 failures as warnings.

Use `orgProtectedProcedure` for all. Follow the pattern from `style.ts` (zod input validation, org verification, error handling).

- [ ] **Step 2: Register lab router**

In `src/lib/trpc/router.ts`, add:

```typescript
import { labRouter } from "./routers/lab";

export const appRouter = router({
  // ...existing
  lab: labRouter,
});
```

- [ ] **Step 3: Verify by starting dev server**

```bash
bun dev
```

Check that the app starts without errors. The tRPC endpoint at `/api/trpc/lab.listExperiments` should be reachable (will return empty array or auth error, both fine).

- [ ] **Step 4: Commit**

```bash
git add src/lib/trpc/routers/lab.ts src/lib/trpc/router.ts
git commit -m "feat(lab): add lab tRPC router with experiment CRUD"
```

---

## Task 3: Lab tRPC Router — Run CRUD + Settings

**Files:**
- Modify: `src/lib/trpc/routers/lab.ts`

- [ ] **Step 1: Add run procedures**

Add to lab router:

- `createRun` — mutation: input `{ experimentId: string, settingsSnapshot: RunSettingsSchema }`. Auto-increment `runNumber` by querying max runNumber for the experiment. Set status `configuring`, scope `full`. Verify experiment belongs to org.
- `updateRunSettings` — mutation: input `{ runId: string, settingsSnapshot: RunSettingsSchema }`. Only allowed when status is `configuring`. Verify org ownership through experiment.
- `getRun` — query: input `{ runId: string }`. Return run with concepts, imageVariations (id, variationNumber, status, r2Key, mimeType, rating, ratingComment), captionVariations (id, variationNumber, status, text, rating, ratingComment). Verify org.
- `getRunConcepts` — query: input `{ runId: string, conceptId?: string }`. If conceptId provided, return that concept with all variations. Otherwise return all concepts with variation counts only (not full data). This is the on-demand data fetch for the Results tab.
- `deleteRun` — mutation: input `{ runId: string }`. Query r2Keys first, delete run (cascade), delete R2 objects.
- `cancelRun` — mutation: input `{ runId: string }`. Set status to `cancelled`. The background generation loop checks this.

Define Zod schema for `settingsSnapshot`:

```typescript
const runSettingsSchema = z.object({
  contentPrompt: z.string().nullable(),
  contentIdeaId: z.string().nullable(),
  contentSourceId: z.string().nullable(),
  assetIds: z.array(z.string()),
  imageStyleId: z.string().nullable(),
  captionStyleId: z.string().nullable(),
  model: z.enum(["nano-banana-2", "nano-banana-pro"]),
  aspectRatio: z.enum(["3:4", "1:1", "4:5", "9:16"]),
  colorOverride: z.object({ accent: z.string(), bg: z.string() }).nullable(),
  conceptCount: z.number().int().min(1).max(20),
  imageVariations: z.number().int().min(1).max(20),
  captionVariations: z.number().int().min(1).max(20),
});
```

- [ ] **Step 2: Verify dev server starts**

```bash
bun dev
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/trpc/routers/lab.ts
git commit -m "feat(lab): add run CRUD, settings schema, cancel, delete with R2 cleanup"
```

---

## Task 4a: Lab tRPC Router — Outline Generation + Record Creation

**Files:**
- Modify: `src/lib/trpc/routers/lab.ts`

- [ ] **Step 1: Add outline generation helper**

Add a private helper function `generateOutlines` at the top of the file (outside the router):
- Takes content prompt/idea/source + concept count N
- Calls `geminiText.generateContent()` with a prompt asking for N distinct Instagram post concepts
- Each concept returns: `{ slides: [{ imagePrompt, layoutNotes }], caption }`
- Parses JSON response, returns array of N outlines
- Follow the prompt pattern from the existing `generation.generateOutline` procedure in `generation.ts`

- [ ] **Step 2: Add prompt builder helpers**

Add two helper functions:

`buildImagePrompt(basePrompt, style, colorOverride, variationNumber, totalVariations)`:
- Start with the concept's base `imagePrompt` from the outline
- Append the image style's `promptText` (fetched by caller)
- Append brand colors if `colorOverride` is set
- Append diversity hint: `"Variation ${n} of ${M} — explore different compositions, angles, and lighting"`
- Append logo instructions if brand identity has a logo (same pattern as existing `generation.ts`)

`buildCaptionPrompt(baseCaptionText, captionStyle, variationNumber, totalVariations)`:
- Start with the concept's `caption` from the outline
- Append caption style's `promptText`
- Append instruction: `"Write an Instagram caption. Include relevant hashtags."`
- Append diversity hint for variation

- [ ] **Step 3: Add startGeneration mutation — record creation only**

`startGeneration` — mutation: input `{ runId: string }`.

Synchronous part (runs before returning):
1. Verify run belongs to org, status is `configuring`
2. Read settingsSnapshot from the run
3. Fetch referenced style(s) and brand identity
4. Set run status to `generating`
5. Generate N outlines via the helper
6. Create N `RunConcept` records with frozen outlines + resolved image/caption prompts
7. For each concept, create M `ImageVariation` records + K `CaptionVariation` records (all status: `generating`), each with their resolved prompt (using the builder helpers)
8. Return `{ runId }` immediately

Do NOT add the background generation yet — that's Task 4b.

- [ ] **Step 4: Verify dev server starts**

```bash
bun dev
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/trpc/routers/lab.ts
git commit -m "feat(lab): add outline generation, prompt builders, and startGeneration record creation"
```

---

## Task 4b: Lab tRPC Router — Background Generation with Concurrency

**Files:**
- Modify: `src/lib/trpc/routers/lab.ts`
- Modify: `package.json`

- [ ] **Step 1: Install p-limit**

```bash
bun add p-limit
```

Note: Use p-limit v6+ (ESM-native). If there are issues, implement a simple semaphore function instead.

- [ ] **Step 2: Add retry helper**

Add a `withRetry` helper function:
```typescript
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
```

- [ ] **Step 3: Add background generation loop to startGeneration**

After the record creation in `startGeneration` (from Task 4a), add the fire-and-forget background job. Note: the background closure captures `ctx.prisma` which remains valid after the request returns (same pattern as existing `generation.ts` and `style.ts`).

```typescript
void (async () => {
  const pLimit = (await import("p-limit")).default;
  const imageLimit = pLimit(5);
  const captionLimit = pLimit(10);

  const allJobs: Promise<void>[] = [];

  for (const concept of createdConcepts) {
    // Image variations
    for (const imgVar of concept.imageVariations) {
      allJobs.push(imageLimit(async () => {
        // Check cancellation before each job
        const run = await ctx.prisma.run.findUnique({ where: { id: runId }, select: { status: true } });
        if (run?.status === "cancelled") return;

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
        const run = await ctx.prisma.run.findUnique({ where: { id: runId }, select: { status: true } });
        if (run?.status === "cancelled") return;

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
```

**Note on serverless timeouts:** This fire-and-forget pattern matches existing conventions (`generation.ts`, `style.ts`). For production at large scales (100+ images), a queue-based approach may be needed, but this is acceptable for the initial implementation.

- [ ] **Step 4: Verify dev server starts**

```bash
bun dev
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/trpc/routers/lab.ts package.json bun.lock
git commit -m "feat(lab): add background generation with p-limit concurrency, retries, cancellation checks"
```

---

## Task 5: Lab tRPC Router — Progress, Rating, Re-run

**Files:**
- Modify: `src/lib/trpc/routers/lab.ts`

- [ ] **Step 1: Add progress polling endpoint**

`runProgress` — query: input `{ runId: string }`. Returns lightweight status counts:

```typescript
// For each concept, count variations by status
const concepts = await ctx.prisma.runConcept.findMany({
  where: { runId, run: { orgId: ctx.orgId } },
  select: {
    id: true,
    conceptNumber: true,
    imageVariations: { select: { status: true } },
    captionVariations: { select: { status: true } },
  },
});

return concepts.map(c => ({
  conceptId: c.id,
  conceptNumber: c.conceptNumber,
  images: {
    generating: c.imageVariations.filter(v => v.status === "generating").length,
    completed: c.imageVariations.filter(v => v.status === "completed").length,
    failed: c.imageVariations.filter(v => v.status === "failed").length,
  },
  captions: {
    generating: c.captionVariations.filter(v => v.status === "generating").length,
    completed: c.captionVariations.filter(v => v.status === "completed").length,
    failed: c.captionVariations.filter(v => v.status === "failed").length,
  },
}));
```

- [ ] **Step 2: Add rating endpoints**

`rateImageVariation` — mutation: input `{ variationId: string, rating: z.number().int().min(1).max(5), comment?: string }`. Verify org ownership through concept → run → experiment. Update `rating` and `ratingComment`.

`rateCaptionVariation` — same pattern for caption variations.

- [ ] **Step 3: Add re-run (tweak) endpoint**

`rerun` — mutation: input `{ sourceRunId: string, scope: "full" | "batch" | "single", tweaks: Partial<RunSettingsSchema>, sourceVariationId?: string, sourceVariationType?: "image" | "caption" }`.

Flow:
1. Fetch source run's settingsSnapshot
2. Merge tweaks over snapshot
3. Create new Run with `parentRunId` = sourceRunId, merged settings, appropriate scope
4. Auto-increment runNumber
5. If scope is `single`: create 1 concept with 1 variation (image or caption based on sourceVariationType)
6. If scope is `batch`: create 1 concept with M images or K captions
7. If scope is `full`: behave like `startGeneration`
8. Kick off background generation (reuse the same pattern from Task 4)
9. Return new run

- [ ] **Step 4: Add retry single variation endpoint**

`retryVariation` — mutation: input `{ variationId: string, type: "image" | "caption" }`. Re-generate just this one failed variation. Reset status to `generating`, run the generation, update.

- [ ] **Step 5: Verify dev server starts**

```bash
bun dev
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/trpc/routers/lab.ts
git commit -m "feat(lab): add progress polling, rating, re-run, retry endpoints"
```

---

## Task 6: Lab tRPC Router — Export to Gallery

**Files:**
- Modify: `src/lib/trpc/routers/lab.ts`
- Modify: `src/app/api/images/[id]/route.ts`

- [ ] **Step 1: Add export endpoint**

`exportToGallery` — mutation: input `{ exports: [{ conceptId: string, imageVariationId: string, captionVariationId: string }] }`.

For each export entry:
1. Verify all IDs belong to the same experiment and org
2. Verify `imageVariationId` and `captionVariationId` belong to the same `conceptId` (enforces same-concept pairing per spec)
3. Fetch the ImageVariation (get r2Key) and CaptionVariation (get text)
4. Create a `GeneratedPost` with status `completed`, description = caption text, platform = `instagram`, orgId from ctx
5. Create a `GeneratedImage` with `r2Key` pointing to the Lab image (no `data` blob — field is now optional), `mimeType` from variation, linked to the new post
6. Create a `RunExport` record with `generatedPostId` set to the newly created post's ID
7. Return the created post IDs

- [ ] **Step 2: Update image serving endpoint for r2Key**

In `src/app/api/images/[id]/route.ts`, modify the `type === "generated"` branch:

```typescript
if (type === "generated") {
  const image = await prisma.generatedImage.findUnique({ where: { id } });
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // NEW: Prefer R2 if available
  if (image.r2Key) {
    const r2Url = publicUrl(image.r2Key);
    return NextResponse.redirect(r2Url, 302);
    // Or fetch from R2 and return bytes if redirect isn't suitable
  }

  // Legacy fallback: serve from DB bytes
  data = Buffer.from(image.data);
  mimeType = image.mimeType;
}
```

- [ ] **Step 3: Verify dev server starts**

```bash
bun dev
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/trpc/routers/lab.ts src/app/api/images/
git commit -m "feat(lab): add export to gallery endpoint, update image serving for r2Key"
```

---

## Task 7: Hooks + Store

**Files:**
- Create: `src/hooks/use-lab.ts`
- Create: `src/stores/use-lab-store.ts`

- [ ] **Step 1: Create Zustand store**

`src/stores/use-lab-store.ts`:

```typescript
import { create } from "zustand";

interface LabState {
  selectedRunId: string | null;
  activeTab: "configure" | "results" | "export";
  comparisonMode: boolean;
  comparisonRunIds: [string, string] | null;

  selectRun: (runId: string | null) => void;
  setActiveTab: (tab: LabState["activeTab"]) => void;
  toggleComparisonMode: () => void;
  setComparisonRuns: (ids: [string, string] | null) => void;
  reset: () => void;
}

export const useLabStore = create<LabState>((set) => ({
  selectedRunId: null,
  activeTab: "configure",
  comparisonMode: false,
  comparisonRunIds: null,

  selectRun: (runId) => set({ selectedRunId: runId }),
  setActiveTab: (activeTab) => set({ activeTab }),
  toggleComparisonMode: () =>
    set((s) => ({ comparisonMode: !s.comparisonMode, comparisonRunIds: null })),
  setComparisonRuns: (comparisonRunIds) => set({ comparisonRunIds }),
  reset: () =>
    set({ selectedRunId: null, activeTab: "configure", comparisonMode: false, comparisonRunIds: null }),
}));
```

- [ ] **Step 2: Create hooks file**

`src/hooks/use-lab.ts` — follow the pattern from `use-styles.ts`:

Queries:
- `useExperiments(projectId)` — `trpc.lab.listExperiments.queryOptions({ projectId })`
- `useExperiment(id)` — `trpc.lab.getExperiment.queryOptions({ id })`
- `useRun(runId)` — `trpc.lab.getRun.queryOptions({ runId })`
- `useRunConcepts(runId, conceptId?)` — `trpc.lab.getRunConcepts.queryOptions({ runId, conceptId })`
- `useRunProgress(runId, enabled)` — `trpc.lab.runProgress.queryOptions({ runId })` with `refetchInterval: 2000` when `enabled` is true

Mutations:
- `useCreateExperiment()` — with optimistic update on experiments list
- `useDeleteExperiment()` — with optimistic removal
- `useCreateRun()` — invalidates experiment query
- `useStartGeneration()` — returns runId, switches tab to results
- `useCancelRun()` — optimistic status update
- `useRateImageVariation()` — optimistic rating update
- `useRateCaptionVariation()` — optimistic rating update
- `useRerun()` — invalidates experiment query (new run appears)
- `useRetryVariation()` — optimistic status reset
- `useExportToGallery()` — returns post IDs
- `useDeleteRun()` — optimistic removal from run list

- [ ] **Step 3: Verify types compile**

```bash
bunx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-lab.ts src/stores/use-lab-store.ts
git commit -m "feat(lab): add Lab hooks and Zustand store"
```

---

## Task 8: Sidebar Navigation + Experiments List Page

**Files:**
- Modify: sidebar/navigation component (find exact file with project nav items)
- Create: `src/app/(roks-workspace)/dashboard/projects/[id]/lab/page.tsx`
- Create: `src/components/lab/experiment-card.tsx`

- [ ] **Step 1: Add Lab to project sidebar**

In `src/components/nav-active-project.tsx`, add a "Lab" entry to the `subPages` array (around line 26). Use `TestTubeDiagonal` icon from lucide-react (not `FlaskConical` — that's already used for Campaigns). URL pattern: `/dashboard/projects/${projectId}/lab`.

- [ ] **Step 2: Create experiment card component**

`src/components/lab/experiment-card.tsx` — a card showing:
- Experiment name (editable inline on double-click or via edit button)
- Run count badge
- Creation date (relative, e.g., "2 days ago")
- Best-rated image thumbnail (from the query data, show as small preview)
- Delete button (with confirmation via AlertDialog)
- Click navigates to `/dashboard/projects/${projectId}/lab/${experimentId}`

Use shadcn `Card`, `Badge`, `Button`, `AlertDialog`. Follow `style-card.tsx` patterns.

- [ ] **Step 3: Create experiments list page**

`src/app/(roks-workspace)/dashboard/projects/[id]/lab/page.tsx`:

```typescript
"use client";

import { use } from "react";
import { useExperiments, useCreateExperiment, useDeleteExperiment } from "@/hooks/use-lab";
// ... shadcn imports

export default function LabPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const { data: experiments, isLoading } = useExperiments(projectId);
  const createExperiment = useCreateExperiment();
  // Create dialog state, form handling

  // Skeleton loading state
  // Empty state with CTA
  // Grid of ExperimentCards
  // "New Experiment" dialog (name + optional brand identity picker)
}
```

- [ ] **Step 4: Verify in browser**

```bash
bun dev
```

Navigate to a project, click Lab in sidebar, verify the empty state renders. Create an experiment, verify it appears.

- [ ] **Step 5: Commit**

```bash
git add src/components/lab/ src/app/(roks-workspace)/dashboard/projects/ src/components/nav-*.tsx
git commit -m "feat(lab): add experiments list page with sidebar navigation"
```

---

## Task 9: Experiment Workspace Layout + Configure Tab

**Files:**
- Create: `src/app/(roks-workspace)/dashboard/projects/[id]/lab/[experimentId]/page.tsx`
- Create: `src/components/lab/run-sidebar.tsx`
- Create: `src/components/lab/configure-tab.tsx`
- Create: `src/components/lab/cost-estimate.tsx`

- [ ] **Step 1: Create run sidebar component**

`src/components/lab/run-sidebar.tsx`:
- Fetches runs from `useExperiment(experimentId)`
- Lists runs with: `Run #N` label, status badge (color-coded), scope badge for non-full runs
- Runs with `parentRunId` show "from Run #X" in muted text
- Selected run highlighted
- "New Run" button at top
- In comparison mode: checkboxes instead of click-to-select, max 2 selectable
- Delete run button (with confirmation)

- [ ] **Step 2: Create cost estimate component**

`src/components/lab/cost-estimate.tsx`:
- Takes `{ model, conceptCount, imageVariations, captionVariations }` as props
- Computes estimated cost and time
- Displays as a small info card: "~$1.50 • ~45s estimated"

- [ ] **Step 3: Create configure tab**

`src/components/lab/configure-tab.tsx`:
- Content source section: textarea for prompt, or buttons to select from existing ideas/sources (reuse existing idea/source pickers if available, or simple select dropdowns)
- Style pickers: image style dropdown + caption style dropdown (use `useStyles()` hook, filter by kind)
- Variation counts: three number inputs (N, M, K) with labels and min/max constraints
- Model toggle: Flash / Pro (radio group or toggle)
- Aspect ratio: segmented control (3:4, 1:1, 4:5, 9:16)
- Color override: optional, with accent + bg color pickers (use existing pattern if available)
- Cost estimate component at bottom
- "Generate" button — calls `useStartGeneration()`, which calls `startGeneration` mutation

Use shadcn: `Input`, `Textarea`, `Select`, `RadioGroup`, `Button`, `Label`, `Separator`.

- [ ] **Step 4: Create workspace page**

`src/app/(roks-workspace)/dashboard/projects/[id]/lab/[experimentId]/page.tsx`:
- Split layout: `RunSidebar` on left (fixed width ~280px), main area on right
- Main area has `Tabs` component with Configure / Results / Export
- Tab state managed by `useLabStore.activeTab`
- When no run is selected, show "Select a run or create a new one"
- "New Run" creates a run via `useCreateRun()` and selects it

```typescript
"use client";

import { use } from "react";
import { useExperiment } from "@/hooks/use-lab";
import { useLabStore } from "@/stores/use-lab-store";
import { RunSidebar } from "@/components/lab/run-sidebar";
import { ConfigureTab } from "@/components/lab/configure-tab";
// ...

export default function ExperimentWorkspacePage({
  params,
}: {
  params: Promise<{ id: string; experimentId: string }>;
}) {
  const { id: projectId, experimentId } = use(params);
  const { data: experiment, isLoading } = useExperiment(experimentId);
  const { selectedRunId, activeTab, setActiveTab } = useLabStore();
  // ...
}
```

- [ ] **Step 5: Verify in browser**

Navigate to an experiment, verify layout renders. Create a new run, fill in the configure form. Don't generate yet.

- [ ] **Step 6: Commit**

```bash
git add src/app/(roks-workspace)/dashboard/projects/ src/components/lab/
git commit -m "feat(lab): add experiment workspace layout with run sidebar and configure tab"
```

---

## Task 10: Results Tab — Variation Grids + Rating

**Files:**
- Create: `src/components/lab/results-tab.tsx`
- Create: `src/components/lab/image-variation-card.tsx`
- Create: `src/components/lab/caption-variation-card.tsx`
- Create: `src/components/lab/star-rating.tsx`

- [ ] **Step 1: Create star rating component**

`src/components/lab/star-rating.tsx`:
- Props: `value: number | null`, `onChange: (rating: number) => void`, `size?: "sm" | "md"`
- Renders 5 star icons (lucide `Star`)
- Filled stars up to the rating value, empty for the rest
- Hover preview (highlight stars on hover)
- Click to set rating, click same rating to clear
- Small and inline — no modal or popover

- [ ] **Step 2: Create image variation card**

`src/components/lab/image-variation-card.tsx`:
- Props: `variation: ImageVariation`, `onRate`, `onEdit`
- Shows image thumbnail from R2 URL (`publicUrl(variation.r2Key)`)
- Click to expand in a Dialog with full-size image
- Star rating below the thumbnail
- Comment icon — click to expand inline textarea, saves on blur
- "Edit & Re-run" button (small, icon-based)
- Loading skeleton when status is `generating`
- Error state with retry button when status is `failed`

- [ ] **Step 3: Create caption variation card**

`src/components/lab/caption-variation-card.tsx`:
- Props: `variation: CaptionVariation`, `onRate`, `onEdit`
- Shows caption text in a card
- Star rating below
- Comment inline textarea (same pattern)
- "Edit & Re-run" button
- Loading/error states

- [ ] **Step 4: Create results tab**

`src/components/lab/results-tab.tsx`:
- Uses `useRunProgress(runId, isGenerating)` for live progress
- Uses `useRunConcepts(runId, selectedConceptId)` for variation data
- Concept selector at top: tabs or segmented control for Concept 1, 2, ..., N
- Each concept tab has progress bar when generating: "7/10 images • 4/10 captions"
- Below: two sections with headers "Images" and "Captions"
- Image section: responsive grid of `ImageVariationCard` components
- Caption section: responsive grid of `CaptionVariationCard` components
- Default sort: rated highest first, then unrated, failed at bottom
- When run status is `generating`, show cancel button in header

- [ ] **Step 5: Verify in browser**

Create a small test run (1 concept, 2 images, 2 captions) and hit Generate. Watch progress update in Results tab. Rate some variations.

- [ ] **Step 6: Commit**

```bash
git add src/components/lab/
git commit -m "feat(lab): add results tab with image/caption variation grids and star rating"
```

---

## Task 11: Pipeline Tweaker Drawer

**Files:**
- Create: `src/components/lab/pipeline-tweaker.tsx`

- [ ] **Step 1: Create pipeline tweaker**

`src/components/lab/pipeline-tweaker.tsx`:
- Opens as a `Sheet` (shadcn drawer) from the right
- Props: `variationId: string`, `variationType: "image" | "caption"`, `runId: string`, `onClose`
- Fetches the variation's parent concept + run to get the full pipeline snapshot
- Displays all editable fields:
  - Outline text (editable textarea)
  - Image prompt or caption prompt (editable textarea, depending on variation type)
  - Style (Select dropdown, from `useStyles()`)
  - Model (radio: Flash / Pro)
  - Aspect ratio (segmented control)
  - Color override (optional color pickers)
  - Variation count for re-run (number input)
- Scope control: RadioGroup with three options:
  - "Just this one" → scope `single`
  - "New batch" → scope `batch`
  - "Full re-run" → scope `full`
- "Re-generate" button — calls `useRerun()` with the tweaked settings
- Shows diff from original: highlight fields that differ from the source run's snapshot (compare current form values to `settingsSnapshot`)

- [ ] **Step 2: Wire up "Edit & Re-run" buttons in variation cards**

In `image-variation-card.tsx` and `caption-variation-card.tsx`, the `onEdit` prop opens the Pipeline Tweaker with the variation's data.

Manage the drawer open state + selected variation in the results tab or workspace page level.

- [ ] **Step 3: Verify in browser**

Click "Edit & Re-run" on a variation. Tweaker opens with pre-filled values. Change a prompt, select "Just this one", hit Re-generate. New run appears in sidebar.

- [ ] **Step 4: Commit**

```bash
git add src/components/lab/
git commit -m "feat(lab): add pipeline tweaker drawer with scope control and re-run"
```

---

## Task 12: Export Tab

**Files:**
- Create: `src/components/lab/export-tab.tsx`

- [ ] **Step 1: Create export tab**

`src/components/lab/export-tab.tsx`:
- Per concept section (accordion or tabs matching the Results tab concept selector)
- Within each concept:
  - Image picker: thumbnail grid of all completed images, selectable (radio — pick one). Pre-select highest rated.
  - Caption picker: text card grid of all completed captions, selectable (radio — pick one). Pre-select highest rated.
  - Preview: assembled post showing selected image + selected caption below it, styled like an Instagram post preview
- Bottom: "Export to Gallery" button
  - Calls `useExportToGallery()` with the selected pairs
  - Shows success toast with link to Gallery
- "Export All" button: exports all concepts at once using their pre-selected (highest rated) winners

- [ ] **Step 2: Verify in browser**

Rate some variations, go to Export tab. Verify pre-selection of highest rated. Pick different ones. Export. Check Gallery page shows the exported posts.

- [ ] **Step 3: Commit**

```bash
git add src/components/lab/
git commit -m "feat(lab): add export tab with winner assembly and gallery bridge"
```

---

## Task 13: Cross-Run Comparison

**Files:**
- Create: `src/components/lab/run-comparison.tsx`
- Modify: `src/components/lab/run-sidebar.tsx`

- [ ] **Step 1: Add comparison mode to run sidebar**

In `run-sidebar.tsx`:
- Add a "Compare" toggle button in the sidebar header
- When comparison mode is on (from `useLabStore`), render checkboxes next to runs instead of click-to-select
- Max 2 runs selectable (disable further checkboxes after 2)
- When 2 are selected, the main area switches to the comparison view

- [ ] **Step 2: Create comparison view**

`src/components/lab/run-comparison.tsx`:
- Props: `runId1: string`, `runId2: string`
- Fetches both runs' data
- Settings diff at top: show which settings differ between the two runs (highlight in amber/yellow)
- Concept-by-concept comparison: matched by `conceptNumber`
  - Side by side: Run A's top-rated image vs Run B's top-rated image
  - Side by side: Run A's top-rated caption vs Run B's top-rated caption
  - Show ratings for each
- If concept counts differ, note: "Run B has 2 fewer concepts — showing overlapping concepts only"

- [ ] **Step 3: Wire into workspace page**

When `useLabStore.comparisonMode` is true and 2 runs are selected, render `RunComparison` instead of the normal tabs.

- [ ] **Step 4: Verify in browser**

Create two runs with tweaked settings. Toggle comparison mode, select both. Verify side-by-side view.

- [ ] **Step 5: Commit**

```bash
git add src/components/lab/
git commit -m "feat(lab): add cross-run comparison view with settings diff"
```

---

## Task 14: Polish + Edge Cases

**Files:**
- Various lab components

- [ ] **Step 1: Loading states**

Ensure all pages/components have proper skeleton loading states:
- Experiments list: skeleton card grid
- Workspace: skeleton sidebar + skeleton main area
- Results: skeleton variation cards
- Use the existing skeleton component patterns from the project

- [ ] **Step 2: Empty states**

- No experiments: "No experiments yet. Create one to start testing."
- No runs in experiment: "Create a run to start generating variations."
- No variations yet (before generate): show the Configure tab automatically
- All variations failed: show error state with "Retry All" button

- [ ] **Step 3: Error handling**

- Toast errors for failed mutations (create, delete, generate, export)
- Inline error messages for form validation
- Handle stale data when navigating between experiments

- [ ] **Step 4: Keyboard shortcuts**

- `Escape` closes the pipeline tweaker drawer
- Arrow keys navigate between variations in the grid (nice to have, skip if complex)

- [ ] **Step 5: Verify full flow end-to-end**

1. Create experiment
2. Create run with 3 concepts, 3 images, 3 captions
3. Generate
4. Watch progress
5. Rate variations
6. Edit & Re-run one variation
7. Compare original and tweaked runs
8. Export winners to Gallery
9. Verify exported posts in Gallery

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat(lab): polish loading states, empty states, error handling"
```
