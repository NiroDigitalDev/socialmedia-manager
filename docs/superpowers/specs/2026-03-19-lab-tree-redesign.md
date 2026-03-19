# Lab Tree Redesign — Design Spec

**Date**: 2026-03-19
**Status**: Approved
**Scope**: Instagram only (static posts, no carousel)
**Replaces**: `2026-03-19-instagram-lab-design.md` (Experiment/Run model)

## Overview

Replace the current Lab (Experiment → Run → Variations batch model) with a **top-down tree/node graph** where each layer of the content pipeline is a visual node. Users upload sources, generate ideas, create outlines, generate images, generate captions — each step is a node in the tree with full prompt visibility, editing, AI-assisted tweaking, and variation branching.

The Lab is a full-screen canvas powered by React Flow, with a detail panel for inspecting and editing nodes.

## Goals

1. Visualize the full generation pipeline as a tree — trace any post back to its source
2. Full prompt control at every layer — see system + content prompts, edit both, use AI to tweak
3. Generate variations at any layer — branch the tree to explore different approaches
4. Binary quality signal (thumbs up/down) for fast filtering — thumbs down fades the branch
5. Export winning posts (image + caption pairs) to Gallery

## Pipeline Layers

```
Sources (uploaded content)
  → Ideas (generated from sources)
    → Outlines (structured post outlines from ideas)
      → Images (generated from outlines)
        → Captions (generated from outline + image)
          → Posts (auto-derived: completed caption with completed image parent)
```

Each layer transition is a generation step with controllable prompts.

## UI Structure

### Three Persistent Zones

1. **Layer navigation bar** (top) — horizontal breadcrumb: Sources → Ideas → Outlines → Images → Captions → Posts. Click to jump/auto-zoom to that layer. Shows count per layer (e.g., "Ideas (12)").

2. **Canvas** (center) — React Flow node graph. Top-down tree layout via elkjs. Pan/drag, scroll to zoom. Minimap in bottom-left. "Fit all" button. Auto-layout with smooth transitions on node add/remove. Layer nav clicks auto-pan + zoom to fit all nodes at the clicked layer.

3. **Detail panel** (right, ~400px) — opens when a node is selected. Contains output preview, prompt editing, rating, and generation controls.

### Node Display on Canvas

Compact cards (~180px wide, ~80px tall) with:
- Color-coded border per layer (source=blue, idea=green, outline=yellow, image=purple, caption=orange, post=white)
- Small thumbnail/preview + title/snippet
- Thumbs up/down icons (inline, small)
- Child count badge
- Collapse/expand chevron (if has children)

### Node Interactions

**Selection:**
- Click node → detail panel opens on the right
- Multi-select: Cmd/Ctrl+click on nodes at the same layer → floating action bar at bottom: "Generate [next layer] for N selected" with count input

**Thumbs up/down:**
- Thumbs up: green tint on node border, branch stays visible
- Thumbs down: optional comment popover (can skip). Node + entire subtree fade to ~20% opacity and collapse.
- "Show hidden" toggle in layer bar to reveal thumbs-downed nodes (dimmed)

**Collapse/expand:**
- Click chevron on any parent node to hide/show its children
- Collapsed state shows "+N" badge for hidden children count

**Generation:**
- "Generate" in detail panel — first time: popover asks count (default 3)
- "Generate more" on nodes that already have children — adds more using same prompts/settings
- Multi-select + floating action bar for batch generation across multiple nodes

### Detail Panel

**Top section — Output:**
- Source nodes: content text preview, filename, date
- Idea nodes: full idea text
- Outline nodes: structured outline with slide descriptions
- Image nodes: full-size image (click to zoom)
- Caption nodes: full caption text with hashtags
- Post nodes: assembled Instagram preview (image + caption)

**Middle section — Prompts (collapsible):**

Two collapsible sections, both editable:
- **System Prompt** — the instruction template (e.g., "You are a social media content strategist..."). This is what you tune to improve quality across all generations at a layer.
- **Content Prompt** — the specific input for this node (source text, idea text, outline, etc.). Changes per node.

Both show as read-only by default. "Edit" button switches to textarea. "Save & Regenerate" creates a **new sibling node** with the updated prompts and generates fresh output — the original node is preserved for comparison. This aligns with the variation/branching philosophy.

- **AI Tweak** — single-line input: "Describe what to change..." Sends current prompts + instruction to Gemini, returns updated prompts with changes highlighted (diff). User previews and confirms or discards.

**Bottom section — Actions:**
- Thumbs up / Thumbs down (large, clear)
- "Generate [next layer]" with count input (or "Generate more" if children exist)
- "Duplicate" — copy node (same prompts, no output) for A/B testing prompt edits
- "Delete" — remove node and subtree

## Data Model

### LabTree

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| name | String | User-provided name |
| projectId | String | FK → Project |
| orgId | String | FK → Organization |
| brandIdentityId | String? | Optional brand identity |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### LabNode

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| treeId | String | FK → LabTree |
| parentId | String? | FK → LabNode (self-referential, null for source nodes) |
| layer | Enum | `source`, `idea`, `outline`, `image`, `caption` |
| status | Enum | `pending`, `generating`, `completed`, `failed` |
| output | Json? | Generated result (text, structured outline, etc.) |
| systemPrompt | String? | The system instruction prompt |
| contentPrompt | String? | The content/input prompt |
| rating | Enum? | `up`, `down`, null |
| ratingComment | String? | Optional thumbs-down comment |
| r2Key | String? | For image/source file nodes — R2 object key |
| mimeType | String? | For image/source file nodes |
| fileName | String? | For source nodes — original upload filename |
| ancestorContext | Json? | Snapshot of ancestor outputs at generation time (so node is self-contained) |
| orgId | String | Denormalized for auth scoping |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**Indexes:** `@@index([treeId])`, `@@index([treeId, layer])`, `@@index([parentId])`, `@@index([orgId])`

**Posts are not stored** — a caption node whose parent is a completed image node IS a post. The UI derives this automatically.

**Tree relationships via parentId:**
- Source nodes: `parentId = null` (root)
- Idea nodes: `parentId = sourceNodeId`
- Outline nodes: `parentId = ideaNodeId`
- Image nodes: `parentId = outlineNodeId`
- Caption nodes: `parentId = imageNodeId`

### Enums

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

## Source Node Creation

Source nodes are the roots of the tree. Three creation methods:

1. **Paste text** — user pastes or types raw content text. Stored in `output` Json as `{ text: "..." }`. No file upload.
2. **Upload file** — user uploads a PDF/doc. File stored in R2 at `lab/{nodeId}/source.{ext}` (using `r2Key` + `fileName`). Text extracted via the existing `/api/content/parse-file` endpoint and stored in `output` Json as `{ text: "extracted text" }`.
3. **Link existing ContentSource** — user selects from existing project content sources. The source's `rawText` is copied into the node's `output` Json. No FK reference — the data is snapshotted so the node is self-contained.

In all cases, the source node gets `status = "completed"` immediately (no generation needed).

## Ancestor Context

When generating a node, its `ancestorContext` field is populated with a snapshot of relevant ancestor outputs. This makes each node self-contained — you can understand what produced it without walking the tree.

**What's stored per layer:**
- **Idea nodes**: `{ sourceText: "..." }` — the source's raw text
- **Outline nodes**: `{ sourceText: "...", ideaText: "..." }`
- **Image nodes**: `{ ideaText: "...", outlineSlides: [...] }`
- **Caption nodes**: `{ ideaText: "...", outlineSlides: [...], imageDescription: "..." }` — image description generated via Gemini vision analysis of the parent image

This is computed at generation time by walking up the `parentId` chain and extracting the relevant `output` fields.

## Post Derivation

A **post** is derived (not stored) when both conditions are met:
- A caption node has `status = "completed"`
- Its parent image node has `status = "completed"` and has a valid `r2Key`

If either ancestor is re-generated (status goes back to `generating`), the post disappears from the Posts layer count until both are completed again.

The Posts layer in the nav bar counts derived posts: `SELECT COUNT(*) FROM LabNode caption WHERE caption.layer = 'caption' AND caption.status = 'completed' AND EXISTS (SELECT 1 FROM LabNode image WHERE image.id = caption.parentId AND image.status = 'completed' AND image.r2Key IS NOT NULL)`.

## Generation Pipeline

### Per-Layer Generation

Each layer transition has its own generation logic:

**Source → Ideas:**
- System prompt: configurable template for idea extraction
- Content prompt: the source's raw text
- Gemini text generation → returns N idea texts
- Each idea becomes a LabNode with layer=idea, parentId=sourceNode

**Ideas → Outlines:**
- System prompt: configurable template for structuring post outlines
- Content prompt: the idea text
- Gemini text generation → returns structured outline JSON (slides + layout notes)
- Each outline becomes a LabNode with layer=outline

**Outlines → Images:**
- System prompt: configurable template for image generation (includes style, brand colors, logo)
- Content prompt: the outline's slide descriptions + layout notes
- Gemini image generation → returns base64 image
- Uploaded to R2 at `lab/{nodeId}/original.{ext}`
- Each image becomes a LabNode with layer=image, r2Key set

**Images → Captions:**
- System prompt: configurable template for caption writing
- Content prompt: the outline text + reference to the image (description or vision analysis)
- Gemini text generation → returns caption text with hashtags
- Each caption becomes a LabNode with layer=caption

### Generation Controls

- **Count**: user specifies how many children to generate (default 3)
- **Concurrency**: same as current Lab — p-limit(5) for images, p-limit(10) for text
- **Retries**: 2 retries with exponential backoff
- **Background**: fire-and-forget pattern, nodes update from `generating` → `completed`/`failed`
- **Polling**: `treeProgress` endpoint returns only nodes with `status = 'generating'` or recently completed (changed in last 5s). Canvas polls this every 2s while any node is generating. Full tree data fetched on initial load and on-demand only.
- **Cancellation**: `cancelGeneration` procedure sets all `generating` nodes in a specified subtree (or entire tree) to `failed`. Background jobs check node status before each generation step.
- **Cost guardrails**: before batch generation, UI shows estimated cost and node count. Warn if generating 20+ images at once. No hard limit, but confirmation required for large batches.

### AI Prompt Tweaking

When user types in the AI Tweak input:
1. Send to Gemini: "Here is a system prompt: [prompt]. The user wants to: [instruction]. Return the updated prompt."
2. Return the updated prompt text
3. UI shows diff (highlight changes) in the prompt textarea
4. User confirms → prompt saved, optionally regenerate

## Canvas Implementation

### Dependencies

- `@xyflow/react` (React Flow v12) — node graph rendering
- `elkjs` — auto-layout engine for top-down tree

### Layout

- Top-down tree layout computed by elkjs
- Async layout computation (web worker if needed for large trees)
- Smooth animated transitions when nodes are added/removed/collapsed
- Layer spacing: ~200px vertical between layers
- Node spacing: ~40px horizontal between siblings

### Performance

- React Flow handles 100+ nodes natively
- For 500+ nodes, use React Flow's built-in virtualization
- elkjs layout is O(n log n), fast enough for interactive use

### Node Components

Custom React Flow node components per layer type:
- `SourceNode`, `IdeaNode`, `OutlineNode`, `ImageNode`, `CaptionNode`, `PostNode`
- All share a base `LabNodeCard` wrapper with color-coded border, rating icons, collapse chevron, child count badge

## Integration

### What stays
- Project sidebar "Lab" nav item
- Lab page at `/dashboard/projects/[id]/lab` — list of trees (card grid)
- tRPC router pattern, hooks, R2 storage, Gemini utilities
- Export to Gallery bridge (creates GeneratedPost + GeneratedImage from r2Key)
- Existing styles system for image generation

### What gets dropped
- All current Lab UI components (`src/components/lab/*`)
- Current lab tRPC router (rewritten)
- Current lab hooks + store (rewritten)
- Prisma models: Experiment, Run, RunConcept, ImageVariation, CaptionVariation, RunExport
- Related migration: drop old tables, create LabTree + LabNode

### New code

| Location | Purpose |
|----------|---------|
| `prisma/schema.prisma` | Drop old Lab models, add LabTree + LabNode + enums |
| `src/lib/trpc/routers/lab.ts` | Rewrite: tree CRUD, node CRUD, per-layer generation, prompt tweaking, export |
| `src/hooks/use-lab.ts` | Rewrite: hooks for tree + node operations |
| `src/stores/use-lab-store.ts` | Rewrite: selected node, panel state, hidden nodes toggle |
| `src/app/(roks-workspace)/dashboard/projects/[id]/lab/page.tsx` | Tree list page (minor update) |
| `src/app/(roks-workspace)/dashboard/projects/[id]/lab/[treeId]/page.tsx` | Full-screen canvas page |
| `src/components/lab/canvas.tsx` | React Flow canvas with layout engine |
| `src/components/lab/nodes/` | Custom node components per layer |
| `src/components/lab/detail-panel.tsx` | Right-side detail panel |
| `src/components/lab/layer-nav.tsx` | Top layer navigation bar |
| `src/components/lab/floating-action-bar.tsx` | Multi-select action bar |
| `src/components/lab/tree-card.tsx` | Tree card for list view (replaces experiment-card) |

### Sidebar entry
- "Lab" nav item stays at same position, same icon

## Export to Gallery

Export creates `GeneratedPost` + `GeneratedImage` records from post-level node pairs.

**Procedure**: `exportToGallery` mutation. Input: `{ posts: [{ captionNodeId: string }] }`. The image is derived from the caption's parent.

**Flow per export entry:**
1. Fetch caption node — verify `status = "completed"`, has text in `output`
2. Fetch parent image node — verify `status = "completed"`, has `r2Key`
3. Create `GeneratedPost` with `status = "completed"`, `platform = "instagram"`, `description = caption text`, `orgId`
4. Create `GeneratedImage` with `r2Key` pointing to the image node's R2 key (no blob copy), `mimeType`
5. Return created post IDs

No `RunExport` equivalent — the export is a one-way bridge. The LabNode tree is the source of truth; the Gallery is the output.

## View State Persistence

- **Rating** (`up`/`down`) — persisted on `LabNode`, survives refresh. Thumbs-down fade effect is derived from rating.
- **Collapse/expand** — ephemeral, stored in Zustand. Lost on refresh. Acceptable because the tree auto-lays out and the user can quickly re-collapse groups they don't need.
- **Selected node** — ephemeral, stored in Zustand.
- **Hidden toggle** (show/hide thumbs-downed nodes) — ephemeral, stored in Zustand.

## Migration

**This is a clean replacement.** The existing Lab is pre-production with test data only.

**Migration steps:**
1. Query all `ImageVariation.r2Key` values — batch-delete R2 objects at `lab/*` prefix
2. Drop tables: `RunExport`, `CaptionVariation`, `ImageVariation`, `RunConcept`, `Run`, `Experiment`
3. Drop enums: `RunStatus`, `RunScope`, `VariationStatus`
4. Create enums: `LabNodeLayer`, `LabNodeStatus`, `LabNodeRating`
5. Create tables: `LabTree`, `LabNode`
6. Verify no remaining FKs from surviving tables point to dropped tables (only `GeneratedPost.exports` did, which was on the `RunExport` side — safe to drop)

Single migration file. No data preservation needed.

## Duplicate Node Behavior

"Duplicate" creates a copy of the node with:
- Same `parentId` (sibling placement)
- Same `layer`
- Same `systemPrompt` and `contentPrompt`
- `output = null`, `status = "pending"`, `rating = null` (fresh, no output yet)
- No children (subtree is not copied)

The user can then edit the prompts on the duplicate and generate to compare with the original.

## Out of Scope

- Carousel posts (static only for now)
- AI auto-learning from ratings
- Platforms other than Instagram
- Collaborative features
- Scheduling/auto-posting
- Style selection per-node (use tree-level brand identity + style settings for now)
