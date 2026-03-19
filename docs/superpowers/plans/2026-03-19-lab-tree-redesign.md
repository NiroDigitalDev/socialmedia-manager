# Lab Tree Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the batch-based Lab (Experiment/Run/Variations) with a tree/node graph pipeline where each generation layer is a visual node — Sources → Ideas → Outlines → Images → Captions → Posts.

**Architecture:** New `LabTree` + `LabNode` data model with self-referential tree via `parentId`. React Flow canvas for visualization with elkjs auto-layout. tRPC router handles per-layer generation, prompt editing, AI tweaking, and export. Detail panel for node inspection/editing.

**Tech Stack:** Prisma, tRPC v11, Zustand, React Flow (`@xyflow/react`), elkjs, Gemini AI, Cloudflare R2, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-19-lab-tree-redesign.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/trpc/routers/lab.ts` | Rewritten: tree CRUD, node CRUD, per-layer generation (5 endpoints), AI prompt tweaking, export, cancellation |
| `src/hooks/use-lab.ts` | Rewritten: hooks for tree + node queries/mutations |
| `src/stores/use-lab-store.ts` | Rewritten: selected node, panel open, hidden toggle, multi-select |
| `src/app/(roks-workspace)/dashboard/projects/[id]/lab/page.tsx` | Tree list page (minor update from experiment to tree) |
| `src/app/(roks-workspace)/dashboard/projects/[id]/lab/[treeId]/page.tsx` | Full-screen canvas page |
| `src/components/lab/canvas.tsx` | React Flow canvas wrapper with elkjs layout |
| `src/components/lab/layout.ts` | elkjs layout computation (extracted for testability) |
| `src/components/lab/nodes/lab-node-card.tsx` | Base node card wrapper (color border, rating, chevron, badge) |
| `src/components/lab/nodes/source-node.tsx` | Custom React Flow node for source layer |
| `src/components/lab/nodes/idea-node.tsx` | Custom React Flow node for idea layer |
| `src/components/lab/nodes/outline-node.tsx` | Custom React Flow node for outline layer |
| `src/components/lab/nodes/image-node.tsx` | Custom React Flow node for image layer |
| `src/components/lab/nodes/caption-node.tsx` | Custom React Flow node for caption layer |
| `src/components/lab/nodes/post-node.tsx` | Custom React Flow node for derived posts |
| `src/components/lab/detail-panel.tsx` | Right-side detail panel (output, prompts, actions) |
| `src/components/lab/detail-panel-prompts.tsx` | Collapsible prompt editing section |
| `src/components/lab/detail-panel-actions.tsx` | Actions section (rating, generate, duplicate, delete) |
| `src/components/lab/layer-nav.tsx` | Top layer navigation breadcrumb bar |
| `src/components/lab/floating-action-bar.tsx` | Multi-select batch generation bar |
| `src/components/lab/tree-card.tsx` | Tree card for list view |
| `src/components/lab/source-upload-dialog.tsx` | Dialog for creating source nodes (paste/upload/link) |
| `src/components/lab/generate-popover.tsx` | Count input popover for generation |
| `src/components/lab/thumbs-rating.tsx` | Thumbs up/down component |

### Modified Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Drop old Lab models (Experiment, Run, RunConcept, ImageVariation, CaptionVariation, RunExport + enums), add LabTree + LabNode + new enums |
| `src/lib/trpc/router.ts` | Already registered — lab router stays, content changes |
| `src/components/nav-active-project.tsx` | No change — Lab nav item already exists |

### Deleted Files

All current `src/components/lab/*` files (11 files) — replaced entirely.

---

## Task 1: Schema Migration — Drop Old, Add New

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Remove old Lab enums**

Remove `RunStatus`, `RunScope`, `VariationStatus` enums.

- [ ] **Step 2: Remove old Lab models**

Remove models: `RunExport`, `CaptionVariation`, `ImageVariation`, `RunConcept`, `Run`, `Experiment`. Also remove the corresponding relation fields from `Project`, `BrandIdentity`, and `GeneratedPost` models.

- [ ] **Step 3: Add new enums**

```prisma
enum LabNodeLayer {
  source
  idea
  outline
  image
  caption
}

enum LabNodeStatus {
  pending
  generating
  completed
  failed
}

enum LabNodeRating {
  up
  down
}
```

- [ ] **Step 4: Add LabTree model**

```prisma
model LabTree {
  id              String         @id @default(cuid())
  name            String
  projectId       String
  orgId           String
  brandIdentityId String?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  project         Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  brandIdentity   BrandIdentity? @relation(fields: [brandIdentityId], references: [id], onDelete: SetNull)
  nodes           LabNode[]

  @@index([orgId])
  @@index([projectId])
}
```

Add `labTrees LabTree[]` relation to `Project` and `BrandIdentity`.

- [ ] **Step 5: Add LabNode model**

```prisma
model LabNode {
  id              String          @id @default(cuid())
  treeId          String
  parentId        String?
  layer           LabNodeLayer
  status          LabNodeStatus   @default(pending)
  output          Json?
  systemPrompt    String?         @db.Text
  contentPrompt   String?         @db.Text
  ancestorContext Json?
  rating          LabNodeRating?
  ratingComment   String?
  r2Key           String?
  mimeType        String?
  fileName        String?
  orgId           String
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  tree            LabTree         @relation(fields: [treeId], references: [id], onDelete: Cascade)
  parent          LabNode?        @relation("NodeTree", fields: [parentId], references: [id], onDelete: Cascade)
  children        LabNode[]       @relation("NodeTree")

  @@index([treeId])
  @@index([treeId, layer])
  @@index([parentId])
  @@index([orgId])
}
```

- [ ] **Step 6: Clean up R2 objects from old Lab data**

Before running the migration, query all `ImageVariation.r2Key` values and batch-delete from R2. Use a script or do it in the migration SQL.

- [ ] **Step 7: Run migration**

```bash
# Create migration SQL manually (prisma migrate dev has issues with this project's migration history)
# Apply via prisma db execute + prisma migrate resolve
bunx prisma generate
```

- [ ] **Step 8: Delete old Lab component files**

```bash
rm -rf src/components/lab/
mkdir -p src/components/lab/nodes
```

- [ ] **Step 9: Commit**

```bash
git add prisma/ src/components/lab/
git commit -m "feat(lab): replace Experiment/Run models with LabTree + LabNode tree structure"
```

---

## Task 2: Lab tRPC Router — Tree + Node CRUD

**Files:**
- Rewrite: `src/lib/trpc/routers/lab.ts`

- [ ] **Step 1: Rewrite lab router with tree CRUD**

Start fresh. Create the router with these procedures:

**Tree procedures:**
- `listTrees` — query: input `{ projectId }`. Fetch all trees for project + org, include node counts per layer. Order by `updatedAt desc`.
- `getTree` — query: input `{ treeId }`. Fetch tree with ALL nodes (id, parentId, layer, status, output, rating, r2Key, mimeType, fileName, systemPrompt, contentPrompt). Verify org. This is the full tree load for the canvas.
- `createTree` — mutation: input `{ name, projectId, brandIdentityId? }`. Create with orgId from ctx.
- `updateTree` — mutation: input `{ treeId, name?, brandIdentityId? }`. Verify org.
- `deleteTree` — mutation: input `{ treeId }`. Collect all r2Keys from nodes, delete tree (cascade), batch-delete R2 objects.

**Node procedures:**
- `createSourceNode` — mutation: input `{ treeId, text?: string, r2Key?: string, fileName?: string }`. Creates a source node with `status = "completed"`, output = `{ text }`.
- `updateNode` — mutation: input `{ nodeId, systemPrompt?, contentPrompt?, rating?, ratingComment? }`. Verify org through tree. For prompt edits only — does not regenerate.
- `duplicateNode` — mutation: input `{ nodeId }`. Creates sibling with same parent, layer, prompts. Status = `pending`, no output.
- `deleteNode` — mutation: input `{ nodeId }`. Collect r2Keys from node + subtree, delete (cascade), R2 cleanup.
- `rateNode` — mutation: input `{ nodeId, rating: "up" | "down", comment? }`. Update rating + ratingComment.
- `treeProgress` — query: input `{ treeId }`. Return only nodes with `status = "generating"` or `updatedAt` within last 5 seconds.

- [ ] **Step 2: Register router** (already registered, just verify after rewrite)

- [ ] **Step 3: Verify dev server starts**

```bash
bun dev
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/trpc/routers/lab.ts
git commit -m "feat(lab): rewrite lab router with LabTree + LabNode CRUD"
```

---

## Task 3: Lab tRPC Router — Per-Layer Generation

**Files:**
- Modify: `src/lib/trpc/routers/lab.ts`

- [ ] **Step 1: Add ancestor context builder**

Helper function `buildAncestorContext(prisma, node)`:
- Walks up the `parentId` chain
- Returns a Json snapshot based on the node's layer (as defined in the spec)
- For caption nodes, includes image description (either from output or a brief Gemini vision call)

- [ ] **Step 2: Add generation endpoints**

Five generation procedures, one per layer transition:

**`generateIdeas`** — mutation: input `{ sourceNodeId, count, systemPrompt? }`.
- Fetch source node, verify org
- Build system prompt (user-provided or default template)
- Build content prompt from source's output text
- Call Gemini for N ideas
- Create N idea LabNodes with parentId=sourceNodeId, status=generating → completed
- Store ancestorContext `{ sourceText }`
- Fire-and-forget with p-limit(10)

**`generateOutlines`** — mutation: input `{ ideaNodeId, count, systemPrompt? }`.
- Similar pattern. Content = idea text. Returns structured outline JSON.
- ancestorContext: `{ sourceText, ideaText }`

**`generateImages`** — mutation: input `{ outlineNodeId, count, systemPrompt? }`.
- Build image prompt from outline slides + layout notes + brand/style info from tree's brandIdentity
- Call `generateImage()` from gemini.ts, upload to R2 at `lab/{nodeId}/original.{ext}`
- p-limit(5) for image concurrency
- ancestorContext: `{ ideaText, outlineSlides }`

**`generateCaptions`** — mutation: input `{ imageNodeId, count, systemPrompt? }`.
- Walk up to get outline text from grandparent
- Content prompt = outline + image description
- p-limit(10) for text concurrency
- ancestorContext: `{ ideaText, outlineSlides, imageDescription }`

**`cancelGeneration`** — mutation: input `{ treeId, subtreeRootId? }`.
- Set all `generating` nodes in the subtree (or whole tree) to `failed`

All generation endpoints follow the same pattern:
1. Create N LabNode records with `status = "generating"`
2. Return the node IDs immediately
3. Fire-and-forget background generation with concurrency control + retries
4. Each job checks if node status is still `generating` before starting (cancellation check)

- [ ] **Step 3: Add batch generation endpoint**

**`generateBatch`** — mutation: input `{ nodeIds: string[], count, systemPrompt? }`.
- All nodes must be at the same layer
- For each node, calls the appropriate layer generation
- Returns all created child node IDs

- [ ] **Step 4: Add AI prompt tweaking endpoint**

**`tweakPrompt`** — mutation: input `{ currentPrompt: string, instruction: string }`.
- Calls Gemini: "Here is a prompt: [currentPrompt]. The user wants to: [instruction]. Return only the updated prompt text."
- Returns the updated prompt string

- [ ] **Step 5: Add export endpoint**

**`exportToGallery`** — mutation: input `{ posts: [{ captionNodeId }] }`.
- For each: fetch caption node (verify completed), fetch parent image node (verify completed + r2Key)
- Create GeneratedPost + GeneratedImage (r2Key, no blob)
- Return post IDs

- [ ] **Step 6: Verify dev server starts**

- [ ] **Step 7: Commit**

```bash
git add src/lib/trpc/routers/lab.ts
git commit -m "feat(lab): add per-layer generation, batch generation, AI tweaking, export, cancellation"
```

---

## Task 4: Hooks + Store

**Files:**
- Rewrite: `src/hooks/use-lab.ts`
- Rewrite: `src/stores/use-lab-store.ts`

- [ ] **Step 1: Rewrite Zustand store**

```typescript
interface LabStore {
  selectedNodeId: string | null;
  panelOpen: boolean;
  showHidden: boolean; // show thumbs-downed nodes
  multiSelectIds: string[];

  selectNode: (id: string | null) => void;
  togglePanel: () => void;
  toggleShowHidden: () => void;
  toggleMultiSelect: (id: string) => void;
  clearMultiSelect: () => void;
  reset: () => void;
}
```

- [ ] **Step 2: Rewrite hooks**

**Queries:**
- `useTrees(projectId)` — list trees
- `useTree(treeId)` — full tree with all nodes
- `useTreeProgress(treeId, enabled)` — poll generating nodes every 2s

**Mutations (with optimistic updates):**
- `useCreateTree()`, `useUpdateTree()`, `useDeleteTree()`
- `useCreateSourceNode()`, `useUpdateNode()`, `useDuplicateNode()`, `useDeleteNode()`
- `useRateNode()` — optimistic rating update
- `useGenerateIdeas()`, `useGenerateOutlines()`, `useGenerateImages()`, `useGenerateCaptions()`
- `useGenerateBatch()`
- `useCancelGeneration()`
- `useTweakPrompt()`
- `useExportToGallery()`

- [ ] **Step 3: Verify types compile**

```bash
bunx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-lab.ts src/stores/use-lab-store.ts
git commit -m "feat(lab): rewrite lab hooks and store for tree model"
```

---

## Task 5: Install Dependencies + Canvas Foundation

**Files:**
- Modify: `package.json`
- Create: `src/components/lab/layout.ts`
- Create: `src/components/lab/canvas.tsx`

- [ ] **Step 1: Install React Flow and elkjs**

```bash
bun add @xyflow/react elkjs
```

- [ ] **Step 2: Create layout computation module**

`src/components/lab/layout.ts`:
- Export `computeTreeLayout(nodes, edges, options)` function
- Takes React Flow nodes/edges + config (layer spacing, node spacing)
- Calls elkjs with top-down (layered) algorithm
- Returns positioned nodes
- Handles collapsed nodes (exclude children from layout)
- Handles hidden nodes (exclude thumbs-downed when showHidden is false)

- [ ] **Step 3: Create canvas component**

`src/components/lab/canvas.tsx`:
- Wraps `<ReactFlow>` with custom configuration
- Converts LabNode[] from the API into React Flow nodes + edges
- Computes layout via `computeTreeLayout`
- Re-layouts on node add/remove/collapse with animation
- Includes `<MiniMap>`, `<Controls>`, `<Background>` from React Flow
- Handles node selection → updates `useLabStore.selectedNodeId`
- Handles multi-select (Cmd/Ctrl+click)
- Registers custom node types (one per layer)

For now, use a simple placeholder node component for all layers. The per-layer node components come in Task 7.

- [ ] **Step 4: Verify dev server starts**

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock src/components/lab/
git commit -m "feat(lab): add React Flow canvas with elkjs auto-layout"
```

---

## Task 6: Tree List Page + Canvas Page

**Files:**
- Modify: `src/app/(roks-workspace)/dashboard/projects/[id]/lab/page.tsx`
- Create: `src/app/(roks-workspace)/dashboard/projects/[id]/lab/[treeId]/page.tsx`
- Create: `src/components/lab/tree-card.tsx`
- Create: `src/components/lab/layer-nav.tsx`

- [ ] **Step 1: Update tree list page**

Replace experiment references with tree references. Rename "experiment" to "tree" in the UI text. Create dialog: name + optional brand identity. Card grid of `TreeCard` components.

- [ ] **Step 2: Create tree card component**

`src/components/lab/tree-card.tsx`:
- Shows tree name, node count per layer (small badges), creation date
- Click navigates to `/dashboard/projects/${projectId}/lab/${treeId}`
- Delete button with confirmation

- [ ] **Step 3: Create layer navigation bar**

`src/components/lab/layer-nav.tsx`:
- Horizontal bar at top of canvas page
- Buttons: Sources (N) → Ideas (N) → Outlines (N) → Images (N) → Captions (N) → Posts (N)
- Click auto-pans + zooms canvas to fit all nodes at that layer
- Counts derived from tree data. Post count uses the derivation rule (completed caption + completed image parent).
- "Show hidden" toggle at the end

- [ ] **Step 4: Create canvas page**

`src/app/(roks-workspace)/dashboard/projects/[id]/lab/[treeId]/page.tsx`:
- Full-screen layout: LayerNav at top, Canvas filling the rest, DetailPanel on right (conditionally)
- Use `use(params)` pattern for route params
- Fetch tree data via `useTree(treeId)`
- Poll via `useTreeProgress(treeId, hasGeneratingNodes)`
- Back button to tree list

- [ ] **Step 5: Verify in browser** — navigate to Lab, create a tree, see empty canvas

- [ ] **Step 6: Commit**

```bash
git add src/app/(roks-workspace)/ src/components/lab/
git commit -m "feat(lab): add tree list page, canvas page with layer navigation"
```

---

## Task 7: Custom Node Components

**Files:**
- Create: `src/components/lab/nodes/lab-node-card.tsx`
- Create: `src/components/lab/nodes/source-node.tsx`
- Create: `src/components/lab/nodes/idea-node.tsx`
- Create: `src/components/lab/nodes/outline-node.tsx`
- Create: `src/components/lab/nodes/image-node.tsx`
- Create: `src/components/lab/nodes/caption-node.tsx`
- Create: `src/components/lab/nodes/post-node.tsx`
- Modify: `src/components/lab/canvas.tsx` (register custom node types)

- [ ] **Step 1: Create base node card wrapper**

`src/components/lab/nodes/lab-node-card.tsx`:
- Props: `layer`, `status`, `rating`, `childCount`, `collapsed`, `selected`, `onToggleCollapse`
- Color-coded border based on layer (source=blue, idea=green, outline=yellow, image=purple, caption=orange, post=white/bright)
- Thumbs up: green tint. Thumbs down: node at 20% opacity.
- Status indicator: spinner for generating, red dot for failed
- Child count badge ("+N" when collapsed)
- Collapse/expand chevron
- React Flow source handle (bottom) + target handle (top)
- ~180px wide, ~80-100px tall

- [ ] **Step 2: Create per-layer node components**

Each wraps `LabNodeCard` with layer-specific content:
- `SourceNode`: filename or "Pasted text" + first ~40 chars
- `IdeaNode`: first ~50 chars of idea text
- `OutlineNode`: slide count + first line
- `ImageNode`: small image thumbnail from R2 URL
- `CaptionNode`: first ~40 chars of caption
- `PostNode`: small image thumbnail + caption snippet side by side

All are React Flow custom node components using `memo()` and `Handle` from `@xyflow/react`.

- [ ] **Step 3: Register node types in canvas**

Update `canvas.tsx` to register all custom node types:
```typescript
const nodeTypes = {
  source: SourceNode,
  idea: IdeaNode,
  outline: OutlineNode,
  image: ImageNode,
  caption: CaptionNode,
  post: PostNode,
};
```

- [ ] **Step 4: Verify in browser** — create source nodes, they should appear on canvas

- [ ] **Step 5: Commit**

```bash
git add src/components/lab/nodes/ src/components/lab/canvas.tsx
git commit -m "feat(lab): add custom React Flow node components per layer"
```

---

## Task 8: Source Node Creation

**Files:**
- Create: `src/components/lab/source-upload-dialog.tsx`
- Modify: `src/components/lab/canvas.tsx` or layer-nav (add "Add Source" button)

- [ ] **Step 1: Create source upload dialog**

`src/components/lab/source-upload-dialog.tsx`:
- Three tabs in a Dialog: "Paste Text" / "Upload File" / "From Library"
- **Paste Text**: Textarea, "Add Source" button. Creates source node with `output: { text }`.
- **Upload File**: File input (PDF, DOC). Calls `/api/content/parse-file` to extract text. Creates source node with `r2Key`, `fileName`, `output: { text }`.
- **From Library**: Select from existing `ContentSource` records via `useContent()` hook. Copies `rawText` into node output.

- [ ] **Step 2: Wire up to canvas**

Add "Add Source" button in the layer nav bar (next to Sources label) or as a floating button on the canvas when no nodes exist.

- [ ] **Step 3: Verify in browser** — add sources via all 3 methods, see them on canvas

- [ ] **Step 4: Commit**

```bash
git add src/components/lab/
git commit -m "feat(lab): add source node creation dialog (paste, upload, library)"
```

---

## Task 9: Detail Panel

**Files:**
- Create: `src/components/lab/detail-panel.tsx`
- Create: `src/components/lab/detail-panel-prompts.tsx`
- Create: `src/components/lab/detail-panel-actions.tsx`
- Create: `src/components/lab/thumbs-rating.tsx`
- Create: `src/components/lab/generate-popover.tsx`
- Modify: `src/app/(roks-workspace)/dashboard/projects/[id]/lab/[treeId]/page.tsx`

- [ ] **Step 1: Create thumbs rating component**

`src/components/lab/thumbs-rating.tsx`:
- Props: `value: "up" | "down" | null`, `onRate: (rating, comment?) => void`
- Two buttons: ThumbsUp (green when active), ThumbsDown (red when active)
- ThumbsDown click opens small comment popover (textarea + "Skip" + "Submit")

- [ ] **Step 2: Create generate popover**

`src/components/lab/generate-popover.tsx`:
- Props: `onGenerate: (count) => void`, `defaultCount`, `nextLayerName`
- Button that opens a Popover: number input (count) + "Generate N [ideas/outlines/images/captions]" button

- [ ] **Step 3: Create prompts section**

`src/components/lab/detail-panel-prompts.tsx`:
- Props: `systemPrompt`, `contentPrompt`, `onSave`, `onTweakPrompt`
- Two collapsible sections (Collapsible from shadcn)
- Read-only text by default, "Edit" button switches to textarea
- "Save & Regenerate" button (creates sibling node with new prompts + triggers generation)
- "AI Tweak" input at bottom — single line, submit calls `useTweakPrompt()`, shows diff, confirm/discard

- [ ] **Step 4: Create actions section**

`src/components/lab/detail-panel-actions.tsx`:
- Thumbs up/down (ThumbsRating component)
- Generate button (GeneratePopover) — or "Generate more" if node has children
- "Duplicate" button
- "Delete" button with confirmation

- [ ] **Step 5: Create detail panel**

`src/components/lab/detail-panel.tsx`:
- Props: `nodeId` (selected node)
- Fetches node data from the tree query (already loaded)
- Top: output display (layer-specific rendering — text, image, outline structure, post preview)
- Middle: PromptSection
- Bottom: ActionsSection
- Right-side panel, ~400px wide, scrollable

- [ ] **Step 6: Wire into canvas page**

Show DetailPanel when `useLabStore.selectedNodeId` is set. Panel slides in from right.

- [ ] **Step 7: Verify in browser** — click a source node, see detail panel with output + prompts + actions

- [ ] **Step 8: Commit**

```bash
git add src/components/lab/ src/app/(roks-workspace)/
git commit -m "feat(lab): add detail panel with output display, prompt editing, and actions"
```

---

## Task 10: Generation Flow — End to End

**Files:**
- Modify: various lab components to wire up generation

- [ ] **Step 1: Wire "Generate Ideas" from source nodes**

In detail panel, when a source node is selected:
- "Generate Ideas" button calls `useGenerateIdeas()` with the source node ID and count
- New idea nodes appear on canvas (optimistic add, then real data on poll)
- Canvas re-layouts to accommodate new nodes

- [ ] **Step 2: Wire remaining generation layers**

Same pattern for:
- Idea → "Generate Outlines" → `useGenerateOutlines()`
- Outline → "Generate Images" → `useGenerateImages()`
- Image → "Generate Captions" → `useGenerateCaptions()`

Each wired through the detail panel's generate button.

- [ ] **Step 3: Wire multi-select batch generation**

Create `src/components/lab/floating-action-bar.tsx`:
- Appears at bottom of canvas when `multiSelectIds.length > 0`
- Shows: "Generate [next layer] for N selected" + count input + "Generate" button
- Calls `useGenerateBatch()` with selected node IDs

- [ ] **Step 4: Wire progress polling**

Canvas polls `useTreeProgress(treeId)` while any node is generating. When a node transitions `generating → completed`, update the node in the React Flow state. Image nodes: update thumbnail with R2 URL.

- [ ] **Step 5: Verify full pipeline** — source → ideas → outlines → images → captions, all rendering on canvas

- [ ] **Step 6: Commit**

```bash
git add src/components/lab/
git commit -m "feat(lab): wire end-to-end generation pipeline through all 5 layers"
```

---

## Task 11: AI Prompt Tweaking + Save & Regenerate

**Files:**
- Modify: `src/components/lab/detail-panel-prompts.tsx`

- [ ] **Step 1: Wire AI tweak**

When user types in the AI Tweak input and submits:
- Call `useTweakPrompt()` with current prompt + instruction
- Show returned prompt in the textarea with diff highlighting (compare old vs new, highlight changes in amber)
- "Apply" button saves the updated prompt to the node
- "Discard" reverts to original

- [ ] **Step 2: Wire Save & Regenerate**

When prompts are edited and user clicks "Save & Regenerate":
- Call `useDuplicateNode()` to create a sibling with updated prompts
- Then trigger generation for that new node (layer-appropriate generation endpoint)
- The original node stays intact for comparison

- [ ] **Step 3: Verify in browser** — edit a prompt on an idea node, use AI tweak, save & regenerate creates sibling

- [ ] **Step 4: Commit**

```bash
git add src/components/lab/
git commit -m "feat(lab): add AI prompt tweaking and save-and-regenerate as sibling node"
```

---

## Task 12: Export + Polish

**Files:**
- Modify: `src/components/lab/detail-panel.tsx`
- Modify: various components for polish

- [ ] **Step 1: Wire export from post nodes**

When a post node (derived caption with completed image parent) is selected:
- Detail panel shows "Export to Gallery" button
- Calls `useExportToGallery()` with the caption node ID
- Shows success toast with link to Gallery

- [ ] **Step 2: Loading states**

- Canvas: skeleton overlay while tree is loading
- Nodes: spinner animation while `status = "generating"`
- Detail panel: skeleton while node data loads

- [ ] **Step 3: Empty states**

- New tree with no nodes: centered "Add your first source" CTA
- Layer nav with 0 counts: dimmed text

- [ ] **Step 4: Error handling**

- Failed generation: red border on node, "Retry" button in detail panel
- Toast errors for failed mutations
- Cancellation button in layer nav or floating bar when any node is generating

- [ ] **Step 5: Verify full flow end-to-end**

1. Create tree
2. Add source (paste text)
3. Generate ideas (3)
4. Thumbs-down one idea (fades)
5. Generate outlines from remaining ideas
6. Generate images from an outline
7. Generate captions from an image
8. See derived post in Post layer
9. Export to Gallery
10. Verify in Gallery page

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat(lab): add export, loading states, empty states, error handling"
```
