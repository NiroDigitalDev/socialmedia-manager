"use client";

import { useState } from "react";
import { StarRating } from "@/components/lab/star-rating";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircleIcon,
  MessageSquareIcon,
  PencilIcon,
  RefreshCwIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

function r2Url(r2Key: string): string {
  return `${R2_PUBLIC_URL.replace(/\/$/, "")}/${r2Key}`;
}

interface ImageVariation {
  id: string;
  variationNumber: number;
  status: string;
  r2Key: string | null;
  mimeType: string | null;
  rating: number | null;
  ratingComment: string | null;
  imagePrompt: string;
}

interface ImageVariationCardProps {
  variation: ImageVariation;
  onRate: (rating: number, comment?: string) => void;
  onEdit: () => void;
  onRetry: () => void;
}

export function ImageVariationCard({
  variation,
  onRate,
  onEdit,
  onRetry,
}: ImageVariationCardProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState(
    variation.ratingComment ?? ""
  );

  const handleCommentBlur = () => {
    if (commentText !== (variation.ratingComment ?? "")) {
      onRate(variation.rating ?? 0, commentText || undefined);
    }
  };

  const handleRate = (rating: number) => {
    onRate(rating, commentText || undefined);
  };

  // Generating state
  if (variation.status === "generating") {
    return (
      <div className="flex flex-col gap-2 rounded-lg border p-2">
        <Skeleton className="aspect-square w-full rounded-md" />
        <div className="flex items-center gap-2 px-1">
          <Skeleton className="h-3.5 w-20" />
        </div>
      </div>
    );
  }

  // Failed state
  if (variation.status === "failed") {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2">
        <div className="flex aspect-square w-full items-center justify-center rounded-md bg-destructive/10">
          <AlertCircleIcon className="size-8 text-destructive/60" />
        </div>
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-destructive">
            Image #{variation.variationNumber} failed
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-xs"
            onClick={onRetry}
          >
            <RefreshCwIcon className="size-3" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Completed state
  const imgSrc = variation.r2Key ? r2Url(variation.r2Key) : null;

  return (
    <>
      <div className="flex flex-col gap-2 rounded-lg border p-2">
        {/* Thumbnail */}
        <button
          type="button"
          className="group relative aspect-square w-full cursor-pointer overflow-hidden rounded-md bg-muted"
          onClick={() => setLightboxOpen(true)}
        >
          {imgSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgSrc}
              alt={`Image variation ${variation.variationNumber}`}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              No image
            </div>
          )}
        </button>

        {/* Rating */}
        <div className="flex items-center justify-between px-1">
          <StarRating value={variation.rating} onChange={handleRate} size="sm" />
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "size-6",
                commentOpen && "bg-muted"
              )}
              onClick={() => setCommentOpen(!commentOpen)}
            >
              <MessageSquareIcon className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={onEdit}
            >
              <PencilIcon className="size-3" />
            </Button>
          </div>
        </div>

        {/* Comment textarea */}
        {commentOpen && (
          <Textarea
            placeholder="Add a comment..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onBlur={handleCommentBlur}
            rows={2}
            className="resize-none text-xs"
          />
        )}
      </div>

      {/* Lightbox dialog */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">
            Image variation {variation.variationNumber}
          </DialogTitle>
          {imgSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgSrc}
              alt={`Image variation ${variation.variationNumber} full size`}
              className="h-auto max-h-[80vh] w-full rounded-md object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
