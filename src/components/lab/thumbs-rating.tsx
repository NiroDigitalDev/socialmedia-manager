"use client";

import { useState } from "react";
import { ThumbsUpIcon, ThumbsDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ThumbsRatingProps {
  value: "up" | "down" | null;
  onRate: (rating: "up" | "down", comment?: string) => void;
}

export function ThumbsRating({ value, onRate }: ThumbsRatingProps) {
  const [downOpen, setDownOpen] = useState(false);
  const [comment, setComment] = useState("");

  return (
    <div className="flex items-center gap-1">
      {/* Thumbs Up */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "size-8",
          value === "up" && "text-green-600 bg-green-100 dark:bg-green-950/40"
        )}
        onClick={() => onRate("up")}
      >
        <ThumbsUpIcon className="size-4" />
      </Button>

      {/* Thumbs Down with comment popover */}
      <Popover open={downOpen} onOpenChange={setDownOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "size-8",
              value === "down" &&
                "text-red-600 bg-red-100 dark:bg-red-950/40"
            )}
          >
            <ThumbsDownIcon className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 space-y-3" align="start">
          <p className="text-xs font-medium text-muted-foreground">
            Why is this not good? (optional)
          </p>
          <Textarea
            placeholder="Add a comment..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[60px] text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onRate("down");
                setComment("");
                setDownOpen(false);
              }}
            >
              Skip
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onRate("down", comment || undefined);
                setComment("");
                setDownOpen(false);
              }}
            >
              Submit
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
