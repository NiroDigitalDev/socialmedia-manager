"use client";

import { useMemo } from "react";
import { useRun, useRunConcepts } from "@/hooks/use-lab";
import { useTRPC } from "@/lib/trpc/client";
import { useQueries } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StarRating } from "@/components/lab/star-rating";
import { cn } from "@/lib/utils";
import {
  AlertCircleIcon,
  CalendarIcon,
  GitBranchIcon,
} from "lucide-react";

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

function r2Url(r2Key: string): string {
  return `${R2_PUBLIC_URL.replace(/\/$/, "")}/${r2Key}`;
}

// ── Types ────────────────────────────────────────────────────────

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

interface CaptionVariation {
  id: string;
  variationNumber: number;
  status: string;
  text: string | null;
  rating: number | null;
  ratingComment: string | null;
  captionPrompt: string;
}

interface ConceptData {
  id: string;
  conceptNumber: number;
  imageVariations: ImageVariation[];
  captionVariations: CaptionVariation[];
}

// ── Helpers ──────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-500/15 text-green-700 dark:text-green-400",
  generating: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  failed: "bg-red-500/15 text-red-700 dark:text-red-400",
  configuring: "bg-muted text-muted-foreground",
  cancelled: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
};

/** Pick the highest-rated completed variation, or first completed if none rated. */
function pickBest<T extends { status: string; rating: number | null }>(
  variations: T[]
): T | null {
  const completed = variations.filter((v) => v.status === "completed");
  if (completed.length === 0) return null;
  const sorted = [...completed].sort(
    (a, b) => (b.rating ?? 0) - (a.rating ?? 0)
  );
  return sorted[0];
}

// Known setting labels for human-readable diff
const SETTING_LABELS: Record<string, string> = {
  contentPrompt: "Content Prompt",
  contentIdeaId: "Content Idea",
  contentSourceId: "Content Source",
  assetIds: "Assets",
  imageStyleId: "Image Style",
  captionStyleId: "Caption Style",
  model: "Model",
  aspectRatio: "Aspect Ratio",
  colorOverride: "Color Override",
  conceptCount: "Concepts",
  imageVariations: "Image Variations",
  captionVariations: "Caption Variations",
};

function formatSettingValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (typeof value === "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "None";
    return value.join(", ");
  }
  return String(value);
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Settings Diff ────────────────────────────────────────────────

interface SettingsDiffProps {
  settingsA: Record<string, unknown>;
  settingsB: Record<string, unknown>;
}

function SettingsDiff({ settingsA, settingsB }: SettingsDiffProps) {
  const allKeys = useMemo(() => {
    const keys = new Set([
      ...Object.keys(settingsA),
      ...Object.keys(settingsB),
    ]);
    return Array.from(keys);
  }, [settingsA, settingsB]);

  const diffs = useMemo(() => {
    return allKeys.filter((key) => {
      const valA = JSON.stringify(settingsA[key] ?? null);
      const valB = JSON.stringify(settingsB[key] ?? null);
      return valA !== valB;
    });
  }, [allKeys, settingsA, settingsB]);

  if (diffs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Both runs have identical settings.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="pb-2 pr-4 text-left font-medium text-muted-foreground">
              Setting
            </th>
            <th className="pb-2 pr-4 text-left font-medium text-blue-600 dark:text-blue-400">
              Run A
            </th>
            <th className="pb-2 text-left font-medium text-purple-600 dark:text-purple-400">
              Run B
            </th>
          </tr>
        </thead>
        <tbody>
          {diffs.map((key) => (
            <tr
              key={key}
              className="border-b border-amber-200/50 bg-amber-50/50 dark:border-amber-800/30 dark:bg-amber-950/20"
            >
              <td className="py-1.5 pr-4 font-medium">
                {SETTING_LABELS[key] ?? key}
              </td>
              <td className="py-1.5 pr-4 text-muted-foreground">
                {formatSettingValue(key, settingsA[key])}
              </td>
              <td className="py-1.5 text-muted-foreground">
                {formatSettingValue(key, settingsB[key])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Concept Comparison Row ───────────────────────────────────────

interface ConceptComparisonRowProps {
  conceptNumber: number;
  conceptA: ConceptData | null;
  conceptB: ConceptData | null;
}

function ConceptComparisonRow({
  conceptNumber,
  conceptA,
  conceptB,
}: ConceptComparisonRowProps) {
  const bestImageA = conceptA ? pickBest(conceptA.imageVariations) : null;
  const bestImageB = conceptB ? pickBest(conceptB.imageVariations) : null;
  const bestCaptionA = conceptA ? pickBest(conceptA.captionVariations) : null;
  const bestCaptionB = conceptB ? pickBest(conceptB.captionVariations) : null;

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h4 className="text-sm font-medium">Concept {conceptNumber}</h4>

      {/* Images side by side */}
      <div className="grid grid-cols-2 gap-4">
        <ComparisonImageCell variation={bestImageA} label="Run A" />
        <ComparisonImageCell variation={bestImageB} label="Run B" />
      </div>

      {/* Captions side by side */}
      <div className="grid grid-cols-2 gap-4">
        <ComparisonCaptionCell variation={bestCaptionA} label="Run A" />
        <ComparisonCaptionCell variation={bestCaptionB} label="Run B" />
      </div>
    </div>
  );
}

// ── Image Cell ───────────────────────────────────────────────────

function ComparisonImageCell({
  variation,
  label,
}: {
  variation: ImageVariation | null;
  label: string;
}) {
  if (!variation) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium text-muted-foreground">
          {label} - Image
        </span>
        <div className="flex aspect-square w-full items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
          No image
        </div>
      </div>
    );
  }

  const imgSrc =
    variation.status === "completed" && variation.r2Key
      ? r2Url(variation.r2Key)
      : null;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium text-muted-foreground">
        {label} - Image
      </span>
      <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
        {imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt={`${label} image variation ${variation.variationNumber}`}
            className="h-full w-full object-cover"
          />
        ) : variation.status === "failed" ? (
          <div className="flex h-full w-full items-center justify-center">
            <AlertCircleIcon className="size-8 text-destructive/60" />
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            {variation.status === "generating" ? "Generating..." : "No image"}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-0.5">
        <StarRating value={variation.rating} onChange={() => {}} size="sm" />
        <span className="max-w-[70%] truncate text-[10px] text-muted-foreground">
          {variation.imagePrompt.slice(0, 60)}
          {variation.imagePrompt.length > 60 ? "..." : ""}
        </span>
      </div>
    </div>
  );
}

// ── Caption Cell ─────────────────────────────────────────────────

function ComparisonCaptionCell({
  variation,
  label,
}: {
  variation: CaptionVariation | null;
  label: string;
}) {
  if (!variation) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium text-muted-foreground">
          {label} - Caption
        </span>
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          No caption
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium text-muted-foreground">
        {label} - Caption
      </span>
      <div className="rounded-md border p-3">
        <p className="line-clamp-4 text-xs leading-relaxed">
          {variation.text ?? (variation.status === "generating" ? "Generating..." : "No text")}
        </p>
      </div>
      <div className="flex items-center gap-2 px-0.5">
        <StarRating value={variation.rating} onChange={() => {}} size="sm" />
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────

interface RunComparisonProps {
  runId1: string;
  runId2: string;
}

export function RunComparison({ runId1, runId2 }: RunComparisonProps) {
  const trpc = useTRPC();

  // Fetch both runs
  const { data: runA, isLoading: loadingA } = useRun(runId1);
  const { data: runB, isLoading: loadingB } = useRun(runId2);

  // Fetch concept lists for both runs
  const { data: conceptListDataA, isLoading: conceptsLoadingA } =
    useRunConcepts(runId1, undefined);
  const { data: conceptListDataB, isLoading: conceptsLoadingB } =
    useRunConcepts(runId2, undefined);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conceptListRawA = conceptListDataA as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conceptListRawB = conceptListDataB as any;

  const conceptListA = useMemo(() => {
    if (conceptListRawA?.type === "list") {
      return conceptListRawA.concepts as {
        id: string;
        conceptNumber: number;
      }[];
    }
    return [];
  }, [conceptListRawA]);

  const conceptListB = useMemo(() => {
    if (conceptListRawB?.type === "list") {
      return conceptListRawB.concepts as {
        id: string;
        conceptNumber: number;
      }[];
    }
    return [];
  }, [conceptListRawB]);

  // Fetch all concept details for both runs in parallel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conceptQueriesA: Array<{ data: any; isSuccess: boolean; isLoading: boolean; dataUpdatedAt: number }> =
    useQueries({
      queries: conceptListA.map((c) => ({
        ...trpc.lab.getRunConcepts.queryOptions({
          runId: runId1,
          conceptId: c.id,
        }),
      })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conceptQueriesB: Array<{ data: any; isSuccess: boolean; isLoading: boolean; dataUpdatedAt: number }> =
    useQueries({
      queries: conceptListB.map((c) => ({
        ...trpc.lab.getRunConcepts.queryOptions({
          runId: runId2,
          conceptId: c.id,
        }),
      })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

  const allALoaded = conceptQueriesA.every((q) => q.isSuccess);
  const allBLoaded = conceptQueriesB.every((q) => q.isSuccess);
  const anyLoading =
    conceptQueriesA.some((q) => q.isLoading) ||
    conceptQueriesB.some((q) => q.isLoading);

  // Parse concept data
  const conceptsA: ConceptData[] = useMemo(() => {
    if (!allALoaded) return [];
    return conceptQueriesA
      .map((q) => {
        const raw = q.data;
        if (raw?.type === "single" && raw.concept) {
          return {
            id: raw.concept.id,
            conceptNumber: raw.concept.conceptNumber,
            imageVariations: raw.concept.imageVariations as ImageVariation[],
            captionVariations: raw.concept.captionVariations as CaptionVariation[],
          };
        }
        return null;
      })
      .filter((c): c is ConceptData => c !== null)
      .sort((a, b) => a.conceptNumber - b.conceptNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allALoaded, ...conceptQueriesA.map((q) => q.dataUpdatedAt)]);

  const conceptsB: ConceptData[] = useMemo(() => {
    if (!allBLoaded) return [];
    return conceptQueriesB
      .map((q) => {
        const raw = q.data;
        if (raw?.type === "single" && raw.concept) {
          return {
            id: raw.concept.id,
            conceptNumber: raw.concept.conceptNumber,
            imageVariations: raw.concept.imageVariations as ImageVariation[],
            captionVariations: raw.concept.captionVariations as CaptionVariation[],
          };
        }
        return null;
      })
      .filter((c): c is ConceptData => c !== null)
      .sort((a, b) => a.conceptNumber - b.conceptNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allBLoaded, ...conceptQueriesB.map((q) => q.dataUpdatedAt)]);

  // ── Loading ──────────────────────────────────────────────────

  if (loadingA || loadingB || conceptsLoadingA || conceptsLoadingB || anyLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="aspect-square w-full" />
        </div>
      </div>
    );
  }

  if (!runA || !runB) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
        Failed to load one or both runs.
      </div>
    );
  }

  // Parse settings — settingsSnapshot is a Prisma JsonValue; cast through unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settingsA = ((runA as any).settingsSnapshot ?? {}) as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settingsB = ((runB as any).settingsSnapshot ?? {}) as Record<string, unknown>;

  // Build concept number map for matching
  const conceptsByNumberA = new Map(
    conceptsA.map((c) => [c.conceptNumber, c])
  );
  const conceptsByNumberB = new Map(
    conceptsB.map((c) => [c.conceptNumber, c])
  );

  // Get all unique concept numbers across both runs
  const allConceptNumbers = Array.from(
    new Set([
      ...conceptsA.map((c) => c.conceptNumber),
      ...conceptsB.map((c) => c.conceptNumber),
    ])
  ).sort((a, b) => a - b);

  // Check if parent-child relationship
  const isTweaked =
    runA.parentRunId === runB.id || runB.parentRunId === runA.id;
  const tweakedFrom =
    runB.parentRunId === runA.id
      ? `Run #${runB.runNumber} was tweaked from Run #${runA.runNumber}`
      : runA.parentRunId === runB.id
        ? `Run #${runA.runNumber} was tweaked from Run #${runB.runNumber}`
        : null;

  const conceptCountDiff = conceptsA.length - conceptsB.length;

  return (
    <div className="flex flex-col gap-6 overflow-y-auto p-6">
      {/* Run metadata header */}
      <div className="grid grid-cols-2 gap-4">
        <RunMetadataCard run={runA} label="Run A" accentClass="border-blue-500/30 bg-blue-50/30 dark:bg-blue-950/20" />
        <RunMetadataCard run={runB} label="Run B" accentClass="border-purple-500/30 bg-purple-50/30 dark:bg-purple-950/20" />
      </div>

      {/* Tweak lineage note */}
      {isTweaked && tweakedFrom && (
        <div className="flex items-center gap-2 rounded-md border border-muted bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <GitBranchIcon className="size-3.5 shrink-0" />
          {tweakedFrom}
        </div>
      )}

      {/* Settings diff */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Settings Comparison</h3>
        <SettingsDiff settingsA={settingsA} settingsB={settingsB} />
      </section>

      {/* Concept count mismatch note */}
      {conceptCountDiff !== 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300/40 bg-amber-50/50 px-3 py-2 text-xs text-amber-700 dark:border-amber-700/40 dark:bg-amber-950/20 dark:text-amber-400">
          <AlertCircleIcon className="size-3.5 shrink-0" />
          {conceptCountDiff > 0
            ? `Run B has ${conceptCountDiff} fewer concept${conceptCountDiff > 1 ? "s" : ""} -- showing overlapping concepts only`
            : `Run A has ${Math.abs(conceptCountDiff)} fewer concept${Math.abs(conceptCountDiff) > 1 ? "s" : ""} -- showing overlapping concepts only`}
        </div>
      )}

      {/* Concept-by-concept comparison */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold">Concept Comparison</h3>
        {allConceptNumbers.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No concepts to compare. Both runs may still be configuring or
            generating.
          </p>
        ) : (
          allConceptNumbers.map((num) => (
            <ConceptComparisonRow
              key={num}
              conceptNumber={num}
              conceptA={conceptsByNumberA.get(num) ?? null}
              conceptB={conceptsByNumberB.get(num) ?? null}
            />
          ))
        )}
      </section>
    </div>
  );
}

// ── Run Metadata Card ────────────────────────────────────────────

function RunMetadataCard({
  run,
  label,
  accentClass,
}: {
  run: {
    runNumber: number;
    status: string;
    createdAt: string | Date;
    parentRunId?: string | null;
  };
  label: string;
  accentClass: string;
}) {
  return (
    <div className={cn("rounded-lg border p-3 space-y-1", accentClass)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            {label}
          </span>
          <span className="text-sm font-medium">Run #{run.runNumber}</span>
        </div>
        <Badge
          variant="secondary"
          className={cn(
            "h-5 px-2 text-[10px]",
            STATUS_COLORS[run.status] ?? STATUS_COLORS.configuring
          )}
        >
          {run.status}
        </Badge>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <CalendarIcon className="size-3" />
        {formatDate(run.createdAt)}
      </div>
    </div>
  );
}
