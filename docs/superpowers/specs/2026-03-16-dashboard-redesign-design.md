# Dashboard Redesign — Design Spec

## Overview

Redesign the `(roks-workspace)/dashboard` route group to replace the current `(main)` app. The new design is content-planning-first, project-based, with a Gamma-inspired stepped generation flow. The aesthetic is clean, spacious, and simple — matching the existing shadcn AppSidebar shell.

## Core Principles

- **Projects are the organizing unit** — everything lives inside a project, but nothing requires one
- **Three-tier hierarchy** — Global → Project → Campaign. Each level adds context but none is mandatory
- **Content moves freely** between levels (re-scope, not duplicate)
- **Progressive disclosure** — simple by default, powerful when needed
- **Multi-platform generation** — Instagram, LinkedIn, Reddit, X, Blog, Email in one flow

---

## Sidebar Structure

Hybrid persistent global + contextual project navigation. Projects appear as expandable tree nodes (Notion-style), not behind a switcher.

### Zone 1: Global Navigation (always visible)

| Item | Icon | Route |
|------|------|-------|
| Dashboard | LayoutDashboard | `/dashboard` |
| Generate | Sparkles | `/dashboard/generate` |
| Asset Library | Library | `/dashboard/assets` |

### Zone 2: Favorites (collapsible)

User-pinned items — projects, campaigns, or specific pages. Star to add/remove. Empty state: "Pin items for quick access." Collapsible to save space.

Favorites are stored via a `Favorite` entity (userId, targetType, targetId, order). Queried eagerly with sidebar data. `targetType` values: `project`, `campaign`, `route` (for pinning specific pages like `/dashboard/assets`). tRPC procedures: `favorite.list`, `favorite.add`, `favorite.remove`, `favorite.reorder`.

### Zone 3: Projects (dynamic, from DB)

Collapsible section with "+" button to create new project. Each project is an expandable tree node:

```
+ New Project
▸ Nike Summer 2026
▸ Internal Branding
▾ Client X Launch           ← expanded
    Overview
    Content
    Campaigns
    Brand Identities
    Assets
    Generate
```

Multiple projects can be expanded simultaneously. Sub-pages indented. Projects sorted by recent activity. "Generate" appears as the last sub-page under each project — same stepped flow but with project context pre-loaded.

### Zone 4: Secondary (pushed to bottom)

| Item | Icon | Route |
|------|------|-------|
| Settings | Settings2 | `/dashboard/settings` |

### Footer

User avatar + name with dropdown (account, logout).

### Command Menu (Cmd+K)

Universal search across: global pages, projects, campaigns, recent generations, assets.

---

## Route Tree

```
/dashboard                                        — overview, recent activity, quick stats
/dashboard/generate                               — global generate (stepped flow, no project required)
/dashboard/assets                                  — global asset library
/dashboard/projects                                — project list (also accessible via sidebar "+" / Cmd+K)
/dashboard/projects/[id]                           — project overview        (sidebar: "Overview")
/dashboard/projects/[id]/content                   — content sources + ideas (sidebar: "Content")
/dashboard/projects/[id]/campaigns                 — campaign list           (sidebar: "Campaigns")
/dashboard/projects/[id]/campaigns/[campaignId]    — campaign detail + results
/dashboard/projects/[id]/brands                    — brand identities        (sidebar: "Brand Identities")
/dashboard/projects/[id]/assets                    — project asset library   (sidebar: "Assets")
/dashboard/projects/[id]/generate                  — project-scoped generate (sidebar: "Generate")
/dashboard/settings                                — profile + org management
```

Note: Sidebar labels are listed in parentheses. The route segment `/brands` maps to sidebar label "Brand Identities" — this is intentional to keep URLs short while labels remain descriptive.

---

## Page Designs

### Dashboard (`/dashboard`)

"Pick up where you left off" hub. Not heavy analytics.

- Recent generations — thumbnails of latest generated content across all projects + unassigned
- Active projects — cards with recent activity, quick-click entry
- Quick generate CTA — prominent entry point
- Recent ideas — latest generated content ideas across projects

### Generate Flow (`/dashboard/generate`, `/dashboard/projects/[id]/generate`)

Gamma-inspired stepped flow. Every step is a persistent panel you can jump back to anytime with stored state.

**Layout:**
- Left rail — step navigator with status indicators (completed/active/pending). Shows summary of selection per completed step. Click any step to jump back.
- Main area — active step content. One focus at a time.
- Right preview — live preview that updates as selections change. Platform-specific mockups.

**Step 1: Platforms**
"What are you creating?"

Multi-select cards:
- Instagram Post — image-first, caption
- LinkedIn Post — text-heavy, optional image
- Reddit Post — text or image post
- X Post — short text, optional image
- Blog Post — long-form, markdown
- Email — marketing email / newsletter, HTML sections

Each card shows platform icon + format hint. Multiple selectable. Rest of flow adapts to selection.

**Step 2: Content**
"What's your content about?"

Multiple input modes (combinable):
- Write a prompt — free-form textarea
- From content idea — browse/search saved ideas (project-scoped if in project)
- From content source — pick source, AI extracts relevant content
- Upload — paste text, drop file (PDF, MD, images)
- From asset library — pull in reference images or existing assets

Inputs stack — combine prompt + reference image + content idea.

**Step 3: Outline**
AI generates content plan per platform:

```
Instagram Post
  → Slide 1: Hero image — product on gradient background
  → Slide 2: Key features callout
  → Slide 3: CTA with brand tagline
  → Caption: [generated draft]

LinkedIn Post
  → Opening hook: [generated]
  → Body: [3 paragraphs]
  → Image: Product lifestyle shot

Email
  → Subject line: [generated]
  → Header image: [description]
  → Body sections: [generated]
  → CTA block: [generated]
  → Footer: brand info
```

Each section editable inline. Rewrite, reorder, add/remove sections, change approach per platform. Regenerate individual sections.

**Step 4: Style & Brand**
- Brand identity — dropdown (project context) or quick brand settings
- Visual styles — thumbnail grid, multi-select
- Color override — brand palette or custom
- Per-platform overrides — expand to customize style per platform

Defaults are sensible — brand identity auto-applies colors/logo.

**Step 5: Settings & Generate**
Final config + generate button. Summary of all selections.

- Format per platform (static/carousel for Instagram, text length for LinkedIn/X)
- Aspect ratio per platform (auto-suggested, overridable)
- Model (flash/pro)
- Variations count
- Include logo toggle
- Estimated output count shown

**Step 6: Results**
Content appears as it generates. Organized by platform.

- Platform tabs to switch between results
- Each result: generated content + style badge
- Actions: download, save to project, edit, regenerate, move to campaign
- Compare view — side-by-side across styles/variations
- Save all or cherry-pick individual results

**Revisiting Steps:**
Jumping back preserves everything forward. Change platform selection → outline adapts but keeps edits where possible. Change style → only visual generation re-runs. Each step caches state.

**State Persistence:**
- Step state is held in React state (in-memory) — lost on page refresh. This is acceptable for a generation flow; partial flows don't need server persistence.
- URL updates per step via query param (e.g., `/dashboard/generate?step=3`) for back-button support, not for shareability.
- Completed generation results (Step 6) are persisted to DB immediately — the flow state is ephemeral, the output is durable.

**Context Awareness:**
- From dashboard (no project): all steps available, no brand pre-selected, results unassigned (scoped to org via session)
- From project: brand identities available, ideas/sources scoped, results auto-saved to project
- From campaign: same as project + results go into campaign, style/brand pre-selected

### Projects List (`/dashboard/projects`)

Grid of project cards: name, thumbnail/color, creation date, quick stats (campaigns, generations). Favorite star. "Create Project" card/button.

### Project Overview (`/dashboard/projects/[id]`)

Project home: name + description (editable inline), recent generations, active campaigns, brand identities at a glance, content sources summary. Quick actions: Generate, New Campaign, Add Content.

### Project Content (`/dashboard/projects/[id]/content`)

Two tabs:

**Sources tab:** List/grid of content sources (text, PDF, markdown). Add source via upload or paste. Click source to see generated ideas from it.

**Ideas tab:** All generated ideas across sources. Filter by content type, source, saved status. Bulk select + actions (delete, save, move to campaign). Idea cards: preview, type badge, format badge, actions (save, generate post, add to campaign).

### Project Campaigns (`/dashboard/projects/[id]/campaigns`)

**List view:** Campaign cards — name, brand identity, generation count, date. Create button.

**Detail view** (`/dashboard/projects/[id]/campaigns/[campaignId]`): Name + description, brand identity selector, selected styles, assigned ideas, generated content gallery, compare view for side-by-side results.

### Project Brand Identities (`/dashboard/projects/[id]/brands`)

**List view:** Cards per identity — name, logo thumbnail, color swatches.

**Editor:** Name, logo upload, tagline, color palettes (multiple per identity), preview of applied colors/logo.

Create, duplicate, edit, delete identities.

### Asset Library (`/dashboard/assets`, `/dashboard/projects/[id]/assets`)

Same component, different scope. Two-section view:

**Reference & Inspiration** — mood boards, competitor screenshots, style references
**Assets** — reusable logos, product photos, backgrounds

Grid of thumbnails with file type badges. Upload via drag & drop + file picker. Supported formats: PNG, JPG, SVG, WebP, AVIF, PDF, MD. Search/filter by name, type. Move between global/project scope. Preview on click.

### Settings (`/dashboard/settings`)

Profile (name/email editing), org members table with remove, pending invitations with revoke, invite form.

---

## Data Model Changes

### Multi-Tenancy

All content entities must be org-scoped. The current schema has no `orgId` on `ContentSource`, `ContentIdea`, `GeneratedPost`, `Style`, etc. — this is a data isolation gap.

**Strategy:** Every content entity gets an `orgId` field (required, non-nullable). For entities that also have a `projectId`, org-scoping is enforced through the project's `orgId`. For entities with nullable `projectId` (unassigned content), `orgId` is the direct scope. All queries filter by the session's active org.

### New Entities

**Project** — name, description, color (hex string), orgId, createdAt

**Campaign** — name, description, projectId, brandIdentityId?, status (draft | active | completed | archived), createdAt

**BrandIdentity** — name, logoAssetId?, tagline, projectId, orgId, createdAt. Replaces `BrandSettings` — multiple per project.

**Asset** — stored in R2 (consistent with in-progress migration). Fields: r2Key, mimeType, fileName, category (reference | asset), projectId? (nullable = global), orgId, createdAt. Supported mimeTypes: image/png, image/jpeg, image/svg+xml, image/webp, image/avif, application/pdf, text/markdown.

**Favorite** — userId, targetType (project | campaign | route), targetId (entity ID or route path for `route` type), order

### Modified Entities

**BrandPalette** — `brandIdentityId` replaces current standalone model. Each palette belongs to a specific brand identity.

**ContentSource** — adds `orgId` (required), `projectId` (nullable)

**ContentIdea** — adds `orgId` (required), `projectId` (nullable), `campaignId` (nullable)

**GeneratedPost** — adds `orgId` (required), `projectId` (nullable), `campaignId` (nullable), `platform` enum (instagram | linkedin | reddit | x | blog | email). For text-only platforms (blog, email, linkedin, reddit, x), text content is stored in a new `textContent` field (String, nullable). Image-based content continues to use `GeneratedImage` relation.

**Style** — adds `orgId` (required). Styles are org-scoped, selectable across all projects within the org. Predefined styles are seeded per org.

### Migration: BrandSettings → BrandIdentity

1. For each existing `BrandSettings` row, create a `BrandIdentity` with the same name/tagline/colors
2. If `BrandSettings.logoImageId` exists, create an `Asset` from the `StoredImage` data (upload to R2), link as `logoAssetId`
3. Migrate each `BrandPalette` to reference the new `BrandIdentity` ID
4. Drop `BrandSettings` table after migration
5. Update `/api/generate` to query `BrandIdentity` instead of `BrandSettings.findFirst()`

### Content Movement

Re-scoping via field updates, not duplication:
- Unassigned post → set projectId
- Project post → set campaignId
- Project asset → clear projectId → now global (orgId stays)
- Global asset → set projectId → now project-scoped

### New API Layer

All new entities use tRPC procedures (consistent with CLAUDE.md: "tRPC v11 for new features"):
- `project.*` — CRUD, list by org
- `campaign.*` — CRUD, list by project
- `brandIdentity.*` — CRUD, list by project, duplicate
- `asset.*` — upload, list (global/project), move, delete
- `favorite.*` — list, add, remove, reorder
- `generate.*` — create generation session, poll status, get results

Existing REST routes (`/api/posts`, `/api/brand`, `/api/content`, `/api/styles`, `/api/generate`) remain functional during migration but are not extended. New features go through tRPC only.

---

## Styles Management

Styles have no dedicated page in the new design. Instead:

- **Browse/select styles** in Step 4 of the generate flow (thumbnail grid, multi-select)
- **Create new styles** via a "Create Style" action in the Step 4 style picker (inline dialog — from text prompt or from reference image, same as current)
- **Manage styles** (delete custom, preview, generate samples) via a settings sub-section or a dedicated modal accessible from the style picker

This keeps styles contextual — you encounter them where you use them, not as a separate management page.

---

## Gallery / All Generations View

The current `/posts` gallery is not carried forward as a standalone page. Instead:

- **Dashboard** shows recent generations across all projects
- **Project overview** shows recent generations for that project
- **Campaign detail** shows all campaign generations with compare view
- **Generate flow Step 6** shows current session results

For "find an old generation across all projects," the **Command Menu (Cmd+K)** searches recent generations, and the dashboard's recent generations section provides a scrollable/filterable view. If this proves insufficient, a global gallery page can be added later at `/dashboard/generations`.

---

## Empty States

Key empty states that need explicit design:

- **Dashboard (new user):** Welcome message, "Create your first project" CTA, quick generate prompt
- **Projects list (no projects):** Illustration + "Create your first project" card
- **Project overview (fresh project):** Checklist — add content, set up brand identity, create first campaign
- **Campaign detail (no generations):** "Generate content for this campaign" CTA
- **Asset library (empty):** Drag & drop zone with supported format list
- **Favorites (empty):** "Pin items for quick access" hint text

---

## Technical Standards

### Component Style: shadcn Dashboard Pattern

All new pages and components must follow the patterns established in the existing demo dashboard (`SectionCards`, `ChartAreaInteractive`, `DataTable`). These are the reference implementations for how components should be built.

**shadcn primitives to use throughout:**
- Card (with CardAction, CardHeader, CardTitle, CardDescription, CardContent, CardFooter)
- Table, Tabs, Badge, Button, Select, Input, Checkbox, Separator
- Drawer for detail views (not modals — drawers are the pattern)
- DropdownMenu for row/item actions
- ToggleGroup for segmented controls
- Chart (Recharts via shadcn Chart wrapper) for any data visualization

**Styling patterns to follow:**
- `data-slot` selectors for targeting shadcn children: `*:data-[slot=card]:bg-...`, `**:data-[slot=select-value]:block`
- Container queries (`@container/main`, `@container/card`) for responsive layouts — not media queries
- Responsive visibility via container breakpoints: `hidden @[540px]/card:block`
- Transparent inline inputs: `border-transparent bg-transparent shadow-none hover:bg-input/30 focus-visible:border focus-visible:bg-background`
- `tabular-nums` for all numeric displays
- Card gradients: `bg-gradient-to-t from-primary/5 to-card` with dark mode override
- Icon sizing: Lucide icons with `className="size-X"` and `data-icon` attributes
- Spacing: `gap-2`/`gap-4`/`gap-6`, padding `px-4 lg:px-6`
- Dark mode: explicit `dark:` overrides where background differs
- `cn()` from `@/lib/utils` for all className merging — never manual concatenation

**Component structure:**
- `"use client"` directive on all interactive components
- One component per file, named export matching file name
- shadcn `radix-nova` style with `neutral` base color
- Use `bunx shadcn@latest add <component>` to add missing shadcn components

### State Management: Zustand + Custom Hooks

Replace the current pattern of 10-20 scattered `useState` calls per page with Zustand stores and custom `useX` hooks.

**Store architecture:**

```
src/stores/
  use-project-store.ts      — active project state, project list cache
  use-generate-store.ts     — generate flow step state, selections, results
  use-sidebar-store.ts      — expanded projects, favorites, active section
  use-asset-store.ts        — asset library state, uploads, filters
```

**Store pattern:**
```typescript
// src/stores/use-generate-store.ts
import { create } from 'zustand'

interface GenerateState {
  step: number
  platforms: Platform[]
  content: ContentInput
  outline: OutlineData | null
  // ...
  setStep: (step: number) => void
  setPlatforms: (platforms: Platform[]) => void
  reset: () => void
}

export const useGenerateStore = create<GenerateState>((set) => ({
  step: 1,
  platforms: [],
  content: { prompt: '' },
  outline: null,
  setStep: (step) => set({ step }),
  setPlatforms: (platforms) => set({ platforms }),
  reset: () => set({ step: 1, platforms: [], content: { prompt: '' }, outline: null }),
}))
```

**Custom hooks for data fetching (tRPC wrappers):**

```
src/hooks/
  use-projects.ts           — useProjects(), useProject(id), useCreateProject()
  use-campaigns.ts          — useCampaigns(projectId), useCampaign(id)
  use-brand-identities.ts   — useBrandIdentities(projectId), useCreateBrandIdentity()
  use-assets.ts             — useAssets(scope, projectId?), useUploadAsset()
  use-content.ts            — useSources(projectId), useIdeas(projectId, filters)
  use-favorites.ts          — useFavorites(), useToggleFavorite()
  use-generations.ts        — useRecentGenerations(), useProjectGenerations(projectId)
```

**Hook pattern (tRPC v11 + @trpc/tanstack-react-query):**
```typescript
// src/hooks/use-projects.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from '@/lib/trpc/client'

export function useProjects() {
  const trpc = useTRPC()
  return useQuery(trpc.project.list.queryOptions())
}

export function useProject(id: string) {
  const trpc = useTRPC()
  return useQuery(trpc.project.get.queryOptions({ id }))
}

export function useCreateProject() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  return useMutation({
    ...trpc.project.create.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.project.list.queryKey() })
    },
  })
}
```

**Rules:**
- Pages are thin — they compose hooks + components, no business logic
- Zustand for client-only UI state (generate flow steps, sidebar expansion, filters, selections)
- tRPC `useQuery`/`useMutation` wrapped in custom hooks for server state — never call `trpc.x.y.useQuery()` directly in components
- No `useEffect` for data fetching — tRPC handles it
- Colocate store slices with features, not one monolithic store

---

## What's Not Changing

- Auth system (Better Auth, magic link, org plugin)
- tRPC + REST hybrid API pattern (new features use tRPC, existing REST routes remain)
- AI backend (Gemini models)
- Email (Resend)
- shadcn/ui component library
- Proxy-based auth protection
