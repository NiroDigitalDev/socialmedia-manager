"use client";

import { useState, useCallback, useEffect } from "react";
import { useSwipeQueue, useRateEntry } from "@/hooks/use-arena";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SwipeCard } from "@/components/arena/swipe-card";
import { RatingOverlay } from "@/components/arena/rating-overlay";
import {
  XIcon,
  CheckIcon,
  StarIcon,
  Loader2Icon,
  PartyPopperIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────

/** Minimal entry shape from the swipe queue (avoids deep Prisma type instantiation) */
interface SwipeEntry {
  id: string;
  r2Key: string | null;
  imageStyleId: string;
}

interface SwipeViewProps {
  roundId: string;
  roundNumber: number;
  arenaId: string;
  onComplete: () => void;
  styleNames: Record<string, string>;
}

// ── Component ────────────────────────────────────────────────────

export function SwipeView({
  roundId,
  roundNumber,
  arenaId: _arenaId,
  onComplete,
  styleNames,
}: SwipeViewProps) {
  const { data: rawEntries, isLoading } = useSwipeQueue(roundId);
  const entries = rawEntries as SwipeEntry[] | undefined;
  const rateEntry = useRateEntry();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [overlayMode, setOverlayMode] = useState<"approve" | "reject" | null>(
    null,
  );
  // Track rated entry IDs so we can advance past them even before the query refetches
  const [ratedIds, setRatedIds] = useState<Set<string>>(new Set());

  // Filter out already-rated entries
  const unratedEntries = (entries ?? []).filter(
    (entry) => !ratedIds.has(entry.id),
  );
  const totalCount = (entries ?? []).length + ratedIds.size;
  const ratedCount = ratedIds.size;
  const currentEntry = unratedEntries[currentIndex] ?? null;
  const isComplete = !isLoading && unratedEntries.length === 0;
  const styleName = currentEntry
    ? (styleNames[currentEntry.imageStyleId] ?? "Unknown")
    : "";

  // ── Actions ──────────────────────────────────────────────────

  const advanceToNext = useCallback(() => {
    setOverlayMode(null);
    // currentIndex stays at 0 because the current entry gets filtered out of unratedEntries
  }, []);

  const handleReject = useCallback(() => {
    setOverlayMode("reject");
  }, []);

  const handleApprove = useCallback(() => {
    setOverlayMode("approve");
  }, []);

  const handleSuper = useCallback(() => {
    if (!currentEntry) return;
    setRatedIds((prev) => new Set(prev).add(currentEntry.id));
    rateEntry.mutate(
      { entryId: currentEntry.id, rating: "super" },
      { onSettled: advanceToNext },
    );
  }, [currentEntry, rateEntry, advanceToNext]);

  const handleOverlayConfirm = useCallback(
    (data: {
      contentScore?: number;
      styleScore?: number;
      tags?: string[];
      comment?: string;
    }) => {
      if (!currentEntry) return;

      setRatedIds((prev) => new Set(prev).add(currentEntry.id));

      if (overlayMode === "approve") {
        rateEntry.mutate(
          {
            entryId: currentEntry.id,
            rating: "up",
            contentScore: data.contentScore,
            styleScore: data.styleScore,
          },
          { onSettled: advanceToNext },
        );
      } else {
        rateEntry.mutate(
          {
            entryId: currentEntry.id,
            rating: "down",
            tags: data.tags,
            comment: data.comment,
          },
          { onSettled: advanceToNext },
        );
      }
    },
    [currentEntry, overlayMode, rateEntry, advanceToNext],
  );

  const handleOverlayCancel = useCallback(() => {
    setOverlayMode(null);
  }, []);

  // ── Keyboard listeners ───────────────────────────────────────

  useEffect(() => {
    // Don't listen when overlay is open (overlay has its own keyboard handlers)
    if (overlayMode !== null) return;
    if (isComplete || !currentEntry) return;

    function handleKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          handleReject();
          break;
        case "ArrowRight":
          e.preventDefault();
          handleApprove();
          break;
        case "ArrowUp":
          e.preventDefault();
          handleSuper();
          break;
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [overlayMode, isComplete, currentEntry, handleReject, handleApprove, handleSuper]);

  // ── Loading state ────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Round complete ───────────────────────────────────────────

  if (isComplete) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6">
        <PartyPopperIcon className="size-16 text-amber-400" />
        <div className="text-center">
          <h2 className="text-2xl font-bold">Round Complete!</h2>
          <p className="mt-1 text-muted-foreground">
            You&apos;ve rated all {totalCount} images in round {roundNumber}.
          </p>
        </div>
        <Button size="lg" onClick={onComplete}>
          View Results
        </Button>
      </div>
    );
  }

  // ── Main swipe view ──────────────────────────────────────────

  return (
    <div className="relative flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground">
          {ratedCount + 1}/{totalCount}
        </span>
        <Badge variant="secondary">{styleName}</Badge>
        <span className="text-sm font-medium text-muted-foreground">
          Round {roundNumber}
        </span>
      </div>

      {/* Image area */}
      <div className="relative flex-1 overflow-hidden">
        {unratedEntries.map((entry, idx) => (
          <SwipeCard
            key={entry.id}
            entry={entry}
            styleName={styleNames[entry.imageStyleId] ?? "Unknown"}
            visible={idx === currentIndex}
          />
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-6 px-4 py-6">
        {/* Reject */}
        <button
          type="button"
          onClick={handleReject}
          disabled={rateEntry.isPending}
          className={cn(
            "flex size-16 items-center justify-center rounded-full border-2 border-red-500/40 bg-red-500/10 text-red-400 transition-all",
            "hover:scale-110 hover:border-red-500 hover:bg-red-500/20",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500",
            "disabled:opacity-50 disabled:hover:scale-100",
          )}
          aria-label="Reject"
        >
          <XIcon className="size-7" />
        </button>

        {/* Approve */}
        <button
          type="button"
          onClick={handleApprove}
          disabled={rateEntry.isPending}
          className={cn(
            "flex size-16 items-center justify-center rounded-full border-2 border-emerald-500/40 bg-emerald-500/10 text-emerald-400 transition-all",
            "hover:scale-110 hover:border-emerald-500 hover:bg-emerald-500/20",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
            "disabled:opacity-50 disabled:hover:scale-100",
          )}
          aria-label="Approve"
        >
          <CheckIcon className="size-7" />
        </button>

        {/* Super */}
        <button
          type="button"
          onClick={handleSuper}
          disabled={rateEntry.isPending}
          className={cn(
            "flex size-16 items-center justify-center rounded-full border-2 border-amber-500/40 bg-amber-500/10 text-amber-400 transition-all",
            "hover:scale-110 hover:border-amber-500 hover:bg-amber-500/20",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
            "disabled:opacity-50 disabled:hover:scale-100",
          )}
          aria-label="Super"
        >
          <StarIcon className="size-7" />
        </button>
      </div>

      {/* Keyboard hint */}
      <p className="pb-3 text-center text-xs text-muted-foreground/60">
        Arrow keys: Left reject, Right approve, Up super
      </p>

      {/* Rating overlay */}
      {overlayMode && (
        <RatingOverlay
          mode={overlayMode}
          onConfirm={handleOverlayConfirm}
          onCancel={handleOverlayCancel}
        />
      )}
    </div>
  );
}
