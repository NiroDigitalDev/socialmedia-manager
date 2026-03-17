# Gallery Page Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Build the org-wide gallery page for viewing, filtering, and managing all generated content with a detail drawer for descriptions and downloads.

**Depends on:** Plan 2 (generation-data-layer -- `list`, `generateDescription`, `updateDescription`, `deletePost` procedures must exist in `src/lib/trpc/routers/generation.ts`)

**Architecture:** The gallery page fetches paginated posts via tRPC through a custom `useGenerationList` hook, renders them in a responsive CSS-container-query grid of `PostCard` components, and opens a right-side `Drawer` (vaul) for full post details including image carousel, description generation/editing, and downloads. Filters (platform, project, search) are managed with local state and passed as query parameters to the tRPC procedure. The page replaces a stub at `/dashboard/gallery`.

**Tech Stack:** Next.js 16, tRPC v11, TanStack Query, shadcn/ui (Drawer, Card, Badge, Select, Input, AlertDialog, Skeleton, Button, AspectRatio, Separator), Zustand (not needed -- local state only), Lucide icons, sonner toast, container queries, `cn()` utility

---

## Prerequisites

Before starting, verify these tRPC procedures exist in `src/lib/trpc/routers/generation.ts`:
- `generation.list` -- accepts `{ platform?, projectId?, search?, cursor?, limit? }`, returns `{ items: GeneratedPost[], nextCursor? }`
- `generation.generateDescription` -- accepts `{ id: string }`, returns `{ description: string }`
- `generation.updateDescription` -- accepts `{ id: string, description: string }`
- `generation.deletePost` -- accepts `{ id: string }`

Also verify these hooks exist in `src/hooks/use-generations.ts`:
- `useGenerationList(filters?)`
- `useGenerateDescription()`
- `useUpdateDescription()`
- `useDeletePost()`

If they do not exist, create them following the patterns in `src/hooks/use-content.ts` and `src/hooks/use-campaigns.ts`.

---

## Files to Create

### 1. `src/hooks/use-generations.ts`

If this file does not already exist from Plan 2, create it:

```typescript
"use client";

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";

export function useGenerationList(filters?: {
  platform?: string;
  projectId?: string;
  search?: string;
}) {
  const trpc = useTRPC();
  return useQuery(
    trpc.generation.list.queryOptions({
      platform: filters?.platform,
      projectId: filters?.projectId,
      search: filters?.search,
    })
  );
}

export function useCampaignGenerations(campaignId: string) {
  const trpc = useTRPC();
  return useQuery(
    trpc.generation.byCampaign.queryOptions({ campaignId })
  );
}

export function useGenerateDescription() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.generation.generateDescription.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.generation.list.queryKey() });
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to generate description");
    },
  });
}

export function useUpdateDescription() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.generation.updateDescription.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.generation.list.queryKey() });
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to save description");
    },
  });
}

export function useDeletePost() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.generation.deletePost.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.generation.list.queryKey() });
      toast.success("Post deleted");
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to delete post");
    },
  });
}
```

---

### 2. `src/components/post-card.tsx`

```typescript
"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { cn } from "@/lib/utils";
import {
  InstagramIcon,
  LinkedinIcon,
  MessageSquareIcon,
  TwitterIcon,
  BookOpenIcon,
  MailIcon,
  ImageIcon,
} from "lucide-react";

const platformIcons: Record<string, React.ElementType> = {
  instagram: InstagramIcon,
  linkedin: LinkedinIcon,
  reddit: MessageSquareIcon,
  x: TwitterIcon,
  blog: BookOpenIcon,
  email: MailIcon,
};

function imgUrl(id: string) {
  return `/api/images/${id}?type=generated`;
}

export interface PostCardData {
  id: string;
  prompt: string;
  format: string;
  aspectRatio: string;
  model: string;
  status: string;
  description: string | null;
  platform: string | null;
  createdAt: string | Date;
  images: { id: string; slideNumber: number }[];
  style?: { name: string } | null;
}

interface PostCardProps {
  post: PostCardData;
  onClick?: () => void;
  className?: string;
}

export function PostCard({ post, onClick, className }: PostCardProps) {
  const PlatformIcon = post.platform ? platformIcons[post.platform] : null;
  const firstImage = post.images[0];

  return (
    <Card
      className={cn(
        "group cursor-pointer overflow-hidden transition-all hover:shadow-md hover:scale-[1.02]",
        className
      )}
      onClick={onClick}
    >
      <div className="relative">
        <AspectRatio ratio={4 / 5}>
          {firstImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgUrl(firstImage.id)}
              alt={post.prompt.slice(0, 60)}
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-muted">
              <ImageIcon className="size-8 text-muted-foreground/40" />
            </div>
          )}
        </AspectRatio>

        {/* Platform icon badge (top-left) */}
        {PlatformIcon && (
          <div className="absolute left-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white">
            <PlatformIcon className="size-3.5" />
          </div>
        )}

        {/* Style name badge (top-right) */}
        {post.style && (
          <Badge
            variant="secondary"
            className="absolute right-2 top-2 max-w-[120px] truncate bg-black/60 text-white hover:bg-black/60"
          >
            {post.style.name}
          </Badge>
        )}

        {/* Carousel slide count */}
        {post.images.length > 1 && (
          <Badge
            variant="secondary"
            className="absolute bottom-2 right-2 bg-black/60 text-white hover:bg-black/60"
          >
            {post.images.length} slides
          </Badge>
        )}
      </div>

      <CardContent className="space-y-1.5 p-3">
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {post.prompt}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-[10px]">
              {post.aspectRatio}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {post.model}
            </Badge>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {new Date(post.createdAt).toLocaleDateString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

### 3. `src/components/post-detail-drawer.tsx`

```typescript
"use client";

import { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  SparklesIcon,
  CopyIcon,
  SaveIcon,
  Trash2Icon,
  XIcon,
  ExpandIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useGenerateDescription, useUpdateDescription, useDeletePost } from "@/hooks/use-generations";
import type { PostCardData } from "./post-card";

function imgUrl(id: string) {
  return `/api/images/${id}?type=generated`;
}

interface PostDetailDrawerProps {
  post: PostCardData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PostDetailDrawer({ post, open, onOpenChange }: PostDetailDrawerProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");

  const generateDescription = useGenerateDescription();
  const updateDescription = useUpdateDescription();
  const deletePost = useDeletePost();

  // Reset slide index when post changes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setCurrentSlide(0);
      setEditingDesc(false);
      setDescDraft("");
    }
    onOpenChange(isOpen);
  };

  if (!post) return null;

  const totalSlides = post.images.length;
  const currentImage = post.images[currentSlide];

  const handleGenerateDescription = () => {
    generateDescription.mutate(
      { id: post.id },
      {
        onSuccess: (data) => {
          toast.success("Description generated!");
        },
      }
    );
  };

  const handleSaveDescription = () => {
    updateDescription.mutate(
      { id: post.id, description: descDraft },
      {
        onSuccess: () => {
          setEditingDesc(false);
          toast.success("Description saved!");
        },
      }
    );
  };

  const handleCopyDescription = () => {
    if (post.description) {
      navigator.clipboard.writeText(post.description);
      toast.success("Copied to clipboard!");
    }
  };

  const handleDownloadSlide = () => {
    if (!currentImage) return;
    const url = `/api/posts/${post.id}/download?slide=${currentImage.slideNumber}`;
    window.open(url, "_blank");
  };

  const handleDownloadAll = () => {
    window.open(`/api/posts/${post.id}/download`, "_blank");
  };

  const handleDelete = () => {
    deletePost.mutate(
      { id: post.id },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Drawer direction="right" open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="data-[vaul-drawer-direction=right]:sm:max-w-lg data-[vaul-drawer-direction=right]:w-full">
        <DrawerHeader className="flex flex-row items-center justify-between border-b">
          <div>
            <DrawerTitle>Post Details</DrawerTitle>
            <DrawerDescription>
              {post.platform ? `${post.platform.charAt(0).toUpperCase()}${post.platform.slice(1)} post` : "Generated post"} &middot;{" "}
              {new Date(post.createdAt).toLocaleDateString()}
            </DrawerDescription>
          </div>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <XIcon className="size-4" />
            </Button>
          </DrawerClose>
        </DrawerHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-6 p-4">
            {/* Image Viewer */}
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-xl bg-muted">
                {currentImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imgUrl(currentImage.id)}
                    alt={`Slide ${currentSlide + 1}`}
                    className="w-full"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center">
                    <p className="text-sm text-muted-foreground">
                      {post.status === "generating" ? "Generating..." : "No image"}
                    </p>
                  </div>
                )}

                {/* Carousel navigation arrows */}
                {totalSlides > 1 && (
                  <>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute left-2 top-1/2 size-8 -translate-y-1/2 rounded-full bg-black/60 text-white hover:bg-black/80"
                      disabled={currentSlide === 0}
                      onClick={() => setCurrentSlide((p) => Math.max(0, p - 1))}
                    >
                      <ChevronLeftIcon className="size-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute right-2 top-1/2 size-8 -translate-y-1/2 rounded-full bg-black/60 text-white hover:bg-black/80"
                      disabled={currentSlide === totalSlides - 1}
                      onClick={() => setCurrentSlide((p) => Math.min(totalSlides - 1, p + 1))}
                    >
                      <ChevronRightIcon className="size-4" />
                    </Button>

                    {/* Slide counter */}
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
                      {currentSlide + 1} / {totalSlides}
                    </div>
                  </>
                )}
              </div>

              {/* Thumbnail strip */}
              {totalSlides > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {post.images.map((img, idx) => (
                    <button
                      key={img.id}
                      onClick={() => setCurrentSlide(idx)}
                      className={cn(
                        "flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                        currentSlide === idx
                          ? "border-primary"
                          : "border-transparent hover:border-muted-foreground/30"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imgUrl(img.id)}
                        alt={`Slide ${idx + 1}`}
                        className="h-16 w-12 object-cover"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Info Badges */}
            <div className="flex flex-wrap gap-2">
              {post.platform && (
                <Badge variant="secondary" className="capitalize">
                  {post.platform}
                </Badge>
              )}
              {post.style && (
                <Badge variant="secondary">{post.style.name}</Badge>
              )}
              <Badge variant="outline">{post.model}</Badge>
              <Badge variant="outline">{post.aspectRatio}</Badge>
              <Badge variant="outline">{post.format}</Badge>
            </div>

            {/* Prompt */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Prompt</h3>
              <p className="text-sm text-muted-foreground">{post.prompt}</p>
            </div>

            <Separator />

            {/* Description Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Caption / Description</h3>
                <div className="flex gap-1.5">
                  {post.description && !editingDesc && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        setDescDraft(post.description || "");
                        setEditingDesc(true);
                      }}
                    >
                      Edit
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-1.5"
                    disabled={generateDescription.isPending}
                    onClick={handleGenerateDescription}
                  >
                    <SparklesIcon className="size-3.5" />
                    {generateDescription.isPending
                      ? "Generating..."
                      : post.description
                        ? "Regenerate"
                        : "Generate"}
                  </Button>
                </div>
              </div>

              {generateDescription.isPending && !post.description && (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              )}

              {editingDesc ? (
                <div className="space-y-2">
                  <Textarea
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    rows={6}
                    className="resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingDesc(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={updateDescription.isPending}
                      onClick={handleSaveDescription}
                    >
                      <SaveIcon className="size-3.5" />
                      {updateDescription.isPending ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              ) : post.description ? (
                <div className="space-y-2">
                  <div className="rounded-lg bg-muted p-3">
                    <p className="whitespace-pre-wrap text-sm">
                      {post.description}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleCopyDescription}
                  >
                    <CopyIcon className="size-3.5" />
                    Copy
                  </Button>
                </div>
              ) : !generateDescription.isPending ? (
                <p className="text-sm text-muted-foreground">
                  No description yet. Click &quot;Generate&quot; to create one using AI.
                </p>
              ) : null}
            </div>

            <Separator />

            {/* Download Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Download</h3>
              <div className="flex flex-wrap gap-2">
                {totalSlides > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleDownloadSlide}
                  >
                    <DownloadIcon className="size-3.5" />
                    Download This Slide
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleDownloadAll}
                >
                  <DownloadIcon className="size-3.5" />
                  {totalSlides > 1 ? "Download All (ZIP)" : "Download"}
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer with Delete */}
        <DrawerFooter className="border-t">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                disabled={deletePost.isPending}
              >
                <Trash2Icon className="size-3.5" />
                {deletePost.isPending ? "Deleting..." : "Delete Post"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete post?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this post and all its images.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={handleDelete}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
```

---

## Files to Modify

### 4. `src/app/(roks-workspace)/dashboard/gallery/page.tsx`

This file does not yet exist (the glob check returned nothing). Create it as a new file:

```typescript
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { PostCard, type PostCardData } from "@/components/post-card";
import { PostDetailDrawer } from "@/components/post-detail-drawer";
import { useGenerationList } from "@/hooks/use-generations";
import { useProjects } from "@/hooks/use-projects";
import { ImageIcon, SearchIcon } from "lucide-react";

const platformOptions = [
  { value: "all", label: "All Platforms" },
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "reddit", label: "Reddit" },
  { value: "x", label: "X" },
  { value: "blog", label: "Blog" },
  { value: "email", label: "Email" },
];

export default function GalleryPage() {
  const [platformFilter, setPlatformFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedPost, setSelectedPost] = useState<PostCardData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: projects } = useProjects();

  const { data: posts, isLoading } = useGenerationList({
    platform: platformFilter === "all" ? undefined : platformFilter,
    projectId: projectFilter === "all" ? undefined : projectFilter,
    search: search.trim() || undefined,
  });

  const handlePostClick = (post: PostCardData) => {
    setSelectedPost(post);
    setDrawerOpen(true);
  };

  const handleDrawerChange = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) {
      // Delay clearing the post so the close animation plays with content
      setTimeout(() => setSelectedPost(null), 300);
    }
  };

  return (
    <div className="@container/main flex flex-1 flex-col gap-6 py-4 md:py-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gallery</h1>
          <p className="text-sm text-muted-foreground">
            Browse and manage all generated content.
          </p>
        </div>
        {posts && (
          <span className="text-sm text-muted-foreground">
            {posts.length} post{posts.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 px-4 lg:px-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search prompts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {platformOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects?.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content Grid */}
      <div className="px-4 lg:px-6">
        {isLoading ? (
          <div className="grid gap-4 @xs/main:grid-cols-2 @lg/main:grid-cols-3 @3xl/main:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[4/5] rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : posts && posts.length > 0 ? (
          <div className="grid gap-4 @xs/main:grid-cols-2 @lg/main:grid-cols-3 @3xl/main:grid-cols-4">
            {posts.map((post: PostCardData) => (
              <PostCard
                key={post.id}
                post={post}
                onClick={() => handlePostClick(post)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ImageIcon}
            title="No posts found"
            description={
              search || platformFilter !== "all" || projectFilter !== "all"
                ? "Try adjusting your filters to see more results."
                : "Generate your first post to see it here."
            }
            className="py-20"
          />
        )}
      </div>

      {/* Detail Drawer */}
      <PostDetailDrawer
        post={selectedPost}
        open={drawerOpen}
        onOpenChange={handleDrawerChange}
      />
    </div>
  );
}
```

---

## Verification Checklist

After implementation, verify:

- [ ] Gallery page loads at `/dashboard/gallery`
- [ ] Loading skeleton shows 8 cards while data fetches
- [ ] Filter by platform narrows results
- [ ] Filter by project narrows results
- [ ] Search input filters by prompt text
- [ ] Empty state shows when no posts match filters
- [ ] Empty state shows different message for new users vs. no-match
- [ ] Clicking a PostCard opens the Drawer from the right
- [ ] Drawer shows full image with carousel navigation for multi-slide posts
- [ ] Thumbnail strip shows below main image for carousels
- [ ] Slide counter shows "1 / N" format
- [ ] "Generate" button calls description generation and shows loading skeleton
- [ ] Edit button opens textarea with existing description
- [ ] Save button persists description changes
- [ ] Copy button copies description to clipboard
- [ ] "Download This Slide" downloads the current slide
- [ ] "Download All (ZIP)" downloads all slides as ZIP for carousels
- [ ] Delete shows AlertDialog confirmation
- [ ] Deleting closes the drawer and removes the card from grid
- [ ] All mutations show error toasts on failure
- [ ] Grid is responsive: 2 columns on small, 3 on medium, 4 on large (via container queries)

## Install Commands

Run if any shadcn components are missing (AspectRatio, ScrollArea, AlertDialog):

```bash
bunx shadcn@latest add aspect-ratio scroll-area alert-dialog separator
```

All three already exist in `src/components/ui/`, so this should be a no-op. Verify before running.
