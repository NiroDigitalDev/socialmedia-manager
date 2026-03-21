"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ThumbsUpIcon,
  DownloadIcon,
  ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

// ── Types ────────────────────────────────────────────────────────

interface Caption {
  text: string;
  selected: boolean;
}

interface WinnerEntry {
  id: string;
  roundId: string;
  imageStyleId: string;
  r2Key: string | null;
  rating: string | null;
  exportedPostId: string | null;
  captions: unknown;
}

interface WinnersGalleryProps {
  entries: WinnerEntry[];
  rounds: Array<{ id: string; roundNumber: number }>;
  styleNames: Record<string, string>;
  onExport: (entryIds: string[]) => void;
  onSelectCaption: (entryId: string, captionIndex: number) => void;
}

// ── Helpers ──────────────────────────────────────────────────────

function parseCaptions(captions: unknown): Caption[] {
  if (!captions || !Array.isArray(captions)) return [];
  return captions.filter(
    (c): c is Caption =>
      typeof c === "object" &&
      c !== null &&
      typeof (c as Caption).text === "string",
  );
}

// ── Component ────────────────────────────────────────────────────

export function WinnersGallery({
  entries,
  rounds,
  styleNames,
  onExport,
  onSelectCaption,
}: WinnersGalleryProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter to only approved entries
  const winners = useMemo(
    () => entries.filter((e) => e.rating === "up"),
    [entries],
  );

  // Round number lookup
  const roundNumberMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of rounds) {
      map[r.id] = r.roundNumber;
    }
    return map;
  }, [rounds]);

  const toggleSelection = useCallback((entryId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(winners.map((e) => e.id)));
  }, [winners]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleExport = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length > 0) {
      onExport(ids);
    }
  }, [selectedIds, onExport]);

  if (winners.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
        <ImageIcon className="size-10" />
        <p className="text-sm">No winning images yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={selectedIds.size === winners.length ? deselectAll : selectAll}
          >
            {selectedIds.size === winners.length ? "Deselect All" : "Select All"}
          </Button>
          {selectedIds.size > 0 && (
            <span className="text-xs text-muted-foreground">
              {selectedIds.size} selected
            </span>
          )}
        </div>
        <Button
          size="sm"
          disabled={selectedIds.size === 0}
          onClick={handleExport}
        >
          <DownloadIcon className="mr-1.5 size-3.5" />
          Export Selected
        </Button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {winners.map((entry) => {
          const isSelected = selectedIds.has(entry.id);
          const captions = parseCaptions(entry.captions);
          const roundNum = roundNumberMap[entry.roundId] ?? "?";
          const styleName = styleNames[entry.imageStyleId] ?? "Unknown";
          const imageUrl = entry.r2Key
            ? `${R2_PUBLIC_URL}/${entry.r2Key}`
            : null;

          return (
            <div key={entry.id} className="space-y-2">
              {/* Image card */}
              <button
                type="button"
                onClick={() => toggleSelection(entry.id)}
                className={cn(
                  "group relative w-full overflow-hidden rounded-lg border transition-all",
                  isSelected &&
                    "border-primary ring-2 ring-primary/50",
                  !isSelected && "border-border/50",
                )}
              >
                {/* Checkbox overlay */}
                <div className="absolute left-2 top-2 z-10">
                  <Checkbox
                    checked={isSelected}
                    tabIndex={-1}
                    className="pointer-events-none bg-black/40 backdrop-blur-sm"
                  />
                </div>

                {/* Badges */}
                <div className="absolute right-2 top-2 z-10 flex flex-col gap-1">
                  <Badge
                    variant="secondary"
                    className="bg-black/60 text-[10px] text-white backdrop-blur-sm"
                  >
                    R{roundNum}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="bg-black/60 text-[10px] text-white backdrop-blur-sm"
                  >
                    {styleName}
                  </Badge>
                </div>

                {/* Rating icon */}
                <div className="absolute bottom-2 right-2 z-10">
                  <ThumbsUpIcon className="size-4 text-emerald-500" />
                </div>

                {/* Exported indicator */}
                {entry.exportedPostId && (
                  <Badge
                    variant="secondary"
                    className="absolute bottom-2 left-2 z-10 bg-emerald-500/80 text-[10px] text-white"
                  >
                    Exported
                  </Badge>
                )}

                {/* Image */}
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt=""
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-muted">
                    <ImageIcon className="size-8 text-muted-foreground" />
                  </div>
                )}
              </button>

              {/* Caption list */}
              {captions.length > 0 && (
                <div className="space-y-1">
                  {captions.map((caption, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onSelectCaption(entry.id, idx)}
                      className={cn(
                        "w-full rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
                        caption.selected
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/50 text-muted-foreground hover:border-border",
                      )}
                    >
                      <p className="line-clamp-2">{caption.text}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
