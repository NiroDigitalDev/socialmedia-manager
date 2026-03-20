"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StarIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Tag definitions ──────────────────────────────────────────────

const CONTENT_TAGS = [
  "bad composition",
  "cluttered",
  "confusing layout",
  "wrong message",
];
const STYLE_TAGS = [
  "wrong style",
  "ugly colors",
  "off-brand",
  "bad text/typography",
  "low quality",
];
const BOTH_TAGS = ["too busy"];

const ALL_REJECT_TAGS = [
  { group: "Content", tags: CONTENT_TAGS },
  { group: "Style", tags: STYLE_TAGS },
  { group: "Both", tags: BOTH_TAGS },
];

// ── Props ────────────────────────────────────────────────────────

export interface RatingOverlayProps {
  mode: "approve" | "reject";
  onConfirm: (data: {
    contentScore?: number;
    styleScore?: number;
    tags?: string[];
    comment?: string;
  }) => void;
  onCancel: () => void;
}

// ── Star Row ─────────────────────────────────────────────────────

function StarRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-sm font-medium text-muted-foreground">
        {label}
      </span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="rounded p-0.5 transition-colors hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`${label} ${star} star${star > 1 ? "s" : ""}`}
          >
            <StarIcon
              className={cn(
                "size-7 transition-colors",
                star <= value
                  ? "fill-amber-400 text-amber-400"
                  : "fill-none text-muted-foreground/40",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Approve Panel ────────────────────────────────────────────────

function ApprovePanel({
  onConfirm,
  onCancel,
}: {
  onConfirm: RatingOverlayProps["onConfirm"];
  onCancel: () => void;
}) {
  const [contentScore, setContentScore] = useState(0);
  const [styleScore, setStyleScore] = useState(0);

  const canConfirm = contentScore > 0 && styleScore > 0;

  const handleConfirm = useCallback(() => {
    if (!canConfirm) return;
    onConfirm({ contentScore, styleScore });
  }, [canConfirm, contentScore, styleScore, onConfirm]);

  // Keyboard: 1-5 for content, Shift+1-5 for style, Enter confirms
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Ignore if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "Enter" && canConfirm) {
        e.preventDefault();
        handleConfirm();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 5) {
        e.preventDefault();
        if (e.shiftKey) {
          setStyleScore(num);
        } else {
          setContentScore(num);
        }
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [canConfirm, handleConfirm, onCancel]);

  return (
    <div className="space-y-5">
      <h3 className="text-center text-lg font-semibold">Rate this image</h3>
      <StarRow label="Content" value={contentScore} onChange={setContentScore} />
      <StarRow label="Style" value={styleScore} onChange={setStyleScore} />
      <p className="text-center text-xs text-muted-foreground">
        Keys: 1-5 content, Shift+1-5 style, Enter confirm, Esc cancel
      </p>
      <div className="flex gap-3">
        <Button variant="ghost" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          disabled={!canConfirm}
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

  // Keyboard: Enter confirms, Esc cancels
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
        <Button
          variant="destructive"
          className="flex-1"
          onClick={handleConfirm}
        >
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
