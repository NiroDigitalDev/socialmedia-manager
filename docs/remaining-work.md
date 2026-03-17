# Dashboard Redesign — Remaining Work & Sidebar Improvements

## Part 1: Sidebar Redesign

### Current Problems

The sidebar works but has UX gaps:

1. **No auto-expand on navigation** — When you click a link to `/dashboard/projects/[id]/content`, you land on the page but the sidebar project tree stays collapsed. You lose your "you are here" context.
2. **No "active project" concept** — Every project looks the same in the tree. There's no visual distinction between the project you're working in and others.
3. **Missing global pages** — Styles and Posts Gallery don't exist in the sidebar. In the old app these were top-level pages. The new architecture made everything project-scoped, but some things (styles, recent generations) need org-level access.

### Proposed Sidebar Structure

```
┌─────────────────────────────────┐
│ [Logo] Organization Name        │
├─────────────────────────────────┤
│                                 │
│  GLOBAL                         │
│  ● Dashboard                    │
│  ● Generate                     │
│  ● Gallery                  NEW │
│  ● Styles                   NEW │
│  ● Asset Library                │
│                                 │
├─────────────────────────────────┤
│                                 │
│  ACTIVE PROJECT  (Client X)     │  ← Only when inside a project
│  ● Overview                     │
│  ● Content                      │
│  ● Campaigns                    │
│  ● Brand Identities             │
│  ● Assets                       │
│  ● Generate                     │
│                                 │
├─────────────────────────────────┤
│                                 │
│  FAVORITES                      │
│  ★ Nike Summer 2026             │
│  ★ Asset Library                │
│                                 │
├─────────────────────────────────┤
│                                 │
│  PROJECTS                       │
│  ▸ Nike Summer 2026             │  ← Collapsed, manually expandable
│  ▸ Internal Branding            │
│  ▾ Another Project              │  ← Expanded (manual)
│      Overview                   │
│      Content                    │
│      ...                        │
│  + New Project                  │
│                                 │
├─────────────────────────────────┤
│  ⚙ Settings                    │
├─────────────────────────────────┤
│  [Avatar] User Name             │
│  user@email.com                 │
└─────────────────────────────────┘
```

### Key Changes

**1. Active Project Section (NEW)**

When the user navigates to any project page (URL contains `/dashboard/projects/[id]`), an "Active Project" zone appears between Global Nav and Favorites. It shows:
- Project name + color dot in the section header
- All 6 sub-pages as direct links (no expand/collapse needed)
- Active sub-page highlighted

This section disappears when navigating to a non-project page (dashboard, global generate, assets, styles, gallery).

Implementation: Detect `projectId` from `usePathname()` with a regex like `/\/dashboard\/projects\/([^/]+)/`. When present, render a dedicated `NavActiveProject` component that fetches the project name via `useProject(id)` and shows the sub-pages.

**2. Auto-Expand in Project Tree**

When navigating to a project page, the corresponding project in the "Projects" zone (Zone 4) should auto-expand. This gives the user two views of the same project — the Active Project section for quick nav, and the expanded tree node for context.

Implementation: In `nav-projects.tsx`, use a `useEffect` that watches `pathname`. Extract the project ID from the URL and call `toggleProject(id)` if not already expanded.

**3. New Global Pages**

Two new top-level pages in the Global zone:

**Gallery (`/dashboard/gallery`)** — Org-wide view of all generated content across all projects. Replaces the old `/posts` page. Features:
- Grid of generated post thumbnails
- Filter by: project, platform, style, date range
- Click to detail drawer (image viewer, description, download)
- Search by prompt text

**Styles (`/dashboard/styles`)** — Org-wide style management. Replaces the old `/styles` page. Features:
- Grid of visual styles (predefined + custom)
- Create style from text prompt or reference image
- Preview generation for styles
- Delete custom styles
- These styles are what the generate flow's Step 4 will use

Both pages are org-scoped (not project-scoped) because styles and generation history are shared resources.

---

## Part 2: Feature Gap Assessment — Old vs New Dashboard

### What the old dashboard had that we're missing

| Feature | Old Location | New Status | Priority |
|---------|-------------|------------|----------|
| **AI image generation (Gemini)** | `/generate` → `POST /api/generate` | Generate flow exists but doesn't call API | CRITICAL |
| **Posts gallery** | `/posts` | No equivalent page | HIGH |
| **Style management** | `/styles` | "Coming soon" placeholder in Step 4 | HIGH |
| **AI content idea generation** | `/content` → "Generate Ideas" button | Content page has sources but no "Generate Ideas" action | HIGH |
| **Post description generation** | `/posts` detail modal → "Generate Description" | Not in new UI | MEDIUM |
| **Post download (ZIP + individual)** | `/posts` detail modal | Not in new UI | MEDIUM |
| **Style preview generation** | `/styles` → "Generate Preview" | Not in new UI | MEDIUM |
| **Style from reference image** | `/styles` → "From Image" tab | Not in new UI | MEDIUM |
| **Active generation queue** | `/generate` right panel | Generate flow has static preview placeholder | MEDIUM |
| **Content idea type filtering (14 types)** | `/content` ideas view | Ideas tab has basic content type filter | LOW |
| **Brand logo upload** | `/brand` | Logo field exists in schema but no upload UI | LOW |
| **Color scheme presets** | `/generate` color picker | Not in Step 4 | LOW |

---

## Part 3: Remaining Implementation Items

Organized by priority tier. Each item includes what needs to be built, which files to create/modify, and estimated complexity.

### Tier 1: CRITICAL — Core Generation Pipeline

These items are the heart of the app. Without them, the 6-step generate flow is decorative.

#### 1.1 Wire Generate Flow to Gemini API

**What**: Replace the fake `handleGenerate()` in Step 5 with a real API call. The old `POST /api/generate` endpoint already does everything — calls Gemini, stores results as `GeneratedPost` + `GeneratedImage` records.

**Approach**: Call the existing `/api/generate` REST endpoint from `step-settings.tsx`, passing the accumulated store state (prompt, platforms, styles, brand identity, format, aspect ratio, model, variations, logo). Store the returned post IDs in the generate store. In `step-results.tsx`, fetch the created posts and display images/text.

**Files**:
- Modify: `src/components/generate/step-settings.tsx` — replace fake handler with real API call
- Modify: `src/components/generate/step-results.tsx` — fetch and display real results
- Modify: `src/lib/trpc/routers/generation.ts` — add `getByIds` query for fetching specific posts
- Create: `src/hooks/use-generations.ts` — hooks for generation queries

**Complexity**: Large (3-5 days). The API exists but needs adaptation for multi-platform, multi-style generation.

#### 1.2 AI Outline Generation (Step 3)

**What**: Replace `generateMockOutline()` with a real Gemini call that generates platform-specific content outlines from the user's prompt.

**Approach**: Create a new tRPC procedure `generation.generateOutline` that calls `geminiText.generateContent()` with a structured prompt requesting JSON output with sections per platform. Call it in `step-outline.tsx` on mount and on "Regenerate" click.

**Files**:
- Modify: `src/lib/trpc/routers/generation.ts` — add `generateOutline` mutation
- Modify: `src/components/generate/step-outline.tsx` — replace mock with API call + loading state
- Create: `src/hooks/use-generations.ts` (if not already created in 1.1)

**Complexity**: Medium (1-2 days). Gemini integration pattern exists in `src/lib/gemini.ts`.

### Tier 2: HIGH — Missing Pages

#### 2.1 Gallery Page (`/dashboard/gallery`)

**What**: Global view of all generated content across projects. The old `/posts` gallery but project-aware.

**Features**:
- Grid of post thumbnails with platform/style/date badges
- Filter by: project, platform, style, date range
- Click → detail drawer with:
  - Image viewer (carousel navigation for multi-slide)
  - Prompt, style, model info
  - AI description generation + edit + copy
  - Download (individual slide + ZIP for carousels)
  - "Move to project/campaign" action
- Empty state for new users

**Files**:
- Create: `src/app/(roks-workspace)/dashboard/gallery/page.tsx`
- Create: `src/components/post-card.tsx` — thumbnail card
- Create: `src/components/post-detail-drawer.tsx` — detail view
- Modify: `src/lib/trpc/routers/generation.ts` — add filtered list query, description generation mutation
- Modify: `src/hooks/use-generations.ts` — add query hooks
- Modify: `src/components/nav-global.tsx` — add Gallery link
- Modify: `src/components/command-menu.tsx` — add Gallery command

**Complexity**: Medium-Large (2-3 days). Much can be adapted from old `/posts` page.

#### 2.2 Styles Page (`/dashboard/styles`)

**What**: Org-wide visual style management. Browse, create, preview, delete styles.

**Features**:
- Grid of style cards with preview thumbnails
- Predefined styles (30+) auto-seeded
- Create custom style:
  - From text prompt (name + description + prompt → AI generates preview images)
  - From reference image (upload → AI analyzes style → generates samples)
- Delete custom styles
- Generate missing previews for predefined styles
- Styles selectable in generate flow Step 4

**Files**:
- Create: `src/app/(roks-workspace)/dashboard/styles/page.tsx`
- Create: `src/components/style-card.tsx`
- Create: `src/lib/trpc/routers/style.ts` — tRPC router wrapping existing REST endpoints or direct Prisma
- Create: `src/hooks/use-styles.ts`
- Modify: `src/components/nav-global.tsx` — add Styles link
- Modify: `src/components/command-menu.tsx` — add Styles command

**Complexity**: Medium (2-3 days). Style model already exists, REST endpoints exist in old app.

#### 2.3 Wire Style Picker into Generate Step 4

**What**: Replace "Style library integration coming soon" with a real style picker grid.

**Approach**: Fetch styles via the new tRPC router (or existing REST), render a multi-select thumbnail grid (same pattern as old generate page), write selections to `useGenerateStore.setStyleIds()`.

**Files**:
- Modify: `src/components/generate/step-style-brand.tsx` — replace placeholder with style grid
- Uses: `src/hooks/use-styles.ts` (from 2.2)

**Complexity**: Small (half day). Once the styles page/router exists, the picker is straightforward.

#### 2.4 AI Content Idea Generation

**What**: The old content page had a "Generate Ideas" button per source that called the AI to produce 20 post blueprints. This is missing from the new content page.

**Approach**: Add a `content.generateIdeas` tRPC mutation that calls the existing `/api/content/ideas/generate` REST endpoint logic (or reimplement in tRPC). Add a "Generate Ideas" button to each source card in the content page.

**Files**:
- Modify: `src/lib/trpc/routers/content.ts` — add `generateIdeas` mutation
- Modify: `src/hooks/use-content.ts` — add `useGenerateIdeas()` hook
- Modify: `src/app/(roks-workspace)/dashboard/projects/[id]/content/page.tsx` — add button + loading state

**Complexity**: Medium (1-2 days). Core AI logic exists in the old REST endpoint.

### Tier 3: MEDIUM — Generate Flow Completeness

#### 3.1 Content Input Modes (Step 2)

**What**: Enable "From Idea", "From Source", "Upload", "From Assets" tabs in Step 2.

**From Idea**: Searchable list of saved ideas (from `useIdeas()`), on select populate prompt + store `contentIdeaId`.
**From Source**: List of sources (from `useSources()`), on select extract key text into prompt.
**Upload**: Inline file upload (reuse `AssetUpload` component pattern).
**From Assets**: Asset picker grid (reuse `AssetGrid` component).

**Files**:
- Modify: `src/components/generate/step-content.tsx` — implement each mode tab

**Complexity**: Medium (1-2 days). Each mode is small but there are 4 of them.

#### 3.2 Post Description Generation & Download

**What**: AI-generated captions for posts + download as image/ZIP.

**Files**:
- Add to post detail drawer (from 2.1): "Generate Description" button, edit/copy/save
- Add to post detail drawer: "Download" button (individual + ZIP for carousels)
- Modify: `src/lib/trpc/routers/generation.ts` — add `generateDescription` mutation

**Complexity**: Small-Medium (1 day). Logic exists in old `/api/posts/[id]/description` and `/api/posts/[id]/download`.

#### 3.3 Generate Flow Preview Panel

**What**: Replace static "Preview" text with live mockups showing how content will look on each platform as the user makes selections.

**Approach**: Read from Zustand store, render platform-specific preview cards (Instagram square, LinkedIn text block, X character count, etc.) with brand colors applied.

**Files**:
- Create: `src/components/generate/preview-panel.tsx`
- Modify: `src/components/generate/generate-flow.tsx` — replace static Card with PreviewPanel

**Complexity**: Medium (1-2 days). Mostly UI work, no API calls needed.

#### 3.4 Campaign Generated Content Section

**What**: Campaign detail page "Generated Content" section currently shows empty state even when posts exist.

**Approach**: Query `generation.recent` filtered by `campaignId`, render post thumbnails in a grid.

**Files**:
- Modify: `src/lib/trpc/routers/generation.ts` — add `campaignId` filter to `recent` query
- Modify: `src/app/(roks-workspace)/dashboard/projects/[id]/campaigns/[campaignId]/page.tsx` — fetch and display posts

**Complexity**: Small (half day). Depends on 1.1 (generation pipeline) for posts to exist.

### Tier 4: LOW — Polish & UX

#### 4.1 Brand Identity Logo Upload

**What**: Brand cards show placeholder icon. Schema supports `logoAssetId` but no upload UI.

**Approach**: Add asset picker to brand edit dialog. Let user select from project assets or upload new.

**Files**:
- Modify: `src/app/(roks-workspace)/dashboard/projects/[id]/brands/page.tsx` — add logo field to edit dialog

**Complexity**: Small (half day).

#### 4.2 Favorite Reorder (Drag & Drop)

**What**: `useReorderFavorites` hook exists but no drag UI.

**Approach**: Add `@dnd-kit/sortable` to NavFavorites.

**Files**:
- Modify: `src/components/nav-favorites.tsx`
- Install: `bun add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

**Complexity**: Small (half day). Pattern already used in old DataTable component.

#### 4.3 Scoped Cache Invalidation

**What**: 8+ mutations use `queryClient.invalidateQueries()` with no key, nuking entire cache.

**Approach**: Replace with scoped invalidations passing specific query keys.

**Files**: All hook files in `src/hooks/`

**Complexity**: Small (1-2 hours). Mechanical find-and-replace with correct query keys.

---

## Part 4: Sidebar Implementation Changes

### New Components Needed

```
src/components/
  nav-active-project.tsx    — NEW: Active project sub-navigation section
  nav-global.tsx            — MODIFY: Add Gallery + Styles links
  nav-projects.tsx          — MODIFY: Auto-expand on navigation
  app-sidebar.tsx           — MODIFY: Add NavActiveProject zone
```

### `nav-active-project.tsx`

Renders when URL contains `/dashboard/projects/[id]`. Shows:
- Section header: "ACTIVE PROJECT" label + project name + color dot
- 6 sub-page links (same as project tree but always visible, no collapse)
- Active page highlighted
- "Close" button to navigate back to dashboard (clears active project)

Reads `projectId` from pathname via regex. Fetches project name via `useProject(id)`.

### `nav-projects.tsx` Changes

- Auto-expand: `useEffect` watches `pathname`, extracts project ID, calls `toggleProject(id)` to expand if not already expanded
- Visual distinction: active project node gets a subtle background highlight or left border accent

### `nav-global.tsx` Changes

Add two new items:
```typescript
const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Generate", url: "/dashboard/generate", icon: SparklesIcon },
  { title: "Gallery", url: "/dashboard/gallery", icon: GridIcon },      // NEW
  { title: "Styles", url: "/dashboard/styles", icon: PaletteIcon },     // NEW
  { title: "Asset Library", url: "/dashboard/assets", icon: LibraryIcon },
];
```

### `app-sidebar.tsx` Changes

Zone order:
1. Global Nav (with Gallery + Styles)
2. Active Project (conditional — only when in a project)
3. Favorites
4. Projects tree
5. Settings (bottom)
6. User (footer)

---

## Recommended Implementation Order

1. **Sidebar improvements** (1 day) — Active project section, auto-expand, Gallery + Styles links (as stubs)
2. **Styles page + tRPC router** (2 days) — Unblocks Step 4 style picker
3. **Wire Step 4 style picker** (half day) — Uses styles from above
4. **AI outline generation** (1-2 days) — Makes Step 3 functional
5. **Generation pipeline** (3-5 days) — The big one: wire Step 5 + Step 6 to Gemini
6. **Gallery page** (2-3 days) — View generated content, descriptions, downloads
7. **AI content idea generation** (1-2 days) — "Generate Ideas" button on sources
8. **Content input modes** (1-2 days) — Enable From Idea, From Source, etc.
9. **Polish** (1-2 days) — Preview panel, logo upload, favorite reorder, cache scoping

Total estimated: ~15-20 days of focused implementation.
