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
} from "lucide-react";
import { toast } from "sonner";
import {
  useGenerateDescription,
  useUpdateDescription,
  useDeletePost,
} from "@/hooks/use-generations";
import type { PostCardData } from "./post-card";

/** Full-size image (for main viewer) */
function imgUrl(id: string) {
  return `/api/images/${id}?type=generated`;
}

/** Optimized WebP thumbnail */
function thumbUrl(id: string) {
  return `/api/images/${id}?type=generated&format=webp&w=120`;
}

interface PostDetailDrawerProps {
  post: PostCardData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PostDetailDrawer({
  post,
  open,
  onOpenChange,
}: PostDetailDrawerProps) {
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
      { postId: post.id },
      {
        onSuccess: () => {
          toast.success("Description generated!");
        },
      }
    );
  };

  const handleSaveDescription = () => {
    updateDescription.mutate(
      { postId: post.id, description: descDraft },
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
      { postId: post.id },
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
              {post.platform
                ? `${post.platform.charAt(0).toUpperCase()}${post.platform.slice(1)} post`
                : "Generated post"}{" "}
              &middot; {new Date(post.createdAt).toLocaleDateString()}
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
                      {post.status === "generating"
                        ? "Generating..."
                        : post.textContent
                          ? post.textContent
                          : "No image"}
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
                      onClick={() =>
                        setCurrentSlide((p) => Math.max(0, p - 1))
                      }
                    >
                      <ChevronLeftIcon className="size-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute right-2 top-1/2 size-8 -translate-y-1/2 rounded-full bg-black/60 text-white hover:bg-black/80"
                      disabled={currentSlide === totalSlides - 1}
                      onClick={() =>
                        setCurrentSlide((p) =>
                          Math.min(totalSlides - 1, p + 1)
                        )
                      }
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
                        src={thumbUrl(img.id)}
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
                  No description yet. Click &quot;Generate&quot; to create one
                  using AI.
                </p>
              ) : null}
            </div>

            <Separator />

            {/* Download Section */}
            {totalSlides > 0 && (
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
            )}
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
