"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ThumbsUpIcon,
  ThumbsDownIcon,
  StarIcon,
  ChevronDownIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

// ── Types ────────────────────────────────────────────────────────

interface BreakdownEntry {
  id: string;
  r2Key: string | null;
  rating: string | null;
  contentScore: number | null;
  styleScore: number | null;
  exportedPostId: string | null;
  captions: unknown;
}

interface StyleLearnings {
  keepContent: string[];
  keepStyle: string[];
  avoidContent: string[];
  avoidStyle: string[];
  summary: string;
}

interface StyleBreakdownCardProps {
  styleId: string;
  styleName: string;
  entries: BreakdownEntry[];
  learnings?: StyleLearnings | null;
  continued: boolean;
  onToggleContinue: () => void;
  countForNextRound: number;
  onCountChange: (count: number) => void;
}

// ── Component ────────────────────────────────────────────────────

export function StyleBreakdownCard({
  styleName,
  entries,
  learnings,
  continued,
  onToggleContinue,
  countForNextRound,
  onCountChange,
}: StyleBreakdownCardProps) {
  const [learningsOpen, setLearningsOpen] = useState(false);

  // Tally ratings
  const upCount = entries.filter((e) => e.rating === "up").length;
  const superCount = entries.filter((e) => e.rating === "super").length;
  const downCount = entries.filter((e) => e.rating === "down").length;
  const ratedTotal = upCount + superCount + downCount;

  // Winners: up + super entries with images
  const winners = entries.filter(
    (e) => (e.rating === "up" || e.rating === "super") && e.r2Key,
  );

  // Ratio bar widths (percentages)
  const upPct = ratedTotal > 0 ? (upCount / ratedTotal) * 100 : 0;
  const superPct = ratedTotal > 0 ? (superCount / ratedTotal) * 100 : 0;
  const downPct = ratedTotal > 0 ? (downCount / ratedTotal) * 100 : 0;

  const hasLearnings =
    learnings &&
    (learnings.keepContent.length > 0 ||
      learnings.keepStyle.length > 0 ||
      learnings.avoidContent.length > 0 ||
      learnings.avoidStyle.length > 0 ||
      learnings.summary);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{styleName}</CardTitle>
          <div className="flex items-center gap-3">
            <Label
              htmlFor={`continue-${styleName}`}
              className="text-xs text-muted-foreground"
            >
              {continued ? "Continue" : "Drop"}
            </Label>
            <Switch
              id={`continue-${styleName}`}
              checked={continued}
              onCheckedChange={onToggleContinue}
              size="sm"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Ratio bar */}
        {ratedTotal > 0 && (
          <div className="space-y-1.5">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              {superPct > 0 && (
                <div
                  className="bg-amber-500 transition-all"
                  style={{ width: `${superPct}%` }}
                />
              )}
              {upPct > 0 && (
                <div
                  className="bg-emerald-500 transition-all"
                  style={{ width: `${upPct}%` }}
                />
              )}
              {downPct > 0 && (
                <div
                  className="bg-red-500 transition-all"
                  style={{ width: `${downPct}%` }}
                />
              )}
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <ThumbsUpIcon className="size-3 text-emerald-500" />
                {upCount} liked
              </span>
              <span className="flex items-center gap-1">
                <StarIcon className="size-3 text-amber-500" />
                {superCount} gallery
              </span>
              <span className="flex items-center gap-1">
                <ThumbsDownIcon className="size-3 text-red-500" />
                {downCount} rejected
              </span>
            </div>
          </div>
        )}

        {/* Thumbnail grid of winners */}
        {winners.length > 0 && (
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {winners.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-md",
                  entry.rating === "super" && "ring-2 ring-amber-500",
                )}
              >
                <img
                  src={`${R2_PUBLIC_URL}/${entry.r2Key}`}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                {entry.rating === "super" && (
                  <StarIcon className="absolute right-0.5 top-0.5 size-3 fill-amber-500 text-amber-500" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Count for next round (only visible when continued) */}
        {continued && (
          <div className="flex items-center gap-3">
            <Label
              htmlFor={`count-${styleName}`}
              className="shrink-0 text-xs text-muted-foreground"
            >
              Images next round
            </Label>
            <Input
              id={`count-${styleName}`}
              type="number"
              min={1}
              max={50}
              value={countForNextRound}
              onChange={(e) =>
                onCountChange(
                  Math.max(1, Math.min(50, parseInt(e.target.value) || 1)),
                )
              }
              className="h-8 w-20"
            />
          </div>
        )}

        {/* Learnings (collapsible) */}
        {hasLearnings && (
          <Collapsible open={learningsOpen} onOpenChange={setLearningsOpen}>
            <CollapsibleTrigger className="flex w-full items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
              <ChevronDownIcon
                className={cn(
                  "size-3.5 transition-transform",
                  learningsOpen && "rotate-180",
                )}
              />
              AI Learnings
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-2 rounded-md bg-muted/50 p-3 text-xs">
                {learnings!.summary && (
                  <p className="text-muted-foreground">{learnings!.summary}</p>
                )}
                {learnings!.keepStyle.length > 0 && (
                  <div>
                    <span className="font-medium text-emerald-500">
                      Keep (style):
                    </span>{" "}
                    <span className="text-muted-foreground">
                      {learnings!.keepStyle.join(", ")}
                    </span>
                  </div>
                )}
                {learnings!.keepContent.length > 0 && (
                  <div>
                    <span className="font-medium text-emerald-500">
                      Keep (content):
                    </span>{" "}
                    <span className="text-muted-foreground">
                      {learnings!.keepContent.join(", ")}
                    </span>
                  </div>
                )}
                {learnings!.avoidStyle.length > 0 && (
                  <div>
                    <span className="font-medium text-red-500">
                      Avoid (style):
                    </span>{" "}
                    <span className="text-muted-foreground">
                      {learnings!.avoidStyle.join(", ")}
                    </span>
                  </div>
                )}
                {learnings!.avoidContent.length > 0 && (
                  <div>
                    <span className="font-medium text-red-500">
                      Avoid (content):
                    </span>{" "}
                    <span className="text-muted-foreground">
                      {learnings!.avoidContent.join(", ")}
                    </span>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Exported badge */}
        {entries.some((e) => e.exportedPostId) && (
          <Badge variant="secondary" className="text-xs">
            {entries.filter((e) => e.exportedPostId).length} exported
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
