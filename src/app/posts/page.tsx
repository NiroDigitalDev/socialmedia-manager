"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface GeneratedImage {
  id: string;
  slideNumber: number;
  cloudinaryUrl: string;
}

interface GeneratedPost {
  id: string;
  prompt: string;
  format: string;
  aspectRatio: string;
  model: string;
  status: string;
  includeLogo: boolean;
  createdAt: string;
  images: GeneratedImage[];
  style?: { name: string } | null;
  contentIdea?: { ideaText: string; contentType: string } | null;
}

export default function PostsPage() {
  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<GeneratedPost | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/posts");
      if (res.ok) {
        setPosts(await res.json());
      }
    } catch {
      toast.error("Failed to load posts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleDelete = async (postId: string) => {
    setDeleting(postId);
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        if (selectedPost?.id === postId) setSelectedPost(null);
        toast.success("Post deleted");
      } else {
        throw new Error();
      }
    } catch {
      toast.error("Failed to delete post");
    } finally {
      setDeleting(null);
    }
  };

  const handleDownload = (postId: string, slide?: number) => {
    const url = slide
      ? `/api/posts/${postId}/download?slide=${slide}`
      : `/api/posts/${postId}/download`;
    window.open(url, "_blank");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Posts Gallery</h1>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Posts Gallery</h1>
        <span className="text-sm text-muted-foreground">
          {posts.length} post{posts.length !== 1 ? "s" : ""}
        </span>
      </div>

      {posts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <p className="text-lg mb-2">No posts yet</p>
            <p className="text-sm">
              Generate your first post from the Generate page
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {posts.map((post) => (
            <Card
              key={post.id}
              className="overflow-hidden cursor-pointer group hover:ring-2 hover:ring-primary/50 transition-all"
              onClick={() => {
                setSelectedPost(post);
                setCurrentSlide(0);
              }}
            >
              <div className="relative">
                {post.images[0] ? (
                  <img
                    src={post.images[0].cloudinaryUrl}
                    alt="Post"
                    className="w-full aspect-[4/5] object-cover"
                  />
                ) : (
                  <div className="w-full aspect-[4/5] bg-muted flex items-center justify-center">
                    <span className="text-muted-foreground text-sm">
                      {post.status === "generating"
                        ? "Generating..."
                        : "Failed"}
                    </span>
                  </div>
                )}
                {post.format === "carousel" && (
                  <Badge className="absolute top-2 right-2" variant="secondary">
                    {post.images.length} slides
                  </Badge>
                )}
              </div>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Badge variant="outline" className="text-[10px]">
                    {post.aspectRatio}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {post.model}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {post.prompt}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(post.createdAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Post Detail Dialog */}
      <Dialog
        open={!!selectedPost}
        onOpenChange={(open) => !open && setSelectedPost(null)}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
          {selectedPost && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Post Details
                  <Badge variant="outline">{selectedPost.format}</Badge>
                  <Badge variant="outline">{selectedPost.aspectRatio}</Badge>
                </DialogTitle>
              </DialogHeader>

              {/* Image Viewer */}
              <div className="relative">
                {selectedPost.images.length > 0 && (
                  <>
                    <img
                      src={selectedPost.images[currentSlide]?.cloudinaryUrl}
                      alt={`Slide ${currentSlide + 1}`}
                      className="w-full rounded-lg"
                    />
                    {selectedPost.images.length > 1 && (
                      <div className="flex items-center justify-center gap-3 mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentSlide === 0}
                          onClick={() =>
                            setCurrentSlide((prev) => Math.max(0, prev - 1))
                          }
                        >
                          Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          {currentSlide + 1} / {selectedPost.images.length}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            currentSlide === selectedPost.images.length - 1
                          }
                          onClick={() =>
                            setCurrentSlide((prev) =>
                              Math.min(
                                selectedPost.images.length - 1,
                                prev + 1
                              )
                            )
                          }
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Thumbnail strip for carousel */}
              {selectedPost.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {selectedPost.images.map((img, idx) => (
                    <button
                      key={img.id}
                      onClick={() => setCurrentSlide(idx)}
                      className={`flex-shrink-0 rounded-md overflow-hidden border-2 transition-colors ${
                        currentSlide === idx
                          ? "border-primary"
                          : "border-transparent"
                      }`}
                    >
                      <img
                        src={img.cloudinaryUrl}
                        alt={`Slide ${idx + 1}`}
                        className="w-16 h-20 object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Info */}
              <div className="space-y-2 text-sm">
                {selectedPost.style && (
                  <p>
                    <span className="font-medium">Style:</span>{" "}
                    {selectedPost.style.name}
                  </p>
                )}
                <p>
                  <span className="font-medium">Model:</span>{" "}
                  {selectedPost.model}
                </p>
                <p className="text-muted-foreground">{selectedPost.prompt}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={() => handleDownload(selectedPost.id)}
                  className="flex-1"
                >
                  {selectedPost.images.length > 1
                    ? "Download All (ZIP)"
                    : "Download"}
                </Button>
                {selectedPost.images.length > 1 && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      handleDownload(
                        selectedPost.id,
                        selectedPost.images[currentSlide]?.slideNumber
                      )
                    }
                  >
                    Download This Slide
                  </Button>
                )}
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(selectedPost.id)}
                  disabled={deleting === selectedPost.id}
                >
                  {deleting === selectedPost.id ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
