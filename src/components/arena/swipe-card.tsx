"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

interface SwipeCardEntry {
  id: string;
  r2Key: string | null;
  imageStyleId: string;
}

interface SwipeCardProps {
  entry: SwipeCardEntry;
  styleName: string;
  /** Controls the transition direction: "enter" fades in, "exit" fades out */
  visible: boolean;
}

export function SwipeCard({ entry, styleName, visible }: SwipeCardProps) {
  const imageUrl = entry.r2Key ? `${R2_PUBLIC_URL}/${entry.r2Key}` : null;

  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center transition-opacity duration-300",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <div className="relative overflow-hidden rounded-2xl shadow-2xl shadow-black/40">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Arena entry"
            className="max-h-[65vh] w-auto rounded-2xl object-contain"
            draggable={false}
          />
        ) : (
          <div className="flex h-[65vh] w-80 items-center justify-center rounded-2xl bg-muted">
            <span className="text-sm text-muted-foreground">
              No image available
            </span>
          </div>
        )}
        <Badge
          variant="secondary"
          className="absolute left-3 top-3 bg-black/60 text-white backdrop-blur-sm"
        >
          {styleName}
        </Badge>
      </div>
    </div>
  );
}
