# Remaining Implementation — Master Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete all remaining features for the dashboard redesign — sidebar improvements, styles page, AI generation pipeline, gallery, content idea generation, content input modes, and polish.

**Architecture:** 9 independent plan sections, each producing working software. Execute in order — some sections depend on earlier ones (noted in each section). All new features use tRPC v11 + custom hooks + shadcn UI + container queries, following patterns established in the existing codebase.

**Tech Stack:** Next.js 16, Prisma, tRPC v11, @tanstack/react-query, Zustand, shadcn/ui, Gemini AI (@google/genai), Cloudflare R2, bun

**Source Spec:** `docs/remaining-work.md`

---

## Plan 1: Sidebar Improvements

**Goal:** Add Active Project section, auto-expand projects on navigation, add Gallery + Styles links to global nav.

**Files:**
- Create: `src/components/nav-active-project.tsx`
- Modify: `src/components/nav-global.tsx`
- Modify: `src/components/nav-projects.tsx`
- Modify: `src/components/app-sidebar.tsx`
- Modify: `src/stores/use-sidebar-store.ts`
- Modify: `src/components/command-menu.tsx`
- Create: `src/app/(roks-workspace)/dashboard/gallery/page.tsx` (stub)
- Create: `src/app/(roks-workspace)/dashboard/styles/page.tsx` (stub)

### Task 1.1: Create NavActiveProject Component

- [ ] **Step 1: Create `src/components/nav-active-project.tsx`**

```typescript
"use client";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  LayoutListIcon,
  FileTextIcon,
  FlaskConicalIcon,
  PaletteIcon,
  ImageIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useProject } from "@/hooks/use-projects";

const subPages = [
  { title: "Overview", segment: "", icon: LayoutListIcon },
  { title: "Content", segment: "/content", icon: FileTextIcon },
  { title: "Campaigns", segment: "/campaigns", icon: FlaskConicalIcon },
  { title: "Brand Identities", segment: "/brands", icon: PaletteIcon },
  { title: "Assets", segment: "/assets", icon: ImageIcon },
  { title: "Generate", segment: "/generate", icon: SparklesIcon },
];

export function NavActiveProject() {
  const pathname = usePathname();
  const router = useRouter();

  // Extract projectId from URL
  const match = pathname.match(/\/dashboard\/projects\/([^/]+)/);
  const projectId = match?.[1];

  const { data: project } = useProject(projectId ?? "");

  if (!projectId) return null;

  const projectBase = `/dashboard/projects/${projectId}`;

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <div
            className="size-2.5 rounded-full"
            style={{ backgroundColor: project?.color ?? "#737373" }}
          />
          <span className="truncate">{project?.name ?? "Project"}</span>
        </span>
        <button
          onClick={() => router.push("/dashboard")}
          className="rounded p-0.5 hover:bg-muted"
        >
          <XIcon className="size-3" />
        </button>
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {subPages.map((sub) => {
            const href = `${projectBase}${sub.segment}`;
            const isActive =
              sub.segment === ""
                ? pathname === projectBase
                : pathname.startsWith(href);
            return (
              <SidebarMenuItem key={sub.title}>
                <SidebarMenuButton asChild isActive={isActive} tooltip={sub.title}>
                  <Link href={href}>
                    <sub.icon className="size-4" />
                    <span>{sub.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
```

- [ ] **Step 2: Verify build**
```bash
bunx tsc --noEmit
```

- [ ] **Step 3: Commit**
```bash
git add src/components/nav-active-project.tsx
git commit -m "feat: add NavActiveProject sidebar section"
```

### Task 1.2: Add Auto-Expand to NavProjects

- [ ] **Step 1: Modify `src/components/nav-projects.tsx`**

Add a `useEffect` after the existing hooks that auto-expands the active project:

```typescript
import { useEffect } from "react";

// Inside NavProjects component, after the existing hooks:
useEffect(() => {
  const match = pathname.match(/\/dashboard\/projects\/([^/]+)/);
  const activeId = match?.[1];
  if (activeId && !expandedProjectIds.has(activeId)) {
    toggleProject(activeId);
  }
}, [pathname]);
```

Also add visual distinction for the active project node — add a subtle left border:

In the `SidebarMenuButton` for each project, add a conditional class:
```typescript
const isActiveProject = pathname.startsWith(projectBase);
// ...
<SidebarMenuButton
  tooltip={project.name}
  className={isActiveProject ? "border-l-2 border-primary" : ""}
>
```

- [ ] **Step 2: Verify build, commit**
```bash
git add src/components/nav-projects.tsx
git commit -m "feat: auto-expand active project in sidebar tree"
```

### Task 1.3: Add Gallery + Styles to Global Nav + Command Menu

- [ ] **Step 1: Modify `src/components/nav-global.tsx`**

Add Gallery and Styles items:
```typescript
import { LayoutDashboardIcon, SparklesIcon, LibraryIcon, LayoutGridIcon, PaletteIcon } from "lucide-react";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Generate", url: "/dashboard/generate", icon: SparklesIcon },
  { title: "Gallery", url: "/dashboard/gallery", icon: LayoutGridIcon },
  { title: "Styles", url: "/dashboard/styles", icon: PaletteIcon },
  { title: "Asset Library", url: "/dashboard/assets", icon: LibraryIcon },
];
```

- [ ] **Step 2: Add Gallery + Styles to command-menu.tsx**

Add to the Navigation group:
```typescript
<CommandItem onSelect={() => navigate("/dashboard/gallery")}>
  <LayoutGridIcon />
  <span>Gallery</span>
</CommandItem>
<CommandItem onSelect={() => navigate("/dashboard/styles")}>
  <PaletteIcon />
  <span>Styles</span>
</CommandItem>
```

- [ ] **Step 3: Create stub pages**

Create `src/app/(roks-workspace)/dashboard/gallery/page.tsx`:
```typescript
export default function GalleryPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 lg:px-6">
      <h1 className="text-2xl font-semibold">Gallery</h1>
      <p className="text-sm text-muted-foreground">Browse all generated content across projects.</p>
    </div>
  );
}
```

Create `src/app/(roks-workspace)/dashboard/styles/page.tsx`:
```typescript
export default function StylesPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 lg:px-6">
      <h1 className="text-2xl font-semibold">Styles</h1>
      <p className="text-sm text-muted-foreground">Manage your visual styles for content generation.</p>
    </div>
  );
}
```

- [ ] **Step 4: Add breadcrumb labels**

In `src/components/site-header.tsx`, add to SEGMENT_LABELS:
```typescript
gallery: "Gallery",
styles: "Styles",
```

- [ ] **Step 5: Verify build, commit**
```bash
git add src/components/nav-global.tsx src/components/command-menu.tsx src/app/\(roks-workspace\)/dashboard/gallery/ src/app/\(roks-workspace\)/dashboard/styles/ src/components/site-header.tsx
git commit -m "feat: add Gallery + Styles to global nav with stub pages"
```

### Task 1.4: Wire NavActiveProject into AppSidebar

- [ ] **Step 1: Modify `src/components/app-sidebar.tsx`**

Import and add NavActiveProject between NavGlobal and NavFavorites:
```typescript
import { NavActiveProject } from "@/components/nav-active-project";

// In SidebarContent:
<SidebarContent>
  <NavGlobal />
  <NavActiveProject />
  <NavFavorites />
  <NavProjects />
  <NavSecondary items={secondaryItems} className="mt-auto" />
</SidebarContent>
```

- [ ] **Step 2: Fix `useProject` hook to handle empty string**

The `NavActiveProject` calls `useProject("")` when no project is active. Add `enabled` guard in `src/hooks/use-projects.ts`:

```typescript
export function useProject(id: string) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.project.get.queryOptions({ id }),
    enabled: !!id,
  });
}
```

- [ ] **Step 3: Verify build, commit**
```bash
git add src/components/app-sidebar.tsx src/hooks/use-projects.ts
git commit -m "feat: integrate NavActiveProject into sidebar with conditional rendering"
```

---

## Plan 2: Styles Page + tRPC Router

**Goal:** Build the styles management page with create, preview, and delete. This unblocks the Step 4 style picker.

**Depends on:** Plan 1 (styles stub page exists)

**Files:**
- Create: `src/lib/trpc/routers/style.ts`
- Create: `src/hooks/use-styles.ts`
- Modify: `src/lib/trpc/router.ts`
- Modify: `src/app/(roks-workspace)/dashboard/styles/page.tsx`
- Create: `src/components/style-card.tsx`

### Task 2.1: Create Style tRPC Router

- [ ] **Step 1: Create `src/lib/trpc/routers/style.ts`**

The Style model already exists in Prisma. The existing REST routes at `/api/styles/*` provide the patterns. Create a tRPC router that wraps the same logic:

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, orgProtectedProcedure } from "../init";
import { generateImage, geminiText } from "@/lib/gemini";

export const styleRouter = router({
  list: orgProtectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.style.findMany({
      where: { OR: [{ orgId: ctx.orgId }, { orgId: null, isPredefined: true }] },
      orderBy: [{ isPredefined: "desc" }, { createdAt: "desc" }],
    });
  }),

  create: orgProtectedProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      description: z.string().max(2000).optional(),
      promptText: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.style.create({
        data: { ...input, orgId: ctx.orgId },
      });
    }),

  delete: orgProtectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const style = await ctx.prisma.style.findFirst({
        where: { id: input.id, orgId: ctx.orgId, isPredefined: false },
      });
      if (!style) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Style not found or is predefined" });
      }
      await ctx.prisma.style.delete({ where: { id: input.id } });
      return { success: true };
    }),

  generatePreview: orgProtectedProcedure
    .input(z.object({ promptText: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // Generate 2 sample images using Gemini
      const samplePrompt = `Create a social media post in this visual style: ${input.promptText}. Make it visually appealing with placeholder content.`;
      const results = await Promise.all([
        generateImage(samplePrompt, "nano-banana-2", "1:1"),
        generateImage(samplePrompt, "nano-banana-2", "1:1"),
      ]);

      const imageIds: string[] = [];
      for (const result of results) {
        if (result) {
          const stored = await ctx.prisma.storedImage.create({
            data: { data: Buffer.from(result.base64, "base64"), mimeType: result.mimeType },
          });
          imageIds.push(stored.id);
        }
      }
      return { sampleImageIds: imageIds };
    }),

  seed: orgProtectedProcedure.mutation(async ({ ctx }) => {
    // Call existing seed endpoint logic
    const res = await fetch(`${process.env.BETTER_AUTH_URL ?? "http://localhost:3000"}/api/styles/seed`, {
      method: "POST",
    });
    if (!res.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to seed styles" });
    return { success: true };
  }),
});
```

- [ ] **Step 2: Register in router.ts**

Add `import { styleRouter } from "./routers/style";` and `style: styleRouter` to appRouter.

- [ ] **Step 3: Create hooks `src/hooks/use-styles.ts`**

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";

export function useStyles() {
  const trpc = useTRPC();
  return useQuery(trpc.style.list.queryOptions());
}

export function useCreateStyle() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.style.create.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.style.list.queryKey() });
    },
  });
}

export function useDeleteStyle() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.style.delete.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.style.list.queryKey() });
    },
  });
}

export function useGenerateStylePreview() {
  const trpc = useTRPC();
  return useMutation(trpc.style.generatePreview.mutationOptions());
}

export function useSeedStyles() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.style.seed.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.style.list.queryKey() });
    },
  });
}
```

- [ ] **Step 4: Verify build, commit**
```bash
git add src/lib/trpc/routers/style.ts src/hooks/use-styles.ts src/lib/trpc/router.ts
git commit -m "feat: add style tRPC router and hooks"
```

### Task 2.2: Build Styles Page

- [ ] **Step 1: Create `src/components/style-card.tsx`**

```typescript
"use client";

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StyleCardProps {
  style: {
    id: string;
    name: string;
    description?: string | null;
    promptText: string;
    isPredefined: boolean;
    sampleImageIds: string[];
  };
  selected?: boolean;
  onSelect?: () => void;
  onDelete?: () => void;
}

export function StyleCard({ style, selected, onSelect, onDelete }: StyleCardProps) {
  return (
    <Card
      className={cn(
        "group relative cursor-pointer transition-all",
        selected ? "ring-2 ring-primary bg-primary/5" : "hover:bg-muted/50",
        onSelect && "cursor-pointer"
      )}
      onClick={onSelect}
    >
      {/* Preview thumbnails */}
      <div className="aspect-square overflow-hidden rounded-t-xl bg-muted">
        {style.sampleImageIds.length > 0 ? (
          <div className="grid h-full grid-cols-2 gap-0.5">
            {style.sampleImageIds.slice(0, 2).map((imgId) => (
              <img
                key={imgId}
                src={`/api/images/${imgId}?type=stored`}
                alt=""
                className="size-full object-cover"
              />
            ))}
          </div>
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
            <span className="text-xs text-muted-foreground">No preview</span>
          </div>
        )}
      </div>
      <CardHeader className="p-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-1 text-sm">{style.name}</CardTitle>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {style.isPredefined ? "Predefined" : "Custom"}
          </Badge>
        </div>
        {style.description && (
          <CardDescription className="line-clamp-2 text-xs">{style.description}</CardDescription>
        )}
      </CardHeader>
      {!style.isPredefined && onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 size-7 opacity-0 group-hover:opacity-100 bg-background/80 backdrop-blur-sm"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <Trash2Icon className="size-3.5 text-destructive" />
        </Button>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Replace styles page stub**

Replace `src/app/(roks-workspace)/dashboard/styles/page.tsx` with the full implementation using `useStyles`, `useCreateStyle`, `useDeleteStyle`, `useSeedStyles`. Include:
- Grid of StyleCard components (4 columns via container queries)
- "Seed Predefined Styles" button (only if no predefined styles exist)
- "Create Style" dialog with name, description, prompt text inputs
- Delete confirmation for custom styles
- Empty state

- [ ] **Step 3: Verify build, commit**
```bash
git add src/components/style-card.tsx src/app/\(roks-workspace\)/dashboard/styles/
git commit -m "feat: implement styles management page with create, preview, delete"
```

### Task 2.3: Wire Style Picker into Generate Step 4

- [ ] **Step 1: Modify `src/components/generate/step-style-brand.tsx`**

Replace the "Style library integration coming soon" placeholder with:
- `useStyles()` query to fetch all styles
- Multi-select grid using StyleCard with `selected` and `onSelect` props
- Wire selections to `useGenerateStore.setStyleIds()`

Replace the placeholder div (the dashed border section) with:
```typescript
const { data: styles, isLoading: stylesLoading } = useStyles();
const { styleIds, setStyleIds } = useGenerateStore();

const toggleStyle = (id: string) => {
  setStyleIds(
    styleIds.includes(id) ? styleIds.filter(s => s !== id) : [...styleIds, id]
  );
};

// In JSX, replace the placeholder:
{stylesLoading ? (
  <div className="text-sm text-muted-foreground">Loading styles...</div>
) : styles && styles.length > 0 ? (
  <div className="grid gap-3 @lg/main:grid-cols-3 @3xl/main:grid-cols-4">
    {styles.map((style) => (
      <StyleCard
        key={style.id}
        style={style}
        selected={styleIds.includes(style.id)}
        onSelect={() => toggleStyle(style.id)}
      />
    ))}
  </div>
) : (
  <EmptyState
    icon={PaletteIcon}
    title="No styles available"
    description="Visit the Styles page to create or seed visual styles."
    className="py-8"
  />
)}
```

- [ ] **Step 2: Verify build, commit**
```bash
git add src/components/generate/step-style-brand.tsx
git commit -m "feat: wire style picker into generate flow Step 4"
```

---

## Plan 3: AI Outline Generation (Step 3)

**Goal:** Replace mock outlines with real Gemini-generated content plans.

**Depends on:** None (standalone)

**Files:**
- Modify: `src/lib/trpc/routers/generation.ts`
- Create: `src/hooks/use-generations.ts`
- Modify: `src/components/generate/step-outline.tsx`

### Task 3.1: Add generateOutline tRPC Procedure

- [ ] **Step 1: Add procedure to `src/lib/trpc/routers/generation.ts`**

```typescript
import { z } from "zod";
import { router, orgProtectedProcedure } from "../init";
import { geminiText } from "@/lib/gemini";

// Add this procedure alongside the existing 'recent' query:
generateOutline: orgProtectedProcedure
  .input(z.object({
    prompt: z.string().min(1),
    platforms: z.array(z.string().min(1)),
  }))
  .mutation(async ({ ctx, input }) => {
    const platformList = input.platforms.join(", ");
    const aiPrompt = `You are a social media content strategist. Generate a detailed content outline for the following platforms: ${platformList}.

The content topic is: ${input.prompt}

For each platform, provide 3-5 sections with specific content descriptions. Return ONLY valid JSON in this exact format:
[
  {"id": "unique-id", "platform": "platform-name", "label": "Section Label", "content": "Detailed content description", "order": 1},
  ...
]

Platform-specific guidelines:
- instagram: Include hook, body slides (if carousel), CTA, caption with hashtags
- linkedin: Include opening hook, story/insight, key takeaways, CTA
- reddit: Include title, context/background, main content, discussion prompt
- x: Include tweet text (280 chars max), thread continuation if needed, hook
- blog: Include title, introduction, body sections, conclusion, meta description
- email: Include subject line, opening, body sections, CTA block, footer

Make each section actionable and specific to the topic. Do not use generic placeholders.`;

    const result = await geminiText.generateContent(aiPrompt);
    const text = result.response.text();

    // Parse JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to parse AI outline" });
    }

    const sections = JSON.parse(jsonMatch[0]);
    return { sections };
  }),
```

- [ ] **Step 2: Create `src/hooks/use-generations.ts`**

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";

export function useGenerateOutline() {
  const trpc = useTRPC();
  return useMutation(trpc.generation.generateOutline.mutationOptions());
}

export function useRecentGenerations() {
  const trpc = useTRPC();
  return useQuery(trpc.generation.recent.queryOptions());
}
```

- [ ] **Step 3: Verify build, commit**
```bash
git add src/lib/trpc/routers/generation.ts src/hooks/use-generations.ts
git commit -m "feat: add AI outline generation tRPC procedure and hooks"
```

### Task 3.2: Wire AI Outline into Step 3

- [ ] **Step 1: Modify `src/components/generate/step-outline.tsx`**

Replace `generateMockOutline()` with a real API call:
- On mount (when outline is null), call `generateOutline.mutate({ prompt, platforms })`
- Show loading skeleton while generating
- On success, call `setOutline(sections)`
- Replace "Regenerate" toast with actual re-generation call per platform
- Keep inline editing functionality as-is

Key changes:
- Import `useGenerateOutline` from `@/hooks/use-generations`
- Add loading state while AI generates
- Handle errors with toast
- "Regenerate" calls the same mutation but filtered to one platform

- [ ] **Step 2: Verify build, commit**
```bash
git add src/components/generate/step-outline.tsx
git commit -m "feat: wire AI outline generation into Step 3"
```

---

## Plan 4: Generation Pipeline (Steps 5 + 6)

**Goal:** Wire the generate button to actually call Gemini, store results, and display them.

**Depends on:** Plan 2 (styles available for generation), Plan 3 (outlines are real content)

**Files:**
- Modify: `src/components/generate/step-settings.tsx`
- Modify: `src/components/generate/step-results.tsx`
- Modify: `src/lib/trpc/routers/generation.ts`
- Modify: `src/hooks/use-generations.ts`

### Task 4.1: Add Generation Procedures to tRPC Router

- [ ] **Step 1: Add `generate` mutation and `getResults` query to `src/lib/trpc/routers/generation.ts`**

The `generate` mutation should:
1. Accept: prompt, platforms, styleIds, brandIdentityId, formatPerPlatform, aspectRatioPerPlatform, model, variations, includeLogo, outline sections, projectId?, campaignId?
2. For each platform × style × variation combination:
   - Create a `GeneratedPost` record with status "generating"
   - Build the prompt combining: style promptText + brand identity (tagline, colors) + outline content for this platform + variation instruction
   - Call `generateImage()` from `src/lib/gemini` for image-based platforms
   - For text-only platforms (blog, email, linkedin, x, reddit): use `geminiText.generateContent()` to generate the full text and store in `textContent`
   - Store `GeneratedImage` records for image outputs
   - Update post status to "completed" or "failed"
3. Return array of created post IDs

The `getResults` query should:
1. Accept: postIds (array of string)
2. Fetch all GeneratedPost records with their GeneratedImage relations and style name
3. Return the full data for display

- [ ] **Step 2: Add hooks to `src/hooks/use-generations.ts`**

```typescript
export function useGenerate() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.generation.generate.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.generation.recent.queryKey() });
    },
  });
}

export function useGenerationResults(postIds: string[]) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.generation.getResults.queryOptions({ postIds }),
    enabled: postIds.length > 0,
    refetchInterval: (query) => {
      // Poll while any post is still "generating"
      const data = query.state.data;
      if (data?.some((p: any) => p.status === "generating")) return 2000;
      return false;
    },
  });
}
```

- [ ] **Step 3: Verify build, commit**
```bash
git add src/lib/trpc/routers/generation.ts src/hooks/use-generations.ts
git commit -m "feat: add generation and results tRPC procedures with polling"
```

### Task 4.2: Wire Step 5 Generate Button

- [ ] **Step 1: Modify `src/components/generate/step-settings.tsx`**

Replace the fake `handleGenerate` with:
```typescript
const generate = useGenerate();

const handleGenerate = async () => {
  try {
    const result = await generate.mutateAsync({
      prompt: content.prompt,
      platforms,
      styleIds,
      brandIdentityId,
      colorOverride,
      formatPerPlatform: settings.formatPerPlatform,
      aspectRatioPerPlatform: settings.aspectRatioPerPlatform,
      model: settings.model,
      variations: settings.variations,
      includeLogo: settings.includeLogo,
      outline: outline ?? [],
      projectId: projectId ?? undefined,
      campaignId: campaignId ?? undefined,
    });
    setGenerationId(result.postIds.join(","));
    setStep(6);
    toast.success("Generation started");
  } catch (err: any) {
    toast.error(err.message ?? "Generation failed");
  }
};
```

Disable the button while generating: `disabled={generate.isPending}`

- [ ] **Step 2: Verify build, commit**
```bash
git add src/components/generate/step-settings.tsx
git commit -m "feat: wire generate button to real Gemini API"
```

### Task 4.3: Wire Step 6 Results Display

- [ ] **Step 1: Modify `src/components/generate/step-results.tsx`**

Replace the spinner/placeholder with real content:
- Parse `generationId` (comma-separated post IDs) into an array
- Call `useGenerationResults(postIds)`
- Group results by platform
- For image-based platforms: show images via `/api/images/[id]?type=generated`
- For text platforms: show rendered text content
- Show "generating..." spinner for posts still in progress
- Add actions: download, copy text, save to project

- [ ] **Step 2: Verify build, commit**
```bash
git add src/components/generate/step-results.tsx
git commit -m "feat: display real generation results in Step 6 with polling"
```

---

## Plan 5: Gallery Page

**Goal:** Build org-wide gallery for viewing, managing, and downloading generated content.

**Depends on:** Plan 4 (generation pipeline produces content to display)

**Files:**
- Modify: `src/app/(roks-workspace)/dashboard/gallery/page.tsx`
- Create: `src/components/post-card.tsx`
- Create: `src/components/post-detail-drawer.tsx`
- Modify: `src/lib/trpc/routers/generation.ts`
- Modify: `src/hooks/use-generations.ts`

### Task 5.1: Extend Generation Router with Gallery Queries

- [ ] **Step 1: Add `list` query with filters to generation router**

Add a `list` procedure that accepts: projectId?, campaignId?, platform?, styleId?, limit?, offset?

Returns posts with: id, prompt, format, aspectRatio, model, platform, status, description, textContent, createdAt, style name, project name, first image ID (for thumbnail), image count.

- [ ] **Step 2: Add `generateDescription` and `updateDescription` mutations**

Port the logic from `POST /api/posts/[id]/description` — uses Gemini to generate a caption.

- [ ] **Step 3: Add hooks**

```typescript
export function useGenerationList(filters?: { projectId?: string; platform?: string }) {
  const trpc = useTRPC();
  return useQuery(trpc.generation.list.queryOptions(filters ?? {}));
}

export function useGenerateDescription() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.generation.generateDescription.mutationOptions(),
    onSuccess: () => { queryClient.invalidateQueries(); },
  });
}
```

- [ ] **Step 4: Commit**
```bash
git commit -m "feat: add gallery query, description generation to generation router"
```

### Task 5.2: Build Gallery Page Components

- [ ] **Step 1: Create `src/components/post-card.tsx`**

Thumbnail card showing: first image, platform badge, style name, prompt preview, date. Click triggers detail drawer.

- [ ] **Step 2: Create `src/components/post-detail-drawer.tsx`**

Drawer (shadcn Drawer) with:
- Image viewer with carousel navigation (prev/next buttons, thumbnail strip)
- Post info: prompt, style, model, aspect ratio, platform
- Description section: generate button, edit textarea, copy button
- Download section: "Download This Slide" + "Download All (ZIP)" buttons
- Move to project/campaign action
- Delete with confirmation

For downloads: call existing REST endpoints `/api/posts/[id]/download?slide=N` and `/api/posts/[id]/download`.

- [ ] **Step 3: Build gallery page**

Replace stub with client component using:
- `useGenerationList()` for data
- Filter bar: platform select, project select
- Responsive grid of PostCard components
- PostDetailDrawer opens on card click
- Empty state for new users

- [ ] **Step 4: Commit**
```bash
git commit -m "feat: implement gallery page with post cards, detail drawer, description generation"
```

---

## Plan 6: AI Content Idea Generation

**Goal:** Add "Generate Ideas" functionality to content sources.

**Depends on:** None (standalone)

**Files:**
- Modify: `src/lib/trpc/routers/content.ts`
- Modify: `src/hooks/use-content.ts`
- Modify: `src/app/(roks-workspace)/dashboard/projects/[id]/content/page.tsx`

### Task 6.1: Add generateIdeas Procedure

- [ ] **Step 1: Add mutation to content router**

Port the logic from `POST /api/content/ideas/generate`:
- Accept: sourceId, projectId, contentTypes (optional filter)
- Fetch the source text
- Build the Gemini prompt (extensive prompt from old endpoint — includes content patterns, quality filters, slide prompt rules)
- Parse JSON response into ContentIdea records
- Save to DB with orgId, projectId, sourceId

This is a large procedure. Read the existing `src/app/api/content/ideas/generate/route.ts` and port the prompt construction + response parsing into the tRPC mutation.

- [ ] **Step 2: Add hook**

```typescript
export function useGenerateIdeas() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.content.generateIdeas.mutationOptions(),
    onSuccess: () => { queryClient.invalidateQueries(); },
  });
}
```

- [ ] **Step 3: Add button to content page**

In the sources tab, add a "Generate Ideas" button to each source card:
```typescript
<Button
  size="sm"
  variant="outline"
  onClick={() => generateIdeas.mutate({ sourceId: source.id, projectId: id })}
  disabled={generateIdeas.isPending}
>
  <SparklesIcon className="size-3.5 mr-1" />
  {generateIdeas.isPending ? "Generating..." : "Generate Ideas"}
</Button>
```

- [ ] **Step 4: Commit**
```bash
git commit -m "feat: add AI content idea generation from sources"
```

---

## Plan 7: Content Input Modes (Step 2)

**Goal:** Enable "From Idea", "From Source", "Upload", "From Assets" tabs in the generate flow.

**Depends on:** Plan 6 (ideas exist to pick from)

**Files:**
- Modify: `src/components/generate/step-content.tsx`

### Task 7.1: Implement All Content Input Modes

- [ ] **Step 1: Modify `src/components/generate/step-content.tsx`**

Enable all modes by setting `ready: true` and implementing each:

**From Idea mode:**
- Use `useIdeas({ projectId, isSaved: true })` to fetch saved ideas
- Render a searchable list (Input + filtered cards)
- On select: `setContent({ prompt: idea.ideaText, contentIdeaId: idea.id })`

**From Source mode:**
- Use `useSources(projectId)` to fetch sources
- Render source cards
- On select: `setContent({ prompt: source.rawText.slice(0, 2000), contentSourceId: source.id })`

**Upload mode:**
- Textarea for paste + file drop zone
- Accept .txt, .md, .pdf files
- Read file content and set as prompt

**From Assets mode:**
- Use `useAssets({ projectId })` to fetch assets
- Render asset grid (reuse AssetGrid pattern)
- On select: `setContent({ assetIds: [asset.id] })`
- Show selected assets as pills/chips

Each mode writes to the generate store's `content` field. Modes stack — switching modes preserves previous selections.

- [ ] **Step 2: Commit**
```bash
git commit -m "feat: implement all content input modes in generate Step 2"
```

---

## Plan 8: Generate Flow Preview Panel + Campaign Content

**Goal:** Live preview panel in generate flow + campaign detail generated content section.

**Depends on:** Plan 4 (generation produces results)

**Files:**
- Create: `src/components/generate/preview-panel.tsx`
- Modify: `src/components/generate/generate-flow.tsx`
- Modify: `src/app/(roks-workspace)/dashboard/projects/[id]/campaigns/[campaignId]/page.tsx`
- Modify: `src/lib/trpc/routers/generation.ts`

### Task 8.1: Build Preview Panel

- [ ] **Step 1: Create `src/components/generate/preview-panel.tsx`**

Reads from Zustand store and renders platform-specific preview cards:
- **Instagram**: Square frame with placeholder image area, caption below
- **LinkedIn**: Text block with optional image
- **X**: Character count (280 max) with tweet preview
- **Blog**: Title + body sections preview
- **Email**: Subject line + sections preview
- **Reddit**: Title + body preview

Shows: selected platforms, prompt excerpt, brand colors applied as card backgrounds, style name badge, estimated output count.

Updates reactively as user changes store state across steps.

- [ ] **Step 2: Wire into generate-flow.tsx**

Replace static Card with `<PreviewPanel />`.

- [ ] **Step 3: Commit**
```bash
git commit -m "feat: add live preview panel to generate flow"
```

### Task 8.2: Campaign Generated Content Section

- [ ] **Step 1: Add `byCampaign` query to generation router**

```typescript
byCampaign: orgProtectedProcedure
  .input(z.object({ campaignId: z.string() }))
  .query(async ({ ctx, input }) => {
    return ctx.prisma.generatedPost.findMany({
      where: { campaignId: input.campaignId, orgId: ctx.orgId },
      orderBy: { createdAt: "desc" },
      include: {
        style: { select: { name: true } },
        images: { take: 1, orderBy: { slideNumber: "asc" } },
      },
    });
  }),
```

- [ ] **Step 2: Wire into campaign detail page**

Replace the static EmptyState with a query to `generation.byCampaign`. When posts exist, render a grid of PostCard components. Keep EmptyState for when no posts exist.

- [ ] **Step 3: Commit**
```bash
git commit -m "feat: display generated content in campaign detail page"
```

---

## Plan 9: Polish — Logo Upload, Favorite Reorder, Cache Scoping

**Goal:** Final UX improvements.

**Files:**
- Modify: `src/app/(roks-workspace)/dashboard/projects/[id]/brands/page.tsx`
- Modify: `src/components/nav-favorites.tsx`
- Modify: All hook files in `src/hooks/`

### Task 9.1: Brand Identity Logo Upload

- [ ] **Step 1: Add logo picker to brand edit dialog**

In the edit dialog on the brands page, add an asset picker section:
- Show current logo (if `logoAssetId` exists, render image via R2 URL)
- "Change Logo" button opens a small dialog showing project assets filtered by `category: "asset"` and image mimeTypes
- On select: call `useUpdateBrandIdentity({ id, logoAssetId: asset.id })`
- "Upload New" button opens the existing AssetUpload component inline

- [ ] **Step 2: Commit**
```bash
git commit -m "feat: add logo upload to brand identity editor"
```

### Task 9.2: Favorite Reorder (Drag & Drop)

- [ ] **Step 1: Install dnd-kit**
```bash
bun add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Add drag-and-drop to `src/components/nav-favorites.tsx`**

Wrap the favorites list in `DndContext` + `SortableContext`. Each favorite item becomes a `useSortable` item with a drag handle. On `onDragEnd`, compute new order and call `useReorderFavorites`.

- [ ] **Step 3: Commit**
```bash
git commit -m "feat: add drag-and-drop reorder to sidebar favorites"
```

### Task 9.3: Scoped Cache Invalidation

- [ ] **Step 1: Update all hook files**

Replace every `queryClient.invalidateQueries()` (no args) with scoped invalidation using the appropriate query keys. Files to update:
- `src/hooks/use-brand-identities.ts` — scope to `brandIdentity.list` with `projectId`
- `src/hooks/use-content.ts` — scope to `content.listSources` and `content.listIdeas`
- `src/hooks/use-campaigns.ts` — `useDeleteCampaign` scope to `campaign.list`

Pattern for each:
```typescript
// Before:
onSuccess: () => { queryClient.invalidateQueries(); }

// After:
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: trpc.specificRouter.specificQuery.queryKey() });
}
```

- [ ] **Step 2: Commit**
```bash
git commit -m "fix: scope cache invalidation to specific query keys"
```
