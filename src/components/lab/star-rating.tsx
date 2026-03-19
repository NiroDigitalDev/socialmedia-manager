"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number | null;
  onChange: (rating: number) => void;
  size?: "sm" | "md";
}

export function StarRating({ value, onChange, size = "sm" }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const iconSize = size === "sm" ? "size-3.5" : "size-5";

  const handleClick = (star: number) => {
    // Click the same star that's already set => clear
    if (value === star) {
      onChange(0);
    } else {
      onChange(star);
    }
  };

  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => setHovered(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = hovered !== null ? star <= hovered : star <= (value ?? 0);
        return (
          <button
            key={star}
            type="button"
            className={cn(
              "cursor-pointer rounded-sm p-0.5 transition-colors hover:bg-muted",
              filled ? "text-amber-400" : "text-muted-foreground/40"
            )}
            onClick={() => handleClick(star)}
            onMouseEnter={() => setHovered(star)}
          >
            <Star
              className={cn(iconSize, filled && "fill-amber-400")}
            />
          </button>
        );
      })}
    </div>
  );
}
