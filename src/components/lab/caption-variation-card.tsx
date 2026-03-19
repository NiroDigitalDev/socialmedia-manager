"use client";

import { useState } from "react";
import { StarRating } from "@/components/lab/star-rating";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircleIcon,
  MessageSquareIcon,
  PencilIcon,
  RefreshCwIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CaptionVariation {
  id: string;
  variationNumber: number;
  status: string;
  text: string | null;
  rating: number | null;
  ratingComment: string | null;
  captionPrompt: string;
}

interface CaptionVariationCardProps {
  variation: CaptionVariation;
  onRate: (rating: number, comment?: string) => void;
  onEdit: () => void;
  onRetry: () => void;
}

const TRUNCATE_LENGTH = 280;

export function CaptionVariationCard({
  variation,
  onRate,
  onEdit,
  onRetry,
}: CaptionVariationCardProps) {
  const [expanded, setExpanded] = useState(false);
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
      <div className="flex flex-col gap-3 rounded-lg border p-3">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    );
  }

  // Failed state
  if (variation.status === "failed") {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <div className="flex items-center gap-2">
          <AlertCircleIcon className="size-4 text-destructive/60" />
          <span className="text-xs text-destructive">
            Caption #{variation.variationNumber} failed
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-fit gap-1 px-2 text-xs"
          onClick={onRetry}
        >
          <RefreshCwIcon className="size-3" />
          Retry
        </Button>
      </div>
    );
  }

  // Completed state
  const text = variation.text ?? "";
  const isLong = text.length > TRUNCATE_LENGTH;
  const displayText =
    isLong && !expanded ? text.slice(0, TRUNCATE_LENGTH) + "..." : text;

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      {/* Caption text */}
      <div className="text-sm leading-relaxed whitespace-pre-wrap">
        {displayText}
      </div>
      {isLong && (
        <button
          type="button"
          className="w-fit text-xs font-medium text-primary hover:underline"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}

      {/* Rating + actions */}
      <div className="flex items-center justify-between pt-1">
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
  );
}
