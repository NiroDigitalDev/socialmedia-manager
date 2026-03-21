"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Tag definitions ──────────────────────────────────────────────

const CONTENT_TAGS = [
  "bad composition",
  "cluttered / too much text",
  "confusing layout",
  "wrong message / off-topic",
  "boring / generic",
  "text too small to read",
  "missing key information",
  "awkward text placement",
] as const;

const STYLE_TAGS = [
  "wrong style / doesn't match",
  "ugly colors",
  "off-brand",
  "bad typography",
  "low quality / blurry",
  "too dark / too bright",
  "colors clash",
  "feels outdated",
  "too generic / stock-photo feel",
] as const;

const BOTH_TAGS = [
  "too busy",
  "doesn't feel Instagram-ready",
  "would never post this",
] as const;

const ALL_REJECT_TAGS = [
  { group: "Content", tags: CONTENT_TAGS },
  { group: "Style", tags: STYLE_TAGS },
  { group: "Both", tags: BOTH_TAGS },
];

// ── Props ────────────────────────────────────────────────────────

export interface RatingOverlayProps {
  mode: "approve" | "reject";
  onConfirm: (data: { tags?: string[]; comment?: string }) => void;
  onCancel: () => void;
}

// ── Approve Panel ────────────────────────────────────────────────

function ApprovePanel({
  onConfirm,
  onCancel,
}: {
  onConfirm: RatingOverlayProps["onConfirm"];
  onCancel: () => void;
}) {
  const handleConfirm = useCallback(() => {
    onConfirm({});
  }, [onConfirm]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleConfirm, onCancel]);

  return (
    <div className="space-y-5">
      <h3 className="text-center text-lg font-semibold">Good to post?</h3>
      <p className="text-center text-sm text-muted-foreground">
        This image will be marked as publishable.
      </p>
      <p className="text-center text-xs text-muted-foreground">
        Enter confirm, Esc cancel
      </p>
      <div className="flex gap-3">
        <Button variant="ghost" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          onClick={handleConfirm}
        >
          Confirm
        </Button>
      </div>
    </div>
  );
}

// ── Reject Panel ─────────────────────────────────────────────────

function RejectPanel({
  onConfirm,
  onCancel,
}: {
  onConfirm: RatingOverlayProps["onConfirm"];
  onCancel: () => void;
}) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleConfirm = useCallback(() => {
    onConfirm({
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      comment: comment.trim() || undefined,
    });
  }, [selectedTags, comment, onConfirm]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleConfirm, onCancel]);

  return (
    <div className="space-y-4">
      <h3 className="text-center text-lg font-semibold">
        What&apos;s wrong with it?
      </h3>
      {ALL_REJECT_TAGS.map(({ group, tags }) => (
        <div key={group} className="space-y-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {group}
          </span>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors",
                    isSelected
                      ? "border-red-500/60 bg-red-500/15 text-red-400"
                      : "border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground",
                  )}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <Input
        placeholder="Additional comment (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleConfirm();
          }
        }}
      />
      <p className="text-center text-xs text-muted-foreground">
        Enter confirm, Esc cancel
      </p>
      <div className="flex gap-3">
        <Button variant="ghost" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="destructive" className="flex-1" onClick={handleConfirm}>
          Confirm
        </Button>
      </div>
    </div>
  );
}

// ── Main Overlay ─────────────────────────────────────────────────

export function RatingOverlay({
  mode,
  onConfirm,
  onCancel,
}: RatingOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Sheet */}
      <div className="relative z-10 w-full max-w-md animate-in slide-in-from-bottom-4 duration-300 rounded-t-2xl border border-border bg-card p-6 pb-8 shadow-xl">
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <XIcon className="size-5" />
        </button>
        {mode === "approve" ? (
          <ApprovePanel onConfirm={onConfirm} onCancel={onCancel} />
        ) : (
          <RejectPanel onConfirm={onConfirm} onCancel={onCancel} />
        )}
      </div>
    </div>
  );
}
