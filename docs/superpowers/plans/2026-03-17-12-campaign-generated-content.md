# Campaign Generated Content Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Display generated content in the campaign detail page, replacing the permanent empty state with a live grid of post cards.

**Depends on:** Plan 2 (generation-data-layer -- `byCampaign` query), Plan 9 (gallery-page -- `PostCard` and `PostDetailDrawer` components)

**Architecture:** The campaign detail page at `/dashboard/projects/[id]/campaigns/[campaignId]/page.tsx` currently has a hardcoded `EmptyState` in the "Generated Content" section. This plan replaces it with a data-fetching section that calls `useCampaignGenerations(campaignId)` to load posts, displays them in a responsive grid of `PostCard` components (from Plan 9), and opens a `PostDetailDrawer` for full details. The "Generate Content" CTA button passes both `projectId` and `campaignId` as context to the generate page.

**Tech Stack:** Next.js 16, tRPC v11, TanStack Query, shadcn/ui (Card, Badge, Button, Skeleton, Select, Dialog, Input, Label, Textarea, AlertDialog), Lucide icons, sonner toast, container queries, existing `PostCard` + `PostDetailDrawer` components

---

## Existing Code Context

**Current file:** `src/app/(roks-workspace)/dashboard/projects/[id]/campaigns/[campaignId]/page.tsx` (337 lines)

The file already imports and uses:
- `useCampaign`, `useUpdateCampaign` from `@/hooks/use-campaigns`
- `useBrandIdentities` from `@/hooks/use-brand-identities`
- `useIdeas` from `@/hooks/use-content`
- `EmptyState` from `@/components/empty-state`
- shadcn Card, Badge, Button, Dialog, Select, Input, Label, Textarea
- `toast` from sonner

The "Generated Content" section (lines 259-276) currently renders:
```tsx
<div className="px-4 lg:px-6">
  <h2 className="text-lg font-semibold">Generated Content</h2>
  <EmptyState
    icon={SparklesIcon}
    title="No generated content yet"
    description="Use the Generate Content button to start creating posts for this campaign."
    action={
      <Button asChild>
        <Link href={`/dashboard/projects/${id}/generate`}>
          <SparklesIcon className="mr-2 size-4" />
          Generate Content
        </Link>
      </Button>
    }
    className="py-12"
  />
</div>
```

---

## Prerequisites

Verify these exist before implementing:

1. **`src/hooks/use-generations.ts`** has a `useCampaignGenerations(campaignId)` hook (created in Plan 9). If not, add:

```typescript
export function useCampaignGenerations(campaignId: string) {
  const trpc = useTRPC();
  return useQuery(
    trpc.generation.byCampaign.queryOptions({ campaignId })
  );
}
```

2. **`src/lib/trpc/routers/generation.ts`** has a `byCampaign` procedure:

```typescript
byCampaign: orgProtectedProcedure
  .input(z.object({ campaignId: z.string() }))
  .query(async ({ ctx, input }) => {
    const campaign = await ctx.prisma.campaign.findFirst({
      where: { id: input.campaignId, project: { orgId: ctx.orgId } },
    });
    if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
    return ctx.prisma.generatedPost.findMany({
      where: { campaignId: input.campaignId },
      orderBy: { createdAt: "desc" },
      include: {
        style: { select: { name: true } },
        images: { select: { id: true, slideNumber: true }, orderBy: { slideNumber: "asc" } },
      },
    });
  }),
```

3. **`src/components/post-card.tsx`** and **`src/components/post-detail-drawer.tsx`** exist (created in Plan 9).

---

## File to Modify

### `src/app/(roks-workspace)/dashboard/projects/[id]/campaigns/[campaignId]/page.tsx`

Replace the entire file with the following. Changes are:
1. New imports: `PostCard`, `PostDetailDrawer`, `useCampaignGenerations`, `Skeleton`
2. New state: `selectedPost`, `drawerOpen`
3. The "Generated Content" section now conditionally renders a loading skeleton, post grid, or empty state
4. A `PostDetailDrawer` is added at the end of the component
5. The "Generate Content" button links to the project generate page with `campaignId` in the URL query

```typescript
"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  SparklesIcon,
  ArrowLeftIcon,
  FileTextIcon,
  PencilIcon,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { PostCard, type PostCardData } from "@/components/post-card";
import { PostDetailDrawer } from "@/components/post-detail-drawer";
import { useCampaign, useUpdateCampaign } from "@/hooks/use-campaigns";
import { useBrandIdentities } from "@/hooks/use-brand-identities";
import { useIdeas } from "@/hooks/use-content";
import { useCampaignGenerations } from "@/hooks/use-generations";
import { toast } from "sonner";

const statusVariant: Record<string, "secondary" | "default" | "outline"> = {
  draft: "secondary",
  active: "default",
  completed: "outline",
  archived: "secondary",
};

const statuses = ["draft", "active", "completed", "archived"] as const;

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string; campaignId: string }>;
}) {
  const { id, campaignId } = use(params);
  const { data: campaign, isLoading } = useCampaign(campaignId);
  const updateCampaign = useUpdateCampaign();
  const { data: assignedIdeas = [] } = useIdeas({ projectId: id, campaignId });
  const { data: brands } = useBrandIdentities(id);
  const { data: generations, isLoading: generationsLoading } = useCampaignGenerations(campaignId);

  // Edit dialog state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editBrandId, setEditBrandId] = useState<string>("");

  // Post detail drawer state
  const [selectedPost, setSelectedPost] = useState<PostCardData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleStatusChange = (status: string) => {
    updateCampaign.mutate(
      {
        id: campaignId,
        status: status as (typeof statuses)[number],
      },
      {
        onError: (err) => toast.error(err.message ?? "Operation failed"),
      }
    );
  };

  const openEditDialog = () => {
    if (!campaign) return;
    setEditName(campaign.name);
    setEditDescription(campaign.description ?? "");
    setEditBrandId(campaign.brandIdentity?.id ?? "none");
    setShowEditDialog(true);
  };

  const handleEdit = () => {
    if (!editName.trim()) return;
    updateCampaign.mutate(
      {
        id: campaignId,
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        brandIdentityId: editBrandId === "none" ? null : editBrandId || null,
      },
      {
        onSuccess: () => {
          setShowEditDialog(false);
          toast.success("Campaign updated");
        },
        onError: (err) => toast.error(err.message ?? "Failed to update campaign"),
      }
    );
  };

  const handlePostClick = (post: PostCardData) => {
    setSelectedPost(post);
    setDrawerOpen(true);
  };

  const handleDrawerChange = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) {
      setTimeout(() => setSelectedPost(null), 300);
    }
  };

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

  if (!campaign) {
    return (
      <EmptyState
        title="Campaign not found"
        description="This campaign may have been deleted or you don't have access."
      />
    );
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-6 py-4 md:py-6">
      {/* Back link + header */}
      <div className="px-4 lg:px-6">
        <Button asChild variant="ghost" size="sm" className="mb-3">
          <Link href={`/dashboard/projects/${id}/campaigns`}>
            <ArrowLeftIcon className="mr-2 size-4" />
            All Campaigns
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">
                {campaign.name}
              </h1>
              <Badge
                variant={statusVariant[campaign.status] ?? "secondary"}
                className={campaign.status === "archived" ? "opacity-60" : ""}
              >
                {campaign.status}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="size-8 p-0"
                onClick={openEditDialog}
              >
                <PencilIcon className="size-4" />
              </Button>
            </div>
            {campaign.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {campaign.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={campaign.status}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button asChild>
              <Link href={`/dashboard/projects/${id}/generate?campaignId=${campaignId}`}>
                <SparklesIcon className="mr-2 size-4" />
                Generate Content
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Campaign info cards */}
      <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @4xl/main:grid-cols-4">
        <Card className="bg-gradient-to-t from-primary/5 to-card dark:bg-card">
          <CardHeader>
            <CardDescription>Status</CardDescription>
            <CardTitle className="capitalize">{campaign.status}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-gradient-to-t from-primary/5 to-card dark:bg-card">
          <CardHeader>
            <CardDescription>Brand Identity</CardDescription>
            <CardTitle className="text-base">
              {campaign.brandIdentity?.name ?? "None"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-gradient-to-t from-primary/5 to-card dark:bg-card">
          <CardHeader>
            <CardDescription>Posts</CardDescription>
            <CardTitle className="tabular-nums">
              {campaign._count.posts}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-gradient-to-t from-primary/5 to-card dark:bg-card">
          <CardHeader>
            <CardDescription>Ideas</CardDescription>
            <CardTitle className="tabular-nums">
              {campaign._count.contentIdeas}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Assigned ideas section */}
      <div className="px-4 lg:px-6">
        <h2 className="text-lg font-semibold">Assigned Ideas</h2>
        {assignedIdeas.length > 0 ? (
          <div className="mt-4 grid gap-4 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
            {assignedIdeas.map((idea) => (
              <Card key={idea.id}>
                <CardHeader>
                  <CardDescription className="line-clamp-3">
                    {idea.ideaText}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{idea.contentType}</Badge>
                    <Badge variant="outline">{idea.format}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FileTextIcon}
            title="No ideas assigned"
            description="Ideas will appear here once they are assigned to this campaign."
            className="py-12"
          />
        )}
      </div>

      {/* Generated content section */}
      <div className="px-4 lg:px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Generated Content</h2>
          {generations && generations.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {generations.length} post{generations.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {generationsLoading ? (
          <div className="mt-4 grid gap-4 @xs/main:grid-cols-2 @lg/main:grid-cols-3 @3xl/main:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[4/5] rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : generations && generations.length > 0 ? (
          <div className="mt-4 grid gap-4 @xs/main:grid-cols-2 @lg/main:grid-cols-3 @3xl/main:grid-cols-4">
            {generations.map((post: PostCardData) => (
              <PostCard
                key={post.id}
                post={post}
                onClick={() => handlePostClick(post)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={SparklesIcon}
            title="No generated content yet"
            description="Use the Generate Content button to start creating posts for this campaign."
            action={
              <Button asChild>
                <Link href={`/dashboard/projects/${id}/generate?campaignId=${campaignId}`}>
                  <SparklesIcon className="mr-2 size-4" />
                  Generate Content
                </Link>
              </Button>
            }
            className="py-12"
          />
        )}
      </div>

      {/* Post Detail Drawer */}
      <PostDetailDrawer
        post={selectedPost}
        open={drawerOpen}
        onOpenChange={handleDrawerChange}
      />

      {/* Edit Campaign Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Campaign</DialogTitle>
            <DialogDescription>
              Update the campaign name, description, and brand identity.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-campaign-name">Name</Label>
              <Input
                id="edit-campaign-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleEdit();
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-campaign-description">Description</Label>
              <Textarea
                id="edit-campaign-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-campaign-brand">Brand Identity</Label>
              <Select value={editBrandId} onValueChange={setEditBrandId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a brand identity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {brands?.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleEdit}
              disabled={!editName.trim() || updateCampaign.isPending}
            >
              {updateCampaign.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

---

## Summary of Changes

The changes to the campaign detail page are:

1. **New imports** (4 lines):
   - `Skeleton` from `@/components/ui/skeleton`
   - `PostCard, type PostCardData` from `@/components/post-card`
   - `PostDetailDrawer` from `@/components/post-detail-drawer`
   - `useCampaignGenerations` from `@/hooks/use-generations`

2. **New data fetching** (1 line):
   - `const { data: generations, isLoading: generationsLoading } = useCampaignGenerations(campaignId);`

3. **New state** (2 lines):
   - `const [selectedPost, setSelectedPost] = useState<PostCardData | null>(null);`
   - `const [drawerOpen, setDrawerOpen] = useState(false);`

4. **New handlers** (2 functions):
   - `handlePostClick` -- sets selected post and opens drawer
   - `handleDrawerChange` -- closes drawer with delayed cleanup

5. **"Generate Content" link updated** -- now includes `?campaignId=${campaignId}` query parameter so the generate flow knows the campaign context

6. **"Generated Content" section replaced** -- three-state rendering:
   - Loading: 4 skeleton cards
   - Data: grid of `PostCard` components
   - Empty: `EmptyState` with generate CTA (only when not loading AND no posts)

7. **`PostDetailDrawer` added** at the end of the component, before the Edit Dialog

---

## Verification Checklist

- [ ] Campaign detail page loads without errors at `/dashboard/projects/[id]/campaigns/[campaignId]`
- [ ] Loading skeleton shows 4 card placeholders while generations fetch
- [ ] Post grid appears when generations exist, with correct card layout
- [ ] Grid is responsive via container queries: 2/3/4 columns
- [ ] Empty state shows when no generations exist (and is not loading)
- [ ] Empty state has "Generate Content" CTA button
- [ ] "Generate Content" button (both in header and empty state) links to `/dashboard/projects/[id]/generate?campaignId=[campaignId]`
- [ ] Clicking a PostCard opens the PostDetailDrawer from the right
- [ ] Drawer shows image, carousel navigation, info badges, description section, download buttons
- [ ] Delete from drawer removes post and closes drawer
- [ ] All existing campaign functionality still works (status change, edit dialog, assigned ideas)
- [ ] Post count shown next to "Generated Content" heading
- [ ] No TypeScript errors
- [ ] No console warnings
