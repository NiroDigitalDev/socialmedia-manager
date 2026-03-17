# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `(roks-workspace)/dashboard` route group with project-based IA, Notion-style sidebar, and Gamma-inspired generation flow.

**Architecture:** Three-tier hierarchy (Global → Project → Campaign) with org-scoped multi-tenancy. Zustand for UI state, tRPC v11 + React Query for server state, custom `useX` hooks wrapping tRPC. All UI follows shadcn dashboard patterns (container queries, data-slot selectors, Card/Drawer/Table primitives).

**Tech Stack:** Next.js 16, Prisma (PostgreSQL), tRPC v11, @tanstack/react-query, Zustand, shadcn/ui (radix-nova), Tailwind CSS, Cloudflare R2, Gemini AI

**Spec:** `docs/superpowers/specs/2026-03-16-dashboard-redesign-design.md`

---

## File Structure

### Prisma
```
prisma/
  schema.prisma                          — add Project, Campaign, BrandIdentity, Asset, Favorite models; modify existing models with orgId/projectId
  migrations/YYYYMMDD_dashboard_redesign — auto-generated migration
```

### tRPC Routers
```
src/lib/trpc/
  init.ts                                — add orgProtectedProcedure (validates session + active org)
  router.ts                              — register new sub-routers
  routers/
    project.ts                           — Project CRUD, list by org
    campaign.ts                          — Campaign CRUD, list by project
    brand-identity.ts                    — BrandIdentity CRUD, duplicate, list by project
    asset.ts                             — Asset upload/list/move/delete
    favorite.ts                          — Favorite add/remove/reorder/list
    content.ts                           — ContentSource + ContentIdea (new, replaces REST)
    generation.ts                        — Generation session create/poll/results
```

### Zustand Stores
```
src/stores/
  use-sidebar-store.ts                   — expanded project IDs, collapsed sections
  use-generate-store.ts                  — 6-step flow state (platforms, content, outline, style, settings, results)
```

### Custom Hooks (tRPC wrappers)
```
src/hooks/
  use-projects.ts                        — useProjects(), useProject(id), useCreateProject(), useUpdateProject(), useDeleteProject()
  use-campaigns.ts                       — useCampaigns(projectId), useCampaign(id), useCreateCampaign()
  use-brand-identities.ts                — useBrandIdentities(projectId), useCreateBrandIdentity(), useDuplicateBrandIdentity()
  use-assets.ts                          — useAssets(scope, projectId?), useUploadAsset(), useMoveAsset(), useDeleteAsset()
  use-favorites.ts                       — useFavorites(), useToggleFavorite(), useReorderFavorites()
  use-content.ts                         — useSources(projectId), useIdeas(projectId, filters), useGenerateIdeas()
  use-generations.ts                     — useRecentGenerations(scope?), useGeneration(id)
```

### Sidebar Components
```
src/components/
  app-sidebar.tsx                        — rebuild: zones 1-4 + footer
  nav-global.tsx                         — Zone 1: Dashboard, Generate, Asset Library
  nav-favorites.tsx                      — Zone 2: pinned items, star toggle
  nav-projects.tsx                       — Zone 3: project tree with expandable sub-pages
  nav-user.tsx                           — Footer: user dropdown (keep existing, minor updates)
  nav-secondary.tsx                      — Zone 4: Settings (keep existing, remove Help)
  command-menu.tsx                       — update search groups to match new IA
```

### Pages (all under `src/app/(roks-workspace)/dashboard/`)
```
page.tsx                                 — Dashboard home
generate/page.tsx                        — Global generate flow
assets/page.tsx                          — Global asset library
projects/page.tsx                        — Project list
projects/[id]/page.tsx                   — Project overview
projects/[id]/layout.tsx                 — Project layout (provides project context)
projects/[id]/content/page.tsx           — Content sources + ideas
projects/[id]/campaigns/page.tsx         — Campaign list
projects/[id]/campaigns/[campaignId]/page.tsx — Campaign detail
projects/[id]/brands/page.tsx            — Brand identities
projects/[id]/assets/page.tsx            — Project asset library
projects/[id]/generate/page.tsx          — Project-scoped generate
settings/page.tsx                        — Keep existing
```

### Generate Flow Components
```
src/components/generate/
  generate-flow.tsx                      — Main layout (left rail + main + right preview)
  step-navigator.tsx                     — Left rail step list with status indicators
  step-platforms.tsx                     — Step 1: platform multi-select cards
  step-content.tsx                       — Step 2: content input modes
  step-outline.tsx                       — Step 3: AI-generated outline per platform
  step-style-brand.tsx                   — Step 4: style picker + brand identity
  step-settings.tsx                      — Step 5: final config + generate button
  step-results.tsx                       — Step 6: results by platform
```

### Shared Components
```
src/components/
  project-card.tsx                       — Project card for list/dashboard
  campaign-card.tsx                      — Campaign card
  brand-identity-card.tsx                — Brand identity card with color swatches
  asset-grid.tsx                         — Reusable asset grid (global + project)
  asset-upload.tsx                       — Drag & drop upload zone
  content-source-card.tsx                — Content source card
  content-idea-card.tsx                  — Content idea card with badges
  empty-state.tsx                        — Reusable empty state component
  favorite-star.tsx                      — Star toggle for favorites
```

---

## Chunk 1: Foundation — Schema, Zustand, tRPC Infrastructure

This chunk sets up the database schema, installs Zustand, and creates the org-scoped tRPC procedure that all new routers will use. No UI changes yet.

### Task 1.1: Install Zustand

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install zustand**

```bash
bun add zustand
```

- [ ] **Step 2: Verify installation**

```bash
bun run build
```
Expected: Build succeeds, no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add zustand for client-side state management"
```

---

### Task 1.2: Update Prisma Schema — New Entities

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enums and new models to schema.prisma**

Add after the existing models:

```prisma
enum Platform {
  instagram
  linkedin
  reddit
  x
  blog
  email
}

enum CampaignStatus {
  draft
  active
  completed
  archived
}

enum AssetCategory {
  reference
  asset
}

enum FavoriteTargetType {
  project
  campaign
  route
}

model Project {
  id          String          @id @default(cuid())
  name        String
  description String?
  color       String?
  orgId       String
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  campaigns       Campaign[]
  brandIdentities BrandIdentity[]
  contentSources  ContentSource[]   @relation("ProjectContentSources")
  contentIdeas    ContentIdea[]     @relation("ProjectContentIdeas")
  posts           GeneratedPost[]   @relation("ProjectPosts")
  assets          Asset[]

  @@index([orgId])
}

model Campaign {
  id              String         @id @default(cuid())
  name            String
  description     String?
  projectId       String
  project         Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  brandIdentityId String?
  brandIdentity   BrandIdentity? @relation(fields: [brandIdentityId], references: [id], onDelete: SetNull)
  status          CampaignStatus @default(draft)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  contentIdeas ContentIdea[] @relation("CampaignContentIdeas")
  posts        GeneratedPost[] @relation("CampaignPosts")

  @@index([projectId])
}

model BrandIdentity {
  id          String        @id @default(cuid())
  name        String
  tagline     String?
  logoAssetId String?
  projectId   String
  project     Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  orgId       String
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  palettes  BrandPalette[] @relation("BrandIdentityPalettes")
  campaigns Campaign[]

  @@index([projectId])
  @@index([orgId])
}

model Asset {
  id        String        @id @default(cuid())
  r2Key     String
  mimeType  String
  fileName  String
  category  AssetCategory
  projectId String?
  project   Project?      @relation(fields: [projectId], references: [id], onDelete: SetNull)
  orgId     String
  createdAt DateTime      @default(now())

  @@index([orgId])
  @@index([projectId])
}

model Favorite {
  id         String             @id @default(cuid())
  userId     String
  targetType FavoriteTargetType
  targetId   String
  order      Int                @default(0)
  createdAt  DateTime           @default(now())

  @@unique([userId, targetType, targetId])
  @@index([userId])
}
```

- [ ] **Step 2: Modify existing models — add orgId, projectId, campaignId, platform**

Update `Style`:
```prisma
model Style {
  id               String          @id @default(cuid())
  name             String
  description      String?
  promptText       String
  referenceImageId String?
  sampleImageIds   String[]
  isPredefined     Boolean         @default(false)
  orgId            String?
  createdAt        DateTime        @default(now())
  posts            GeneratedPost[]

  @@index([orgId])
}
```

Update `ContentSource`:
```prisma
model ContentSource {
  id        String        @id @default(cuid())
  title     String
  rawText   String
  orgId     String?
  projectId String?
  project   Project?      @relation("ProjectContentSources", fields: [projectId], references: [id], onDelete: SetNull)
  createdAt DateTime      @default(now())
  ideas     ContentIdea[]

  @@index([orgId])
  @@index([projectId])
}
```

Update `ContentIdea`:
```prisma
model ContentIdea {
  id           String          @id @default(cuid())
  sourceId     String
  source       ContentSource   @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  ideaText     String
  contentType  String
  format       String
  slideCount   Int             @default(1)
  slidePrompts String[]
  styleGuide   String?
  isSaved      Boolean         @default(false)
  orgId        String?
  projectId    String?
  project      Project?        @relation("ProjectContentIdeas", fields: [projectId], references: [id], onDelete: SetNull)
  campaignId   String?
  campaign     Campaign?       @relation("CampaignContentIdeas", fields: [campaignId], references: [id], onDelete: SetNull)
  createdAt    DateTime        @default(now())
  posts        GeneratedPost[]

  @@index([orgId])
  @@index([projectId])
  @@index([campaignId])
}
```

Update `BrandPalette`:
```prisma
model BrandPalette {
  id              String         @id @default(cuid())
  name            String
  accentColor     String
  bgColor         String
  brandIdentityId String?
  brandIdentity   BrandIdentity? @relation("BrandIdentityPalettes", fields: [brandIdentityId], references: [id], onDelete: Cascade)
  createdAt       DateTime       @default(now())

  @@index([brandIdentityId])
}
```

Update `GeneratedPost`:
```prisma
model GeneratedPost {
  id            String           @id @default(cuid())
  styleId       String?
  style         Style?           @relation(fields: [styleId], references: [id])
  contentIdeaId String?
  contentIdea   ContentIdea?     @relation(fields: [contentIdeaId], references: [id])
  prompt        String
  format        String
  aspectRatio   String
  model         String
  includeLogo   Boolean          @default(false)
  status        String           @default("pending")
  description   String?
  textContent   String?
  platform      Platform?
  orgId         String?
  projectId     String?
  project       Project?         @relation("ProjectPosts", fields: [projectId], references: [id], onDelete: SetNull)
  campaignId    String?
  campaign      Campaign?        @relation("CampaignPosts", fields: [campaignId], references: [id], onDelete: SetNull)
  createdAt     DateTime         @default(now())
  images        GeneratedImage[]

  @@index([orgId])
  @@index([projectId])
  @@index([campaignId])
}
```

Note: `orgId`, `projectId`, `campaignId`, `platform` on existing entities are nullable to avoid breaking existing data. New records should always set `orgId`.

- [ ] **Step 3: Generate and apply migration**

```bash
cd /Users/rokgoropevsek/Documents/NiroDigital/projects/socialmedia-manager
bunx prisma migrate dev --name dashboard_redesign
```

Expected: Migration created and applied successfully.

- [ ] **Step 4: Verify Prisma generate works**

```bash
bunx prisma generate
```

Expected: Client generated to `src/generated/prisma/`.

- [ ] **Step 5: Verify build**

```bash
bun run build
```

Expected: Build succeeds. Existing code still works (all new fields are nullable).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Project, Campaign, BrandIdentity, Asset, Favorite models and org-scope fields"
```

---

### Task 1.3: Add Org-Scoped tRPC Procedure

**Files:**
- Modify: `src/lib/trpc/init.ts`

- [ ] **Step 1: Add orgProtectedProcedure**

This middleware validates the session AND ensures an active organization is set. All new routers will use this instead of `protectedProcedure`.

Add after the existing `protectedProcedure`:

```typescript
export const orgProtectedProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const orgId = opts.ctx.session.session.activeOrganizationId;
  if (!orgId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No active organization. Select an organization first.",
    });
  }

  // Verify membership
  const membership = await opts.ctx.prisma.member.findFirst({
    where: {
      userId: opts.ctx.session.user.id,
      organizationId: orgId,
    },
  });

  if (!membership) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this organization" });
  }

  return opts.next({
    ctx: {
      ...opts.ctx,
      session: opts.ctx.session,
      orgId,
      membership,
    },
  });
});
```

- [ ] **Step 2: Verify build**

```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/trpc/init.ts
git commit -m "feat: add orgProtectedProcedure for org-scoped tRPC routes"
```

---

### Task 1.4: Create Project tRPC Router

**Files:**
- Create: `src/lib/trpc/routers/project.ts`
- Modify: `src/lib/trpc/router.ts`

- [ ] **Step 1: Create project router**

Create `src/lib/trpc/routers/project.ts`:

```typescript
import { z } from "zod";
import { router, orgProtectedProcedure } from "../init";

export const projectRouter = router({
  list: orgProtectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.project.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { campaigns: true, posts: true },
        },
      },
    });
  }),

  get: orgProtectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.id, orgId: ctx.orgId },
        include: {
          _count: {
            select: {
              campaigns: true,
              brandIdentities: true,
              contentSources: true,
              posts: true,
              assets: true,
            },
          },
        },
      });
      if (!project) {
        throw new (await import("@trpc/server")).TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }
      return project;
    }),

  create: orgProtectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.project.create({
        data: {
          ...input,
          orgId: ctx.orgId,
        },
      });
    }),

  update: orgProtectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      // Verify org ownership first (Prisma .update() only accepts unique fields in where)
      const project = await ctx.prisma.project.findFirst({
        where: { id, orgId: ctx.orgId },
      });
      if (!project) {
        throw new (await import("@trpc/server")).TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }
      return ctx.prisma.project.update({ where: { id }, data });
    }),

  delete: orgProtectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify org ownership first
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.id, orgId: ctx.orgId },
      });
      if (!project) {
        throw new (await import("@trpc/server")).TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }
      await ctx.prisma.project.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
```

- [ ] **Step 2: Register in root router**

Update `src/lib/trpc/router.ts`:

```typescript
import { router } from "./init";
import { userRouter } from "./routers/user";
import { orgRouter } from "./routers/org";
import { projectRouter } from "./routers/project";

export const appRouter = router({
  user: userRouter,
  org: orgRouter,
  project: projectRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 3: Verify build**

```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/trpc/routers/project.ts src/lib/trpc/router.ts
git commit -m "feat: add project tRPC router with CRUD operations"
```

---

### Task 1.5: Create Remaining tRPC Routers (Campaign, BrandIdentity, Favorite)

**Files:**
- Create: `src/lib/trpc/routers/campaign.ts`
- Create: `src/lib/trpc/routers/brand-identity.ts`
- Create: `src/lib/trpc/routers/favorite.ts`
- Modify: `src/lib/trpc/router.ts`

- [ ] **Step 1: Create campaign router**

Create `src/lib/trpc/routers/campaign.ts`:

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, orgProtectedProcedure } from "../init";

export const campaignRouter = router({
  list: orgProtectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify project belongs to org
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, orgId: ctx.orgId },
      });
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      return ctx.prisma.campaign.findMany({
        where: { projectId: input.projectId },
        orderBy: { updatedAt: "desc" },
        include: {
          brandIdentity: { select: { id: true, name: true } },
          _count: { select: { posts: true, contentIdeas: true } },
        },
      });
    }),

  get: orgProtectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.campaign.findFirst({
        where: { id: input.id, project: { orgId: ctx.orgId } },
        include: {
          brandIdentity: true,
          project: { select: { id: true, name: true } },
          _count: { select: { posts: true, contentIdeas: true } },
        },
      });
      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }
      return campaign;
    }),

  create: orgProtectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        brandIdentityId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, orgId: ctx.orgId },
      });
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      return ctx.prisma.campaign.create({ data: input });
    }),

  update: orgProtectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).optional(),
        brandIdentityId: z.string().nullable().optional(),
        status: z.enum(["draft", "active", "completed", "archived"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const campaign = await ctx.prisma.campaign.findFirst({
        where: { id, project: { orgId: ctx.orgId } },
      });
      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }
      return ctx.prisma.campaign.update({ where: { id }, data });
    }),

  delete: orgProtectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.prisma.campaign.findFirst({
        where: { id: input.id, project: { orgId: ctx.orgId } },
      });
      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }
      await ctx.prisma.campaign.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
```

- [ ] **Step 2: Create brand identity router**

Create `src/lib/trpc/routers/brand-identity.ts`:

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, orgProtectedProcedure } from "../init";

export const brandIdentityRouter = router({
  list: orgProtectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, orgId: ctx.orgId },
      });
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      return ctx.prisma.brandIdentity.findMany({
        where: { projectId: input.projectId },
        include: { palettes: true },
        orderBy: { createdAt: "desc" },
      });
    }),

  get: orgProtectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const identity = await ctx.prisma.brandIdentity.findFirst({
        where: { id: input.id, orgId: ctx.orgId },
        include: { palettes: true },
      });
      if (!identity) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Brand identity not found" });
      }
      return identity;
    }),

  create: orgProtectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().min(1).max(200),
        tagline: z.string().max(500).optional(),
        logoAssetId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findFirst({
        where: { id: input.projectId, orgId: ctx.orgId },
      });
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      return ctx.prisma.brandIdentity.create({
        data: { ...input, orgId: ctx.orgId },
      });
    }),

  update: orgProtectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        tagline: z.string().max(500).optional(),
        logoAssetId: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const identity = await ctx.prisma.brandIdentity.findFirst({
        where: { id, orgId: ctx.orgId },
      });
      if (!identity) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Brand identity not found" });
      }
      return ctx.prisma.brandIdentity.update({ where: { id }, data });
    }),

  duplicate: orgProtectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const source = await ctx.prisma.brandIdentity.findFirst({
        where: { id: input.id, orgId: ctx.orgId },
        include: { palettes: true },
      });
      if (!source) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Brand identity not found" });
      }
      return ctx.prisma.brandIdentity.create({
        data: {
          name: `${source.name} (Copy)`,
          tagline: source.tagline,
          logoAssetId: source.logoAssetId,
          projectId: source.projectId,
          orgId: ctx.orgId,
          palettes: {
            create: source.palettes.map((p) => ({
              name: p.name,
              accentColor: p.accentColor,
              bgColor: p.bgColor,
            })),
          },
        },
      });
    }),

  delete: orgProtectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const identity = await ctx.prisma.brandIdentity.findFirst({
        where: { id: input.id, orgId: ctx.orgId },
      });
      if (!identity) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Brand identity not found" });
      }
      await ctx.prisma.brandIdentity.delete({ where: { id: input.id } });
      return { success: true };
    }),

  addPalette: orgProtectedProcedure
    .input(
      z.object({
        brandIdentityId: z.string(),
        name: z.string().min(1),
        accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const identity = await ctx.prisma.brandIdentity.findFirst({
        where: { id: input.brandIdentityId, orgId: ctx.orgId },
      });
      if (!identity) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Brand identity not found" });
      }
      return ctx.prisma.brandPalette.create({
        data: {
          name: input.name,
          accentColor: input.accentColor,
          bgColor: input.bgColor,
          brandIdentityId: input.brandIdentityId,
        },
      });
    }),

  removePalette: orgProtectedProcedure
    .input(z.object({ paletteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const palette = await ctx.prisma.brandPalette.findFirst({
        where: { id: input.paletteId, brandIdentity: { orgId: ctx.orgId } },
      });
      if (!palette) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Palette not found" });
      }
      await ctx.prisma.brandPalette.delete({ where: { id: input.paletteId } });
      return { success: true };
    }),
});
```

- [ ] **Step 3: Create favorite router**

Create `src/lib/trpc/routers/favorite.ts`:

```typescript
import { z } from "zod";
import { router, protectedProcedure } from "../init";

export const favoriteRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.favorite.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { order: "asc" },
    });
  }),

  add: protectedProcedure
    .input(
      z.object({
        targetType: z.enum(["project", "campaign", "route"]),
        targetId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const maxOrder = await ctx.prisma.favorite.aggregate({
        where: { userId: ctx.session.user.id },
        _max: { order: true },
      });
      return ctx.prisma.favorite.upsert({
        where: {
          userId_targetType_targetId: {
            userId: ctx.session.user.id,
            targetType: input.targetType,
            targetId: input.targetId,
          },
        },
        create: {
          userId: ctx.session.user.id,
          ...input,
          order: (maxOrder._max.order ?? -1) + 1,
        },
        update: {},
      });
    }),

  remove: protectedProcedure
    .input(
      z.object({
        targetType: z.enum(["project", "campaign", "route"]),
        targetId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.favorite.deleteMany({
        where: {
          userId: ctx.session.user.id,
          targetType: input.targetType,
          targetId: input.targetId,
        },
      });
      return { success: true };
    }),

  reorder: protectedProcedure
    .input(z.array(z.object({ id: z.string(), order: z.number() })))
    .mutation(async ({ ctx, input }) => {
      // Use interactive transaction (batch variant may not work with @prisma/adapter-pg)
      await ctx.prisma.$transaction(async (tx) => {
        for (const item of input) {
          await tx.favorite.update({
            where: { id: item.id, userId: ctx.session.user.id },
            data: { order: item.order },
          });
        }
      });
      return { success: true };
    }),
});
```

- [ ] **Step 4: Register all new routers**

Update `src/lib/trpc/router.ts`:

```typescript
import { router } from "./init";
import { userRouter } from "./routers/user";
import { orgRouter } from "./routers/org";
import { projectRouter } from "./routers/project";
import { campaignRouter } from "./routers/campaign";
import { brandIdentityRouter } from "./routers/brand-identity";
import { favoriteRouter } from "./routers/favorite";

export const appRouter = router({
  user: userRouter,
  org: orgRouter,
  project: projectRouter,
  campaign: campaignRouter,
  brandIdentity: brandIdentityRouter,
  favorite: favoriteRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 5: Verify build**

```bash
bun run build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/lib/trpc/routers/campaign.ts src/lib/trpc/routers/brand-identity.ts src/lib/trpc/routers/favorite.ts src/lib/trpc/router.ts
git commit -m "feat: add campaign, brand identity, and favorite tRPC routers"
```

---

### Task 1.6: Create Zustand Stores

**Files:**
- Create: `src/stores/use-sidebar-store.ts`
- Create: `src/stores/use-generate-store.ts`

- [ ] **Step 1: Create sidebar store**

Create `src/stores/use-sidebar-store.ts`:

```typescript
import { create } from "zustand";

interface SidebarState {
  expandedProjectIds: Set<string>;
  favoritesCollapsed: boolean;
  projectsCollapsed: boolean;
  toggleProject: (projectId: string) => void;
  toggleFavorites: () => void;
  toggleProjects: () => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  expandedProjectIds: new Set(),
  favoritesCollapsed: false,
  projectsCollapsed: false,

  toggleProject: (projectId) =>
    set((state) => {
      const next = new Set(state.expandedProjectIds);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return { expandedProjectIds: next };
    }),

  toggleFavorites: () =>
    set((state) => ({ favoritesCollapsed: !state.favoritesCollapsed })),

  toggleProjects: () =>
    set((state) => ({ projectsCollapsed: !state.projectsCollapsed })),
}));
```

- [ ] **Step 2: Create generate store**

Create `src/stores/use-generate-store.ts`:

```typescript
import { create } from "zustand";

export type Platform = "instagram" | "linkedin" | "reddit" | "x" | "blog" | "email";

export interface ContentInput {
  prompt: string;
  contentIdeaId?: string;
  contentSourceId?: string;
  assetIds?: string[];
}

export interface OutlineSection {
  id: string;
  platform: Platform;
  label: string;
  content: string;
  order: number;
}

export interface GenerateState {
  // Flow
  step: number;
  maxCompletedStep: number;

  // Step 1
  platforms: Platform[];

  // Step 2
  content: ContentInput;

  // Step 3
  outline: OutlineSection[] | null;

  // Step 4
  styleIds: string[];
  brandIdentityId: string | null;
  colorOverride: { accent: string; bg: string } | null;

  // Step 5
  settings: {
    formatPerPlatform: Record<string, string>;
    aspectRatioPerPlatform: Record<string, string>;
    model: "flash" | "pro";
    variations: number;
    includeLogo: boolean;
  };

  // Step 6
  generationId: string | null;

  // Context
  projectId: string | null;
  campaignId: string | null;

  // Actions
  setStep: (step: number) => void;
  setPlatforms: (platforms: Platform[]) => void;
  setContent: (content: Partial<ContentInput>) => void;
  setOutline: (outline: OutlineSection[]) => void;
  updateOutlineSection: (id: string, content: string) => void;
  setStyleIds: (ids: string[]) => void;
  setBrandIdentityId: (id: string | null) => void;
  setColorOverride: (override: { accent: string; bg: string } | null) => void;
  updateSettings: (settings: Partial<GenerateState["settings"]>) => void;
  setGenerationId: (id: string | null) => void;
  setContext: (projectId: string | null, campaignId: string | null) => void;
  reset: () => void;
}

const initialSettings = {
  formatPerPlatform: {},
  aspectRatioPerPlatform: {},
  model: "flash" as const,
  variations: 1,
  includeLogo: false,
};

export const useGenerateStore = create<GenerateState>((set) => ({
  step: 1,
  maxCompletedStep: 0,
  platforms: [],
  content: { prompt: "" },
  outline: null,
  styleIds: [],
  brandIdentityId: null,
  colorOverride: null,
  settings: { ...initialSettings },
  generationId: null,
  projectId: null,
  campaignId: null,

  setStep: (step) =>
    set((state) => ({
      step,
      maxCompletedStep: Math.max(state.maxCompletedStep, step - 1),
    })),
  setPlatforms: (platforms) => set({ platforms }),
  setContent: (content) =>
    set((state) => ({ content: { ...state.content, ...content } })),
  setOutline: (outline) => set({ outline }),
  updateOutlineSection: (id, content) =>
    set((state) => ({
      outline: state.outline?.map((s) => (s.id === id ? { ...s, content } : s)) ?? null,
    })),
  setStyleIds: (styleIds) => set({ styleIds }),
  setBrandIdentityId: (brandIdentityId) => set({ brandIdentityId }),
  setColorOverride: (colorOverride) => set({ colorOverride }),
  updateSettings: (settings) =>
    set((state) => ({ settings: { ...state.settings, ...settings } })),
  setGenerationId: (generationId) => set({ generationId }),
  setContext: (projectId, campaignId) => set({ projectId, campaignId }),
  reset: () =>
    set({
      step: 1,
      maxCompletedStep: 0,
      platforms: [],
      content: { prompt: "" },
      outline: null,
      styleIds: [],
      brandIdentityId: null,
      colorOverride: null,
      settings: { ...initialSettings },
      generationId: null,
      projectId: null,
      campaignId: null,
    }),
}));
```

- [ ] **Step 3: Verify build**

```bash
bun run build
```

- [ ] **Step 4: Commit**

```bash
git add src/stores/
git commit -m "feat: add Zustand stores for sidebar and generate flow state"
```

---

### Task 1.7: Create Custom Hooks (tRPC Wrappers)

**Files:**
- Create: `src/hooks/use-projects.ts`
- Create: `src/hooks/use-campaigns.ts`
- Create: `src/hooks/use-brand-identities.ts`
- Create: `src/hooks/use-favorites.ts`

Note: The tRPC v11 + `@trpc/tanstack-react-query` pattern uses `useTRPC()` to get query/mutation options, then passes them to `useQuery()`/`useMutation()` from `@tanstack/react-query`.

- [ ] **Step 1: Create project hooks**

Create `src/hooks/use-projects.ts`:

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";

export function useProjects() {
  const trpc = useTRPC();
  return useQuery(trpc.project.list.queryOptions());
}

export function useProject(id: string) {
  const trpc = useTRPC();
  return useQuery(trpc.project.get.queryOptions({ id }));
}

export function useCreateProject() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.project.create.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.project.list.queryKey() });
    },
  });
}

export function useUpdateProject() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.project.update.mutationOptions(),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: trpc.project.list.queryKey() });
      queryClient.invalidateQueries({
        queryKey: trpc.project.get.queryKey({ id: variables.id }),
      });
    },
  });
}

export function useDeleteProject() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.project.delete.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.project.list.queryKey() });
    },
  });
}
```

- [ ] **Step 2: Create campaign hooks**

Create `src/hooks/use-campaigns.ts`:

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";

export function useCampaigns(projectId: string) {
  const trpc = useTRPC();
  return useQuery(trpc.campaign.list.queryOptions({ projectId }));
}

export function useCampaign(id: string) {
  const trpc = useTRPC();
  return useQuery(trpc.campaign.get.queryOptions({ id }));
}

export function useCreateCampaign() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.campaign.create.mutationOptions(),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.campaign.list.queryKey({ projectId: variables.projectId }),
      });
    },
  });
}

export function useUpdateCampaign() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.campaign.update.mutationOptions(),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.campaign.get.queryKey({ id: variables.id }),
      });
    },
  });
}

export function useDeleteCampaign() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.campaign.delete.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}
```

- [ ] **Step 3: Create brand identity hooks**

Create `src/hooks/use-brand-identities.ts`:

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";

export function useBrandIdentities(projectId: string) {
  const trpc = useTRPC();
  return useQuery(trpc.brandIdentity.list.queryOptions({ projectId }));
}

export function useBrandIdentity(id: string) {
  const trpc = useTRPC();
  return useQuery(trpc.brandIdentity.get.queryOptions({ id }));
}

export function useCreateBrandIdentity() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.brandIdentity.create.mutationOptions(),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.brandIdentity.list.queryKey({ projectId: variables.projectId }),
      });
    },
  });
}

export function useUpdateBrandIdentity() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.brandIdentity.update.mutationOptions(),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.brandIdentity.get.queryKey({ id: variables.id }),
      });
    },
  });
}

export function useDuplicateBrandIdentity() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.brandIdentity.duplicate.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function useDeleteBrandIdentity() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.brandIdentity.delete.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function useAddPalette() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.brandIdentity.addPalette.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function useRemovePalette() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.brandIdentity.removePalette.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}
```

- [ ] **Step 4: Create favorite hooks**

Create `src/hooks/use-favorites.ts`:

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";

export function useFavorites() {
  const trpc = useTRPC();
  return useQuery(trpc.favorite.list.queryOptions());
}

export function useAddFavorite() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.favorite.add.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.favorite.list.queryKey() });
    },
  });
}

export function useRemoveFavorite() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.favorite.remove.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.favorite.list.queryKey() });
    },
  });
}

export function useReorderFavorites() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.favorite.reorder.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.favorite.list.queryKey() });
    },
  });
}
```

- [ ] **Step 5: Verify build**

```bash
bun run build
```

- [ ] **Step 6: Commit**

```bash
git add src/hooks/
git commit -m "feat: add custom hooks wrapping tRPC for projects, campaigns, brand identities, favorites"
```

---

## Chunk 2: Sidebar Rebuild + Navigation Shell

Rebuild the sidebar with all four zones. The demo dashboard's existing shell (layout, site-header) stays — only the sidebar content changes.

### Task 2.1: Create NavGlobal Component (Zone 1)

**Files:**
- Create: `src/components/nav-global.tsx`

- [ ] **Step 1: Create component**

Create `src/components/nav-global.tsx`:

```typescript
"use client";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { LayoutDashboardIcon, SparklesIcon, LibraryIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Generate", url: "/dashboard/generate", icon: SparklesIcon },
  { title: "Asset Library", url: "/dashboard/assets", icon: LibraryIcon },
];

export function NavGlobal() {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.url}
                tooltip={item.title}
              >
                <Link href={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
bun run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/nav-global.tsx
git commit -m "feat: add NavGlobal sidebar component for Zone 1"
```

---

### Task 2.2: Create NavFavorites Component (Zone 2)

**Files:**
- Create: `src/components/nav-favorites.tsx`

- [ ] **Step 1: Create component**

Create `src/components/nav-favorites.tsx`:

```typescript
"use client";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroupAction,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { StarIcon, FolderIcon, FlaskConicalIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useFavorites } from "@/hooks/use-favorites";
import { useSidebarStore } from "@/stores/use-sidebar-store";

const iconMap: Record<string, React.ElementType> = {
  project: FolderIcon,
  campaign: FlaskConicalIcon,
  route: StarIcon,
};

export function NavFavorites() {
  const { data: favorites } = useFavorites();
  const { favoritesCollapsed, toggleFavorites } = useSidebarStore();

  if (!favorites || favorites.length === 0) {
    return null;
  }

  return (
    <Collapsible open={!favoritesCollapsed} onOpenChange={toggleFavorites}>
      <SidebarGroup>
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel className="cursor-pointer">
            Favorites
            <ChevronRightIcon className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {favorites.map((fav) => {
                const Icon = iconMap[fav.targetType] ?? StarIcon;
                const href =
                  fav.targetType === "route"
                    ? fav.targetId
                    : fav.targetType === "project"
                      ? `/dashboard/projects/${fav.targetId}`
                      : "#";
                return (
                  <SidebarMenuItem key={fav.id}>
                    <SidebarMenuButton asChild tooltip={fav.targetId}>
                      <Link href={href}>
                        <Icon className="size-4" />
                        <span className="truncate">{fav.targetId}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}
```

Note: Favorite display names will be enriched later when we resolve project/campaign names. For now, `targetId` is shown. This is a known placeholder.

- [ ] **Step 2: Verify build**

```bash
bun run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/nav-favorites.tsx
git commit -m "feat: add NavFavorites sidebar component for Zone 2"
```

---

### Task 2.3: Create NavProjects Component (Zone 3)

**Files:**
- Create: `src/components/nav-projects.tsx`

- [ ] **Step 1: Create component**

Create `src/components/nav-projects.tsx`:

```typescript
"use client";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  PlusIcon,
  ChevronRightIcon,
  LayoutListIcon,
  FileTextIcon,
  FlaskConicalIcon,
  PaletteIcon,
  ImageIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProjects } from "@/hooks/use-projects";
import { useSidebarStore } from "@/stores/use-sidebar-store";

const projectSubPages = [
  { title: "Overview", segment: "", icon: LayoutListIcon },
  { title: "Content", segment: "/content", icon: FileTextIcon },
  { title: "Campaigns", segment: "/campaigns", icon: FlaskConicalIcon },
  { title: "Brand Identities", segment: "/brands", icon: PaletteIcon },
  { title: "Assets", segment: "/assets", icon: ImageIcon },
  { title: "Generate", segment: "/generate", icon: SparklesIcon },
];

export function NavProjects() {
  const pathname = usePathname();
  const { data: projects } = useProjects();
  const { expandedProjectIds, projectsCollapsed, toggleProject, toggleProjects } =
    useSidebarStore();

  return (
    <Collapsible open={!projectsCollapsed} onOpenChange={toggleProjects}>
      <SidebarGroup>
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel className="cursor-pointer">
            Projects
            <ChevronRightIcon className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <SidebarGroupAction asChild>
          <Link href="/dashboard/projects?create=true" title="New Project">
            <PlusIcon />
          </Link>
        </SidebarGroupAction>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {projects?.map((project) => {
                const isExpanded = expandedProjectIds.has(project.id);
                const projectBase = `/dashboard/projects/${project.id}`;

                return (
                  <Collapsible
                    key={project.id}
                    open={isExpanded}
                    onOpenChange={() => toggleProject(project.id)}
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip={project.name}>
                          <div
                            className="size-3 shrink-0 rounded-sm"
                            style={{ backgroundColor: project.color ?? "#737373" }}
                          />
                          <span className="truncate">{project.name}</span>
                          <ChevronRightIcon className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {projectSubPages.map((sub) => {
                            const href = `${projectBase}${sub.segment}`;
                            const isActive =
                              sub.segment === ""
                                ? pathname === projectBase
                                : pathname.startsWith(href);
                            return (
                              <SidebarMenuSubItem key={sub.title}>
                                <SidebarMenuSubButton asChild isActive={isActive}>
                                  <Link href={href}>
                                    <sub.icon className="size-4" />
                                    <span>{sub.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}

              {(!projects || projects.length === 0) && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link
                      href="/dashboard/projects?create=true"
                      className="text-muted-foreground"
                    >
                      <PlusIcon className="size-4" />
                      <span>Create your first project</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
bun run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/nav-projects.tsx
git commit -m "feat: add NavProjects sidebar component for Zone 3 with expandable project tree"
```

---

### Task 2.4: Rebuild AppSidebar

**Files:**
- Modify: `src/components/app-sidebar.tsx`

- [ ] **Step 1: Rewrite app-sidebar.tsx**

Replace the entire sidebar content with the new zone-based structure. Keep the existing header (org name) and footer (NavUser) patterns. Remove the hardcoded `data` object and all unused nav components.

The new structure:

```typescript
"use client";

import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { CommandIcon } from "lucide-react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { NavGlobal } from "@/components/nav-global";
import { NavFavorites } from "@/components/nav-favorites";
import { NavProjects } from "@/components/nav-projects";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import { CommandMenu } from "@/components/command-menu";
import { Settings2Icon } from "lucide-react";

// NavSecondary expects icon as React.ReactNode (rendered JSX), not React.ElementType
const secondaryItems = [
  { title: "Settings", url: "/dashboard/settings", icon: <Settings2Icon /> },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = authClient.useSession();
  const { data: activeOrg } = authClient.useActiveOrganization();

  const user = session?.user
    ? {
        name: session.user.name,
        email: session.user.email,
        avatar: session.user.image ?? "",
      }
    : { name: "", email: "", avatar: "" };

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <Link href="/dashboard">
                <CommandIcon className="size-5" />
                <span className="text-base font-semibold">
                  {activeOrg?.name ?? "Dashboard"}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavGlobal />
        <NavFavorites />
        <NavProjects />
        <NavSecondary items={secondaryItems} className="mt-auto" />
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>

      <CommandMenu />
    </Sidebar>
  );
}
```

- [ ] **Step 2: Update NavSecondary to remove Get Help**

In `src/components/nav-secondary.tsx`, the component already accepts items as props — no code change needed. The hardcoded "Get Help" was in the old `data` object which is now removed.

- [ ] **Step 3: Verify build and visual check**

```bash
bun run dev
```

Navigate to `/dashboard`. Verify:
- Sidebar shows Dashboard, Generate, Asset Library in Zone 1
- Favorites section appears (or is hidden if empty)
- Projects section shows with "Create your first project" if none exist
- Settings at bottom
- User dropdown in footer
- Cmd+K opens command menu

- [ ] **Step 4: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "feat: rebuild AppSidebar with zone-based layout (global nav, favorites, project tree, secondary)"
```

---

### Task 2.5: Update Command Menu

**Files:**
- Modify: `src/components/command-menu.tsx`

- [ ] **Step 1: Update command groups to match new IA**

Update the command groups to reflect the new navigation:

```typescript
// Navigation group
<CommandGroup heading="Navigation">
  <CommandItem onSelect={() => navigate("/dashboard")}>
    <LayoutDashboardIcon />
    <span>Dashboard</span>
  </CommandItem>
  <CommandItem onSelect={() => navigate("/dashboard/generate")}>
    <SparklesIcon />
    <span>Generate</span>
  </CommandItem>
  <CommandItem onSelect={() => navigate("/dashboard/assets")}>
    <LibraryIcon />
    <span>Asset Library</span>
  </CommandItem>
  <CommandItem onSelect={() => navigate("/dashboard/projects")}>
    <FolderKanbanIcon />
    <span>Projects</span>
  </CommandItem>
</CommandGroup>

// Account group
<CommandGroup heading="Account">
  <CommandItem onSelect={() => navigate("/dashboard/settings")}>
    <Settings2Icon />
    <span>Settings</span>
    <CommandShortcut>⌘,</CommandShortcut>
  </CommandItem>
  <CommandItem onSelect={handleLogout}>
    <LogOutIcon />
    <span>Log out</span>
  </CommandItem>
</CommandGroup>
```

Remove the old "Documents" group (Data Library, Reports, Word Assistant).

- [ ] **Step 2: Verify build**

```bash
bun run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/command-menu.tsx
git commit -m "feat: update command menu to match new dashboard navigation"
```

---

## Chunk 3: Project Pages + Dashboard

Create the project list, project overview, and dashboard pages. These are the first real pages users interact with.

### Task 3.1: Create Shared Components

**Files:**
- Create: `src/components/empty-state.tsx`
- Create: `src/components/project-card.tsx`
- Create: `src/components/favorite-star.tsx`

- [ ] **Step 1: Create empty state component**

Create `src/components/empty-state.tsx`:

```typescript
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 py-16 text-center", className)}>
      {Icon && <Icon className="size-12 text-muted-foreground/50" />}
      <div className="space-y-1">
        <h3 className="text-lg font-medium">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
```

- [ ] **Step 2: Create project card component**

Create `src/components/project-card.tsx`:

```typescript
"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FavoriteStar } from "@/components/favorite-star";
import { cn } from "@/lib/utils";

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    description?: string | null;
    color?: string | null;
    createdAt: string | Date;
    _count: { campaigns: number; posts: number };
  };
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link href={`/dashboard/projects/${project.id}`}>
      <Card className="group relative transition-colors hover:bg-muted/50">
        <div
          className="absolute inset-x-0 top-0 h-1 rounded-t-xl"
          style={{ backgroundColor: project.color ?? "#737373" }}
        />
        <CardHeader className="pt-5">
          <div className="flex items-start justify-between">
            <CardTitle className="line-clamp-1 text-base">{project.name}</CardTitle>
            <FavoriteStar targetType="project" targetId={project.id} />
          </div>
          {project.description && (
            <CardDescription className="line-clamp-2">{project.description}</CardDescription>
          )}
        </CardHeader>
        <CardFooter className="gap-2">
          <Badge variant="outline" className="tabular-nums">
            {project._count.campaigns} campaigns
          </Badge>
          <Badge variant="outline" className="tabular-nums">
            {project._count.posts} generations
          </Badge>
        </CardFooter>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 3: Create favorite star component**

Create `src/components/favorite-star.tsx`:

```typescript
"use client";

import { StarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFavorites, useAddFavorite, useRemoveFavorite } from "@/hooks/use-favorites";
import { cn } from "@/lib/utils";

interface FavoriteStarProps {
  targetType: "project" | "campaign" | "route";
  targetId: string;
}

export function FavoriteStar({ targetType, targetId }: FavoriteStarProps) {
  const { data: favorites } = useFavorites();
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();

  const isFavorited = favorites?.some(
    (f) => f.targetType === targetType && f.targetId === targetId
  );

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isFavorited) {
      removeFavorite.mutate({ targetType, targetId });
    } else {
      addFavorite.mutate({ targetType, targetId });
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 shrink-0"
      onClick={toggle}
    >
      <StarIcon
        className={cn(
          "size-4",
          isFavorited ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
        )}
      />
    </Button>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
bun run build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/empty-state.tsx src/components/project-card.tsx src/components/favorite-star.tsx
git commit -m "feat: add EmptyState, ProjectCard, and FavoriteStar shared components"
```

---

### Task 3.2: Create Projects List Page

**Files:**
- Create: `src/app/(roks-workspace)/dashboard/projects/page.tsx`

- [ ] **Step 1: Create projects page**

Create `src/app/(roks-workspace)/dashboard/projects/page.tsx`:

```typescript
"use client";

import { useProjects, useCreateProject } from "@/hooks/use-projects";
import { ProjectCard } from "@/components/project-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { FolderKanbanIcon, PlusIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function ProjectsPage() {
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const searchParams = useSearchParams();
  const [showCreate, setShowCreate] = useState(searchParams.get("create") === "true");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createProject.mutateAsync({ name: name.trim(), description: description.trim() || undefined });
    setName("");
    setDescription("");
    setShowCreate(false);
  };

  if (isLoading) {
    return <div className="flex flex-1 items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 lg:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Button onClick={() => setShowCreate(true)}>
          <PlusIcon className="size-4" />
          New Project
        </Button>
      </div>

      {projects && projects.length > 0 ? (
        <div className="grid gap-4 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FolderKanbanIcon}
          title="No projects yet"
          description="Create your first project to start organizing your content."
          action={
            <Button onClick={() => setShowCreate(true)}>
              <PlusIcon className="size-4" />
              Create Project
            </Button>
          }
        />
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
            <DialogDescription>
              Projects organize your content, brand identities, and campaigns.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Nike Summer 2026"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this project about?"
                rows={3}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={!name.trim() || createProject.isPending}
            >
              {createProject.isPending ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Verify build and visual check**

```bash
bun run dev
```

Navigate to `/dashboard/projects`. Verify empty state shows, create dialog works.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(roks-workspace\)/dashboard/projects/
git commit -m "feat: add projects list page with create dialog and empty state"
```

---

### Task 3.3: Create Project Layout and Overview Page

**Files:**
- Create: `src/app/(roks-workspace)/dashboard/projects/[id]/layout.tsx`
- Create: `src/app/(roks-workspace)/dashboard/projects/[id]/page.tsx`

- [ ] **Step 1: Create project layout**

Create `src/app/(roks-workspace)/dashboard/projects/[id]/layout.tsx`:

```typescript
export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
```

Thin layout — project context comes from the `[id]` param consumed by hooks in child pages. No provider needed since hooks read the ID from the URL.

- [ ] **Step 2: Create project overview page**

Create `src/app/(roks-workspace)/dashboard/projects/[id]/page.tsx`:

```typescript
"use client";

import { use } from "react";
import { useProject } from "@/hooks/use-projects";
import { useCampaigns } from "@/hooks/use-campaigns";
import { useBrandIdentities } from "@/hooks/use-brand-identities";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import {
  SparklesIcon,
  FlaskConicalIcon,
  FileTextIcon,
  PlusIcon,
  PaletteIcon,
  ImageIcon,
} from "lucide-react";
import Link from "next/link";

export default function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: project, isLoading } = useProject(id);
  const { data: campaigns } = useCampaigns(id);
  const { data: brandIdentities } = useBrandIdentities(id);

  if (isLoading || !project) {
    return <div className="flex flex-1 items-center justify-center p-8">Loading...</div>;
  }

  const base = `/dashboard/projects/${id}`;

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div>
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        {project.description && (
          <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href={`${base}/generate`}>
            <SparklesIcon className="size-4" />
            Generate
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`${base}/campaigns?create=true`}>
            <FlaskConicalIcon className="size-4" />
            New Campaign
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`${base}/content`}>
            <FileTextIcon className="size-4" />
            Add Content
          </Link>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 @xl/main:grid-cols-2 @3xl/main:grid-cols-4">
        <Card className="bg-gradient-to-t from-primary/5 to-card dark:bg-card">
          <CardHeader>
            <CardDescription>Campaigns</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {project._count.campaigns}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-gradient-to-t from-primary/5 to-card dark:bg-card">
          <CardHeader>
            <CardDescription>Brand Identities</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {project._count.brandIdentities}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-gradient-to-t from-primary/5 to-card dark:bg-card">
          <CardHeader>
            <CardDescription>Content Sources</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {project._count.contentSources}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-gradient-to-t from-primary/5 to-card dark:bg-card">
          <CardHeader>
            <CardDescription>Generations</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {project._count.posts}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Recent Campaigns */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">Campaigns</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`${base}/campaigns`}>View all</Link>
          </Button>
        </div>
        {campaigns && campaigns.length > 0 ? (
          <div className="grid gap-3 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
            {campaigns.slice(0, 3).map((campaign) => (
              <Link key={campaign.id} href={`${base}/campaigns/${campaign.id}`}>
                <Card className="transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{campaign.name}</CardTitle>
                      <Badge variant="outline">{campaign.status}</Badge>
                    </div>
                    {campaign.brandIdentity && (
                      <CardDescription>{campaign.brandIdentity.name}</CardDescription>
                    )}
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FlaskConicalIcon}
            title="No campaigns yet"
            description="Create a campaign to test different styles and content approaches."
            action={
              <Button variant="outline" size="sm" asChild>
                <Link href={`${base}/campaigns?create=true`}>
                  <PlusIcon className="size-4" />
                  Create Campaign
                </Link>
              </Button>
            }
            className="py-8"
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build and visual check**

```bash
bun run dev
```

Create a project via `/dashboard/projects`, then navigate to it. Verify overview shows summary cards, quick actions, and campaigns section.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(roks-workspace\)/dashboard/projects/\[id\]/
git commit -m "feat: add project layout and overview page with summary cards and quick actions"
```

---

### Task 3.4: Rebuild Dashboard Home Page

**Files:**
- Modify: `src/app/(roks-workspace)/dashboard/page.tsx`

- [ ] **Step 1: Replace demo dashboard with real content**

Replace the demo data imports and components with the new dashboard design:

```typescript
"use client";

import { useProjects } from "@/hooks/use-projects";
import { ProjectCard } from "@/components/project-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  SparklesIcon,
  FolderKanbanIcon,
  PlusIcon,
  ArrowRightIcon,
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { data: projects, isLoading } = useProjects();

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Pick up where you left off.</p>
      </div>

      {/* Quick Generate CTA */}
      <Link href="/dashboard/generate">
        <Card className="group bg-gradient-to-t from-primary/5 to-card transition-colors hover:from-primary/10 dark:bg-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <SparklesIcon className="size-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Quick Generate</CardTitle>
                <CardDescription>Create content for any platform in seconds</CardDescription>
              </div>
              <ArrowRightIcon className="ml-auto size-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </div>
          </CardHeader>
        </Card>
      </Link>

      {/* Active Projects */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">Projects</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/projects">
              View all
              <ArrowRightIcon className="size-4" />
            </Link>
          </Button>
        </div>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : projects && projects.length > 0 ? (
          <div className="grid gap-4 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
            {projects.slice(0, 6).map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FolderKanbanIcon}
            title="Welcome! Create your first project"
            description="Projects help you organize content, brand identities, and campaigns for your clients."
            action={
              <Button asChild>
                <Link href="/dashboard/projects?create=true">
                  <PlusIcon className="size-4" />
                  Create Project
                </Link>
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build and visual check**

```bash
bun run dev
```

Navigate to `/dashboard`. Verify quick generate CTA, projects grid, empty state.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(roks-workspace\)/dashboard/page.tsx
git commit -m "feat: rebuild dashboard home with quick generate CTA and project overview"
```

---

### Task 3.5: Create Stub Pages for Remaining Routes

**Files:**
- Create: `src/app/(roks-workspace)/dashboard/generate/page.tsx`
- Create: `src/app/(roks-workspace)/dashboard/assets/page.tsx`
- Create: `src/app/(roks-workspace)/dashboard/projects/[id]/content/page.tsx`
- Create: `src/app/(roks-workspace)/dashboard/projects/[id]/campaigns/page.tsx`
- Create: `src/app/(roks-workspace)/dashboard/projects/[id]/campaigns/[campaignId]/page.tsx`
- Create: `src/app/(roks-workspace)/dashboard/projects/[id]/brands/page.tsx`
- Create: `src/app/(roks-workspace)/dashboard/projects/[id]/assets/page.tsx`
- Create: `src/app/(roks-workspace)/dashboard/projects/[id]/generate/page.tsx`

- [ ] **Step 1: Create stub pages**

Each stub follows the same pattern — a simple heading so the routes resolve and the sidebar links work. Each will be fully implemented in subsequent chunks.

For each file, create a minimal page:

```typescript
// Example: src/app/(roks-workspace)/dashboard/generate/page.tsx
export default function GeneratePage() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 lg:px-6">
      <h1 className="text-2xl font-semibold">Generate</h1>
      <p className="text-sm text-muted-foreground">Coming soon — Gamma-inspired stepped flow.</p>
    </div>
  );
}
```

Repeat for each route with appropriate titles:
- `/dashboard/generate` → "Generate"
- `/dashboard/assets` → "Asset Library"
- `/dashboard/projects/[id]/content` → "Content"
- `/dashboard/projects/[id]/campaigns` → "Campaigns"
- `/dashboard/projects/[id]/campaigns/[campaignId]` → "Campaign Detail"
- `/dashboard/projects/[id]/brands` → "Brand Identities"
- `/dashboard/projects/[id]/assets` → "Project Assets"
- `/dashboard/projects/[id]/generate` → "Project Generate"

- [ ] **Step 2: Verify all routes resolve**

```bash
bun run dev
```

Click through every sidebar link and project sub-page. All should render without 404s.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(roks-workspace\)/dashboard/
git commit -m "feat: add stub pages for all dashboard routes (generate, assets, content, campaigns, brands)"
```

---

## Chunk 4: Content, Brand Identities, Campaigns Pages

Implement the project sub-pages that manage content sources/ideas, brand identities, and campaigns. These replace the stub pages from Chunk 3.

### Task 4.1: Create Content tRPC Router

**Files:**
- Create: `src/lib/trpc/routers/content.ts`
- Modify: `src/lib/trpc/router.ts`
- Create: `src/hooks/use-content.ts`

- [ ] **Step 1: Create content router**

Create `src/lib/trpc/routers/content.ts` with procedures:
- `sources.list` — list sources by project (or org-wide if no project)
- `sources.create` — create source with orgId + optional projectId
- `sources.delete` — delete source
- `ideas.list` — list ideas by project with filters (contentType, isSaved, sourceId)
- `ideas.toggleSave` — toggle isSaved
- `ideas.bulkDelete` — delete multiple ideas
- `ideas.moveToCampaign` — set campaignId on ideas

All procedures use `orgProtectedProcedure` and verify project ownership when projectId is provided.

- [ ] **Step 2: Create content hooks**

Create `src/hooks/use-content.ts` following the same pattern as `use-projects.ts`:
- `useSources(projectId?)` — query sources
- `useCreateSource()` — mutation with invalidation
- `useDeleteSource()` — mutation with invalidation
- `useIdeas(projectId?, filters?)` — query ideas
- `useToggleIdeaSave()` — mutation
- `useBulkDeleteIdeas()` — mutation

- [ ] **Step 3: Register in root router, verify build**

```bash
bun run build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/trpc/routers/content.ts src/hooks/use-content.ts src/lib/trpc/router.ts
git commit -m "feat: add content tRPC router and hooks for sources and ideas"
```

---

### Task 4.2: Implement Content Page

**Files:**
- Modify: `src/app/(roks-workspace)/dashboard/projects/[id]/content/page.tsx`
- Create: `src/components/content-source-card.tsx`
- Create: `src/components/content-idea-card.tsx`

- [ ] **Step 1: Create content source card**

Card shows: title, preview text (truncated), idea count, date. Actions: View Ideas, Generate Ideas, Delete.

- [ ] **Step 2: Create content idea card**

Card shows: idea text preview, content type badge, format badge (static/carousel + slide count), saved indicator. Actions: Save/Unsave, Generate Post (link to generate), Add to Campaign, Delete.

- [ ] **Step 3: Implement content page with tabs**

Two tabs: Sources and Ideas. Sources tab has add dialog. Ideas tab has filters (content type, saved). Both use the custom hooks from Task 4.1.

Follow shadcn patterns: Tabs component, Card-based lists, Badge for types, container query grid.

- [ ] **Step 4: Verify build and visual check**

```bash
bun run dev
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(roks-workspace\)/dashboard/projects/\[id\]/content/ src/components/content-source-card.tsx src/components/content-idea-card.tsx
git commit -m "feat: implement content page with sources/ideas tabs, cards, and filters"
```

---

### Task 4.3: Implement Brand Identities Page

**Files:**
- Modify: `src/app/(roks-workspace)/dashboard/projects/[id]/brands/page.tsx`
- Create: `src/components/brand-identity-card.tsx`

- [ ] **Step 1: Create brand identity card**

Card shows: name, logo thumbnail (or placeholder), tagline, color swatches from palettes. Actions via dropdown: Edit, Duplicate, Delete.

- [ ] **Step 2: Implement brands page**

Grid of brand identity cards with create button. Create/edit uses a Drawer (not modal — per spec patterns). Drawer includes: name input, tagline input, logo upload zone, palette management (add/remove color pairs).

- [ ] **Step 3: Verify build and visual check**

- [ ] **Step 4: Commit**

```bash
git add src/app/\(roks-workspace\)/dashboard/projects/\[id\]/brands/ src/components/brand-identity-card.tsx
git commit -m "feat: implement brand identities page with cards, create/edit drawer, palette management"
```

---

### Task 4.4: Implement Campaigns Pages

**Files:**
- Modify: `src/app/(roks-workspace)/dashboard/projects/[id]/campaigns/page.tsx`
- Modify: `src/app/(roks-workspace)/dashboard/projects/[id]/campaigns/[campaignId]/page.tsx`
- Create: `src/components/campaign-card.tsx`

- [ ] **Step 1: Create campaign card**

Card shows: name, status badge (draft/active/completed/archived), brand identity name, generation count, date. Click navigates to detail.

- [ ] **Step 2: Implement campaigns list page**

Grid of campaign cards. Create campaign dialog (name, description, brand identity dropdown). Empty state with CTA.

- [ ] **Step 3: Implement campaign detail page**

Shows: name + description (editable), status selector, brand identity, assigned ideas list, generated content gallery. Quick action to generate content for this campaign.

- [ ] **Step 4: Verify build and visual check**

- [ ] **Step 5: Commit**

```bash
git add src/app/\(roks-workspace\)/dashboard/projects/\[id\]/campaigns/ src/components/campaign-card.tsx
git commit -m "feat: implement campaign list and detail pages with status management"
```

---

## Chunk 5: Asset Library

Implement the global and project-scoped asset libraries with R2 upload.

### Task 5.1: Create Asset tRPC Router + R2 Upload

**Files:**
- Create: `src/lib/trpc/routers/asset.ts`
- Create: `src/hooks/use-assets.ts`
- Modify: `src/lib/trpc/router.ts`

- [ ] **Step 1: Create asset router**

Procedures:
- `list` — list assets by scope (global or project), filterable by category and mimeType
- `getUploadUrl` — generate presigned R2 upload URL (client uploads directly to R2)
- `create` — register asset after upload (r2Key, mimeType, fileName, category, projectId?)
- `move` — change projectId (move between global/project scope)
- `delete` — delete asset + R2 object

Uses `orgProtectedProcedure`. Integrates with existing `src/lib/r2.ts` for R2 operations.

- [ ] **Step 2: Create asset hooks**

- `useAssets(scope, projectId?)` — query with category/type filters
- `useUploadAsset()` — mutation that gets presigned URL, uploads, then registers
- `useMoveAsset()` — mutation
- `useDeleteAsset()` — mutation

- [ ] **Step 3: Register in root router, verify build, commit**

```bash
git add src/lib/trpc/routers/asset.ts src/hooks/use-assets.ts src/lib/trpc/router.ts
git commit -m "feat: add asset tRPC router with R2 upload and hooks"
```

---

### Task 5.2: Implement Asset Library Page

**Files:**
- Modify: `src/app/(roks-workspace)/dashboard/assets/page.tsx`
- Modify: `src/app/(roks-workspace)/dashboard/projects/[id]/assets/page.tsx`
- Create: `src/components/asset-grid.tsx`
- Create: `src/components/asset-upload.tsx`

- [ ] **Step 1: Create asset upload component**

Drag & drop zone with file picker. Shows supported formats. Handles upload flow (get presigned URL → upload to R2 → register in DB). Accepts category prop (reference or asset).

- [ ] **Step 2: Create asset grid component**

Reusable grid of asset thumbnails with file type badges. Click to preview (image viewer, PDF placeholder, markdown rendered). Actions: Move (global↔project), Delete. Two-section view: Reference & Inspiration | Assets. Search/filter by name, type.

- [ ] **Step 3: Implement global asset library page**

Uses `AssetGrid` and `AssetUpload` with `scope="global"`.

- [ ] **Step 4: Implement project asset library page**

Same components with `scope="project"` and `projectId` from URL params.

- [ ] **Step 5: Verify build and visual check, commit**

```bash
git add src/app/\(roks-workspace\)/dashboard/assets/ src/app/\(roks-workspace\)/dashboard/projects/\[id\]/assets/ src/components/asset-grid.tsx src/components/asset-upload.tsx
git commit -m "feat: implement global and project asset libraries with R2 upload, grid view, and preview"
```

---

## Chunk 6: Generate Flow

The Gamma-inspired 6-step generation flow. This is the most complex piece — built as a set of focused components composed by a main flow component.

### Task 6.1: Create Generate Flow Shell

**Files:**
- Create: `src/components/generate/generate-flow.tsx`
- Create: `src/components/generate/step-navigator.tsx`

- [ ] **Step 1: Create step navigator**

Left rail showing 6 steps with status (completed/active/pending). Each completed step shows a summary line. Click to jump to any completed step. Uses `useGenerateStore` for step state. Steps:
1. Platforms
2. Content
3. Outline
4. Style & Brand
5. Settings
6. Results

- [ ] **Step 2: Create generate flow layout**

Main component that composes the step navigator + active step content + right preview panel. Reads step from store, renders corresponding step component. Syncs step to URL query param (`?step=N`).

Accepts `projectId` and `campaignId` as optional props for context.

- [ ] **Step 3: Wire up both generate pages**

Update `src/app/(roks-workspace)/dashboard/generate/page.tsx`:
```typescript
"use client";
import { GenerateFlow } from "@/components/generate/generate-flow";

export default function GeneratePage() {
  return <GenerateFlow />;
}
```

Update `src/app/(roks-workspace)/dashboard/projects/[id]/generate/page.tsx`:
```typescript
"use client";
import { use } from "react";
import { GenerateFlow } from "@/components/generate/generate-flow";

export default function ProjectGeneratePage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <GenerateFlow projectId={id} />;
}
```

- [ ] **Step 4: Verify build, commit**

```bash
git add src/components/generate/ src/app/\(roks-workspace\)/dashboard/generate/ src/app/\(roks-workspace\)/dashboard/projects/\[id\]/generate/
git commit -m "feat: add generate flow shell with step navigator and layout"
```

---

### Task 6.2: Implement Steps 1-2 (Platforms + Content)

**Files:**
- Create: `src/components/generate/step-platforms.tsx`
- Create: `src/components/generate/step-content.tsx`

- [ ] **Step 1: Create platforms step**

Multi-select card grid. 6 platform cards (Instagram, LinkedIn, Reddit, X, Blog, Email) with platform icon, name, and format hint. Selected state with primary border/ring. Writes to `useGenerateStore.setPlatforms()`. "Continue" button enabled when at least one selected.

- [ ] **Step 2: Create content step**

Tabbed input with modes:
- Write a prompt (default, textarea)
- From content idea (searchable list, project-scoped)
- From content source (source list with extract action)
- Upload (file drop zone)
- From asset library (asset grid picker)

Inputs combine — selections stack. Writes to `useGenerateStore.setContent()`. "Continue" button enabled when prompt or at least one input provided.

- [ ] **Step 3: Verify build, commit**

```bash
git add src/components/generate/step-platforms.tsx src/components/generate/step-content.tsx
git commit -m "feat: implement generate steps 1 (platforms) and 2 (content input)"
```

---

### Task 6.3: Implement Steps 3-4 (Outline + Style & Brand)

**Files:**
- Create: `src/components/generate/step-outline.tsx`
- Create: `src/components/generate/step-style-brand.tsx`

- [ ] **Step 1: Create outline step**

Calls AI to generate content plan per platform. Shows editable outline with sections grouped by platform. Each section is an inline-editable text field. Reorder via drag. Add/remove sections. Regenerate individual sections or entire platform outline. Uses `useGenerateStore.setOutline()` and `updateOutlineSection()`.

- [ ] **Step 2: Create style & brand step**

Brand identity dropdown (populated from project if in project context). Style picker: visual grid of style thumbnails, multi-select, with "Create Style" action. Color override section (brand palette picker or custom hex inputs). Per-platform override accordion. Writes to store.

- [ ] **Step 3: Verify build, commit**

```bash
git add src/components/generate/step-outline.tsx src/components/generate/step-style-brand.tsx
git commit -m "feat: implement generate steps 3 (outline) and 4 (style & brand)"
```

---

### Task 6.4: Implement Steps 5-6 (Settings + Results)

**Files:**
- Create: `src/components/generate/step-settings.tsx`
- Create: `src/components/generate/step-results.tsx`
- Create: `src/lib/trpc/routers/generation.ts`
- Create: `src/hooks/use-generations.ts`

- [ ] **Step 1: Create generation tRPC router**

Procedures:
- `create` — start generation job (accepts full flow state, creates GeneratedPost records, kicks off AI generation)
- `getStatus` — poll generation progress
- `getResults` — get completed generation results with images

Register in root router.

- [ ] **Step 2: Create generation hooks**

- `useCreateGeneration()` — mutation
- `useGenerationStatus(id)` — query with polling (refetchInterval while pending)
- `useGenerationResults(id)` — query
- `useRecentGenerations(scope?, projectId?)` — query for dashboard/overview

- [ ] **Step 3: Create settings step**

Summary of all selections. Per-platform format config (static/carousel toggle). Aspect ratio per platform (auto-suggested based on platform, overridable via buttons). Model selector (flash/pro). Variations count (1-6 slider or buttons). Include logo toggle. Estimated output count. Big "Generate" button.

- [ ] **Step 4: Create results step**

Platform tabs showing results as they complete. Each result card: generated image/text, style badge, platform badge. Actions: download, save to project, edit, regenerate, move to campaign. Compare view toggle for side-by-side.

- [ ] **Step 5: Verify full flow end-to-end**

```bash
bun run dev
```

Walk through all 6 steps. Verify generation creates records and results display.

- [ ] **Step 6: Commit**

```bash
git add src/components/generate/ src/lib/trpc/routers/generation.ts src/hooks/use-generations.ts src/lib/trpc/router.ts
git commit -m "feat: implement generate steps 5 (settings) and 6 (results) with generation tRPC router"
```

---

## Chunk 7: Polish + Site Header + Cleanup

Final integration, site header updates, and cleanup of unused components.

### Task 7.1: Update Site Header

**Files:**
- Modify: `src/components/site-header.tsx`

- [ ] **Step 1: Make header dynamic**

Replace hardcoded "Documents" title with dynamic breadcrumb based on current route. Use `usePathname()` to derive the page title. For project pages, show: Projects > Project Name > Sub-page.

- [ ] **Step 2: Commit**

```bash
git add src/components/site-header.tsx
git commit -m "feat: update site header with dynamic breadcrumb navigation"
```

---

### Task 7.2: Clean Up Unused Components

**Files:**
- Modify: `src/components/nav-main.tsx` — remove if no longer used
- Modify: `src/components/nav-documents.tsx` — remove if no longer used
- Remove demo data: `src/app/(roks-workspace)/dashboard/data.json`
- Remove demo components if only used by old dashboard: `src/components/section-cards.tsx`, `src/components/chart-area-interactive.tsx`, `src/components/data-table.tsx`

- [ ] **Step 1: Identify unused components**

Check imports across the codebase. Remove any component that is only imported by old code.

- [ ] **Step 2: Remove unused files and imports**

- [ ] **Step 3: Verify build**

```bash
bun run build
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove unused demo components and old navigation files"
```

---

### Task 7.3: Verify Full Application

- [ ] **Step 1: Full build check**

```bash
bun run build
```

Expected: Clean build, no errors or warnings.

- [ ] **Step 2: Manual walkthrough**

Test every route:
1. `/dashboard` — shows projects + quick generate
2. `/dashboard/generate` — 6-step flow works end-to-end
3. `/dashboard/assets` — upload, view, filter assets
4. `/dashboard/projects` — list, create, delete projects
5. `/dashboard/projects/[id]` — overview with stats + quick actions
6. `/dashboard/projects/[id]/content` — sources + ideas tabs
7. `/dashboard/projects/[id]/campaigns` — list + create campaigns
8. `/dashboard/projects/[id]/campaigns/[id]` — detail view
9. `/dashboard/projects/[id]/brands` — brand identity management
10. `/dashboard/projects/[id]/assets` — project-scoped asset library
11. `/dashboard/projects/[id]/generate` — project-scoped generation
12. `/dashboard/settings` — profile + org management (unchanged)
13. Sidebar — all zones work, project tree expands, favorites toggle
14. Cmd+K — searches across all entities

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete dashboard redesign — project-based IA with Gamma-inspired generate flow"
```
