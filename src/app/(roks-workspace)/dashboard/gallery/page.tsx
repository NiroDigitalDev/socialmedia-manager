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
import { Button } from "@/components/ui/button";
import { ImageIcon, SearchIcon } from "lucide-react";

const platformOptions = [
  { value: "all", label: "All Platforms" },
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "reddit", label: "Reddit" },
  { value: "x", label: "X" },
  { value: "blog", label: "Blog" },
  { value: "email", label: "Email" },
] as const;

type PlatformValue =
  | "instagram"
  | "linkedin"
  | "reddit"
  | "x"
  | "blog"
  | "email";

export default function GalleryPage() {
  const [platformFilter, setPlatformFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedPost, setSelectedPost] = useState<PostCardData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: projects } = useProjects();

  const { data, isLoading, isError } = useGenerationList({
    platform:
      platformFilter === "all"
        ? undefined
        : (platformFilter as PlatformValue),
    projectId: projectFilter === "all" ? undefined : projectFilter,
    search: search.trim() || undefined,
  });

  const posts = data?.posts as PostCardData[] | undefined;

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

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-sm text-muted-foreground">Failed to load data. Please try again.</p>
        <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

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
            {data && data.total > posts.length && ` of ${data.total}`}
          </span>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 px-4 lg:px-6">
        <div className="relative min-w-[200px] max-w-sm flex-1">
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
            {posts.map((post) => (
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
