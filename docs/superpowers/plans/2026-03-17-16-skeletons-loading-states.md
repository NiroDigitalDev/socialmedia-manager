# Skeleton Loading States Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Replace all `animate-pulse` div placeholders and missing loading states with proper shadcn Skeleton components across the entire dashboard.
**Depends on:** None (can be applied at any time)
**Architecture:** Create a centralized `src/components/skeletons.tsx` file with reusable skeleton compositions that match the visual structure of each card/component type. Then update every page's loading branch to use these skeletons instead of plain `animate-pulse` divs. The skeletons mirror the actual content layout (card headers, badges, footers) so users see a realistic preview of the content shape while loading.
**Tech Stack:** shadcn Skeleton (`src/components/ui/skeleton.tsx` -- already installed), shadcn Card, Tailwind CSS container queries

---

## Task 0: Verify skeleton component exists

The shadcn Skeleton component already exists at `src/components/ui/skeleton.tsx`. No installation needed.

If it's missing for any reason: `bunx shadcn@latest add skeleton`

---

## Task 1: Create centralized skeleton compositions

**File:** `src/components/skeletons.tsx` (new file)

```typescript
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

// ---------- Project Card Skeleton ----------
// Matches: ProjectCard component (color bar + title + description + badge footer)

export function ProjectCardSkeleton() {
  return (
    <Card className="relative">
      <div className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-muted" />
      <CardHeader className="pt-5">
        <div className="flex items-start justify-between">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="size-8 rounded-md" />
        </div>
        <Skeleton className="h-4 w-full" />
      </CardHeader>
      <CardFooter className="gap-2">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-28 rounded-full" />
      </CardFooter>
    </Card>
  );
}

// ---------- Campaign Card Skeleton ----------
// Matches: Campaign card (title + status badge + description + count badges)

export function CampaignCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full" />
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Brand Card Skeleton ----------
// Matches: BrandIdentity card (title + tagline + logo area + palette swatches + footer)

export function BrandCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="size-8 rounded-md" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="mb-3 size-12 rounded-lg" />
        <div className="flex gap-2">
          <Skeleton className="size-5 rounded-full" />
          <Skeleton className="size-5 rounded-full" />
          <Skeleton className="h-5 w-16" />
        </div>
      </CardContent>
      <CardFooter className="justify-between">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </CardFooter>
    </Card>
  );
}

// ---------- Stat Card Skeleton ----------
// Matches: Project overview stat cards (icon + number + label)

export function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="size-5 rounded" />
          <Skeleton className="h-7 w-8" />
        </div>
        <Skeleton className="h-4 w-24" />
      </CardHeader>
    </Card>
  );
}

// ---------- Content Source Skeleton ----------
// Matches: ContentSource card (title + idea count badge + description + footer)

export function ContentSourceSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </CardHeader>
      <CardFooter className="justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-8 rounded-md" />
      </CardFooter>
    </Card>
  );
}

// ---------- Content Idea Skeleton ----------
// Matches: ContentIdea card (checkbox + text + badges + action buttons)

export function ContentIdeaSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <Skeleton className="mt-0.5 size-4 rounded-sm" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-1">
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="size-8 rounded-md" />
      </CardFooter>
    </Card>
  );
}

// ---------- Asset Card Skeleton ----------
// Matches: AssetGrid card (square image thumbnail)

export function AssetCardSkeleton() {
  return <Skeleton className="aspect-square w-full rounded-xl" />;
}

// ---------- Sidebar Project Skeleton ----------
// Matches: NavProjects sidebar item (color dot + project name)

export function SidebarProjectSkeleton() {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <Skeleton className="size-3 rounded-sm" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="ml-auto size-4 rounded" />
    </div>
  );
}

// ---------- Page Title Skeleton ----------
// Reusable: page title + subtitle line

export function PageHeaderSkeleton() {
  return (
    <div className="px-4 lg:px-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-2 h-4 w-72" />
    </div>
  );
}

// ---------- Dashboard Generate CTA Skeleton ----------
// Matches: Quick Generate CTA card on dashboard

export function GenerateCtaSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
          <Skeleton className="size-5 rounded" />
        </div>
      </CardHeader>
    </Card>
  );
}
```

---

## Task 2: Update Dashboard page

**File:** `src/app/(roks-workspace)/dashboard/page.tsx`

Find the loading state (lines 55-63):

```typescript
{isLoading ? (
  <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @4xl/main:grid-cols-3">
    {Array.from({ length: 3 }).map((_, i) => (
      <div
        key={i}
        className="h-40 animate-pulse rounded-xl bg-muted"
      />
    ))}
  </div>
)
```

Replace with:

```typescript
{isLoading ? (
  <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @4xl/main:grid-cols-3">
    {Array.from({ length: 3 }).map((_, i) => (
      <ProjectCardSkeleton key={i} />
    ))}
  </div>
)
```

Add import at top:

```typescript
import { ProjectCardSkeleton } from "@/components/skeletons";
```

---

## Task 3: Update Projects list page

**File:** `src/app/(roks-workspace)/dashboard/projects/page.tsx`

Find the loading state (lines 128-136):

```typescript
{isLoading ? (
  <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @4xl/main:grid-cols-3">
    {Array.from({ length: 6 }).map((_, i) => (
      <div
        key={i}
        className="h-40 animate-pulse rounded-xl bg-muted"
      />
    ))}
  </div>
)
```

Replace with:

```typescript
{isLoading ? (
  <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @4xl/main:grid-cols-3">
    {Array.from({ length: 6 }).map((_, i) => (
      <ProjectCardSkeleton key={i} />
    ))}
  </div>
)
```

Add import:

```typescript
import { ProjectCardSkeleton } from "@/components/skeletons";
```

---

## Task 4: Update Project overview page

**File:** `src/app/(roks-workspace)/dashboard/projects/[id]/page.tsx`

Find the loading state (lines 31-45):

```typescript
if (projectLoading) {
  return (
    <div className="@container/main flex flex-1 flex-col gap-6 py-4 md:py-6">
      <div className="px-4 lg:px-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @4xl/main:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
```

Replace with:

```typescript
if (projectLoading) {
  return (
    <div className="@container/main flex flex-1 flex-col gap-6 py-4 md:py-6">
      <PageHeaderSkeleton />
      <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @4xl/main:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="px-4 lg:px-6">
        <Skeleton className="h-6 w-40" />
      </div>
      <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @4xl/main:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <CampaignCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
```

Also find the campaigns loading state (lines 163-168):

```typescript
{campaignsLoading ? (
  <div className="mt-4 grid gap-4 @xl/main:grid-cols-2 @4xl/main:grid-cols-3">
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
    ))}
  </div>
)
```

Replace with:

```typescript
{campaignsLoading ? (
  <div className="mt-4 grid gap-4 @xl/main:grid-cols-2 @4xl/main:grid-cols-3">
    {Array.from({ length: 3 }).map((_, i) => (
      <CampaignCardSkeleton key={i} />
    ))}
  </div>
)
```

Add imports:

```typescript
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton, StatCardSkeleton, CampaignCardSkeleton } from "@/components/skeletons";
```

---

## Task 5: Update Content page

**File:** `src/app/(roks-workspace)/dashboard/projects/[id]/content/page.tsx`

Find the SourcesTab loading state (lines 118-126):

```typescript
if (isLoading) {
  return (
    <div className="grid gap-4 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}
```

Replace with:

```typescript
if (isLoading) {
  return (
    <div className="grid gap-4 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <ContentSourceSkeleton key={i} />
      ))}
    </div>
  );
}
```

Find the IdeasTab loading state (lines 313-321):

```typescript
if (isLoading) {
  return (
    <div className="grid gap-4 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-36 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}
```

Replace with:

```typescript
if (isLoading) {
  return (
    <div className="grid gap-4 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <ContentIdeaSkeleton key={i} />
      ))}
    </div>
  );
}
```

Add import:

```typescript
import { ContentSourceSkeleton, ContentIdeaSkeleton } from "@/components/skeletons";
```

---

## Task 6: Update Campaigns list page

**File:** `src/app/(roks-workspace)/dashboard/projects/[id]/campaigns/page.tsx`

Find the loading state (lines 119-133):

```typescript
if (isLoading) {
  return (
    <div className="@container/main flex flex-1 flex-col gap-6 py-4 md:py-6">
      <div className="px-4 lg:px-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
```

Replace with:

```typescript
if (isLoading) {
  return (
    <div className="@container/main flex flex-1 flex-col gap-6 py-4 md:py-6">
      <PageHeaderSkeleton />
      <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <CampaignCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
```

Add import:

```typescript
import { PageHeaderSkeleton, CampaignCardSkeleton } from "@/components/skeletons";
```

---

## Task 7: Update Campaign detail page

**File:** `src/app/(roks-workspace)/dashboard/projects/[id]/campaigns/[campaignId]/page.tsx`

Find the loading state (lines 103-117):

```typescript
if (isLoading) {
  return (
    <div className="@container/main flex flex-1 flex-col gap-6 py-4 md:py-6">
      <div className="px-4 lg:px-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
```

Replace with:

```typescript
if (isLoading) {
  return (
    <div className="@container/main flex flex-1 flex-col gap-6 py-4 md:py-6">
      <PageHeaderSkeleton />
      <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @4xl/main:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="px-4 lg:px-6">
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <ContentIdeaSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
```

Add imports:

```typescript
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton, StatCardSkeleton, ContentIdeaSkeleton } from "@/components/skeletons";
```

---

## Task 8: Update Brand identities page

**File:** `src/app/(roks-workspace)/dashboard/projects/[id]/brands/page.tsx`

Find the loading state (lines 165-179):

```typescript
if (isLoading) {
  return (
    <div className="@container/main flex flex-1 flex-col gap-6 py-4 md:py-6">
      <div className="px-4 lg:px-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
```

Replace with:

```typescript
if (isLoading) {
  return (
    <div className="@container/main flex flex-1 flex-col gap-6 py-4 md:py-6">
      <PageHeaderSkeleton />
      <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <BrandCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
```

Add import:

```typescript
import { PageHeaderSkeleton, BrandCardSkeleton } from "@/components/skeletons";
```

---

## Task 9: Update Asset Library page (global)

**File:** `src/app/(roks-workspace)/dashboard/assets/page.tsx`

Find both loading states for reference and asset tabs. Each looks like (lines 43-46 and 67-70):

```typescript
{refLoading ? (
  <div className="grid gap-4 @xs/main:grid-cols-2 @lg/main:grid-cols-3 @3xl/main:grid-cols-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="aspect-square animate-pulse rounded-xl bg-muted" />
    ))}
  </div>
)
```

Replace each with:

```typescript
{refLoading ? (
  <div className="grid gap-4 @xs/main:grid-cols-2 @lg/main:grid-cols-3 @3xl/main:grid-cols-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <AssetCardSkeleton key={i} />
    ))}
  </div>
)
```

And the same for the `assetLoading` block.

Add import:

```typescript
import { AssetCardSkeleton } from "@/components/skeletons";
```

---

## Task 10: Update Project Assets page

**File:** `src/app/(roks-workspace)/dashboard/projects/[id]/assets/page.tsx`

Same pattern as Task 9. Find both loading blocks (lines 48-53 and 73-78):

```typescript
<div key={i} className="aspect-square animate-pulse rounded-xl bg-muted" />
```

Replace with:

```typescript
<AssetCardSkeleton key={i} />
```

Add import:

```typescript
import { AssetCardSkeleton } from "@/components/skeletons";
```

---

## Task 11: Update Sidebar projects nav

**File:** `src/components/nav-projects.tsx`

The sidebar currently shows a "Create your first project" placeholder when `!projects || projects.length === 0`. There's no loading state for when projects are being fetched. The `useProjects()` hook returns `{ data: projects }` but we're not checking `isLoading`.

Update the component to show skeleton items while loading:

1. Destructure `isLoading` from `useProjects()`:

```typescript
const { data: projects, isLoading } = useProjects();
```

2. Add a loading branch before the projects map, inside `<SidebarMenu>`:

Find:
```typescript
<SidebarMenu>
  {projects?.map((project) => {
```

Replace with:
```typescript
<SidebarMenu>
  {isLoading ? (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <SidebarMenuItem key={i}>
          <SidebarProjectSkeleton />
        </SidebarMenuItem>
      ))}
    </>
  ) : projects?.map((project) => {
```

Adjust the closing: the existing `{(!projects || projects.length === 0) && (` block should be inside the `else` branch, or wrap the whole thing in a ternary.

The cleaner approach -- replace the entire `<SidebarMenu>` content:

```typescript
<SidebarMenu>
  {isLoading ? (
    Array.from({ length: 3 }).map((_, i) => (
      <SidebarMenuItem key={i}>
        <SidebarProjectSkeleton />
      </SidebarMenuItem>
    ))
  ) : projects && projects.length > 0 ? (
    projects.map((project) => {
      // ... existing project rendering code unchanged
    })
  ) : (
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
```

Add import:

```typescript
import { SidebarProjectSkeleton } from "@/components/skeletons";
```

Also import `SidebarMenuItem` (already imported).

---

## Verification Checklist

1. `src/components/skeletons.tsx` exports all skeleton variants: `ProjectCardSkeleton`, `CampaignCardSkeleton`, `BrandCardSkeleton`, `StatCardSkeleton`, `ContentSourceSkeleton`, `ContentIdeaSkeleton`, `AssetCardSkeleton`, `SidebarProjectSkeleton`, `PageHeaderSkeleton`, `GenerateCtaSkeleton`
2. Dashboard page shows `ProjectCardSkeleton` grid while loading
3. Projects list shows `ProjectCardSkeleton` grid (6 items) while loading
4. Project overview shows `PageHeaderSkeleton` + `StatCardSkeleton` (4) + `CampaignCardSkeleton` (3) while loading
5. Content sources tab shows `ContentSourceSkeleton` grid while loading
6. Content ideas tab shows `ContentIdeaSkeleton` grid while loading
7. Campaigns list shows `PageHeaderSkeleton` + `CampaignCardSkeleton` grid while loading
8. Campaign detail shows `PageHeaderSkeleton` + `StatCardSkeleton` (4) + `ContentIdeaSkeleton` (3) while loading
9. Brands page shows `PageHeaderSkeleton` + `BrandCardSkeleton` grid while loading
10. Both asset pages show `AssetCardSkeleton` grid while loading
11. Sidebar projects nav shows `SidebarProjectSkeleton` (3 items) while loading
12. No `animate-pulse` div placeholders remain in any page's loading state (all replaced by Skeleton components)

---

## Files Modified

| File | Action |
|------|--------|
| `src/components/skeletons.tsx` | **NEW** -- centralized skeleton compositions |
| `src/app/(roks-workspace)/dashboard/page.tsx` | Replace loading div with ProjectCardSkeleton |
| `src/app/(roks-workspace)/dashboard/projects/page.tsx` | Replace loading div with ProjectCardSkeleton |
| `src/app/(roks-workspace)/dashboard/projects/[id]/page.tsx` | Replace loading divs with PageHeaderSkeleton + StatCardSkeleton + CampaignCardSkeleton |
| `src/app/(roks-workspace)/dashboard/projects/[id]/content/page.tsx` | Replace loading divs with ContentSourceSkeleton + ContentIdeaSkeleton |
| `src/app/(roks-workspace)/dashboard/projects/[id]/campaigns/page.tsx` | Replace loading divs with PageHeaderSkeleton + CampaignCardSkeleton |
| `src/app/(roks-workspace)/dashboard/projects/[id]/campaigns/[campaignId]/page.tsx` | Replace loading divs with PageHeaderSkeleton + StatCardSkeleton + ContentIdeaSkeleton |
| `src/app/(roks-workspace)/dashboard/projects/[id]/brands/page.tsx` | Replace loading divs with PageHeaderSkeleton + BrandCardSkeleton |
| `src/app/(roks-workspace)/dashboard/assets/page.tsx` | Replace loading divs with AssetCardSkeleton |
| `src/app/(roks-workspace)/dashboard/projects/[id]/assets/page.tsx` | Replace loading divs with AssetCardSkeleton |
| `src/components/nav-projects.tsx` | Add isLoading check + SidebarProjectSkeleton |
