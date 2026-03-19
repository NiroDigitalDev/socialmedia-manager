"use client";

import { useState, useMemo } from "react";
import {
  useRun,
  useRunConcepts,
  useRunProgress,
  useCancelRun,
  useRateImageVariation,
  useRateCaptionVariation,
  useRetryVariation,
} from "@/hooks/use-lab";
import { ImageVariationCard } from "@/components/lab/image-variation-card";
import { CaptionVariationCard } from "@/components/lab/caption-variation-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { AlertCircleIcon, Loader2Icon, RefreshCwIcon, XCircleIcon } from "lucide-react";
import { PipelineTweaker } from "@/components/lab/pipeline-tweaker";

interface ResultsTabProps {
  runId: string;
}

/**
 * Sort variations: rated highest first, then unrated, failed at bottom.
 */
function sortVariations<T extends { rating: number | null; status: string }>(
  variations: T[]
): T[] {
  return [...variations].sort((a, b) => {
    // Failed at bottom
    if (a.status === "failed" && b.status !== "failed") return 1;
    if (b.status === "failed" && a.status !== "failed") return -1;
    // Generating near bottom (above failed)
    if (a.status === "generating" && b.status !== "generating" && b.status !== "failed") return 1;
    if (b.status === "generating" && a.status !== "generating" && a.status !== "failed") return -1;
    // Rated before unrated
    const aRated = a.rating != null && a.rating > 0;
    const bRated = b.rating != null && b.rating > 0;
    if (aRated && !bRated) return -1;
    if (!aRated && bRated) return 1;
    // Higher rating first
    if (aRated && bRated) return (b.rating ?? 0) - (a.rating ?? 0);
    return 0;
  });
}

export function ResultsTab({ runId }: ResultsTabProps) {
  const { data: run, isLoading: runLoading } = useRun(runId);
  const isGenerating = run?.status === "generating";

  const { data: progress } = useRunProgress(runId, isGenerating);

  // Concept tab state
  const [selectedConceptId, setSelectedConceptId] = useState<string | undefined>(
    undefined
  );

  // Get concept list (always fetch without conceptId for the tab list)
  const { data: conceptListData, isLoading: conceptsLoading } = useRunConcepts(
    runId,
    undefined
  );

  const cancelRun = useCancelRun();
  const rateImage = useRateImageVariation();
  const rateCaption = useRateCaptionVariation();
  const retryVariation = useRetryVariation();

  // For "Edit & Re-run" — Pipeline Tweaker state
  const [editVariationId, setEditVariationId] = useState<string | null>(null);
  const [editVariationType, setEditVariationType] = useState<"image" | "caption">("image");

  // Derive concept list
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conceptListRaw = conceptListData as any;
  const conceptList = useMemo(() => {
    if (conceptListRaw?.type === "list") {
      return conceptListRaw.concepts as {
        id: string;
        conceptNumber: number;
        _count: { imageVariations: number; captionVariations: number };
      }[];
    }
    return [] as {
      id: string;
      conceptNumber: number;
      _count: { imageVariations: number; captionVariations: number };
    }[];
  }, [conceptListRaw]);

  // Auto-select first concept when data loads
  const effectiveConceptId = selectedConceptId ?? conceptList[0]?.id;

  // Fetch selected concept data
  const { data: selectedConceptData, isLoading: selectedConceptLoading } =
    useRunConcepts(runId, effectiveConceptId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectedConceptRaw = selectedConceptData as any;
  const selectedConcept =
    selectedConceptRaw?.type === "single"
      ? (selectedConceptRaw.concept as {
          imageVariations: {
            id: string;
            variationNumber: number;
            status: string;
            r2Key: string | null;
            mimeType: string | null;
            rating: number | null;
            ratingComment: string | null;
            imagePrompt: string;
          }[];
          captionVariations: {
            id: string;
            variationNumber: number;
            status: string;
            text: string | null;
            rating: number | null;
            ratingComment: string | null;
            captionPrompt: string;
          }[];
        })
      : null;

  // Progress for the selected concept
  const conceptProgress = useMemo(() => {
    if (!progress || !effectiveConceptId) return null;
    return progress.find((p) => p.conceptId === effectiveConceptId) ?? null;
  }, [progress, effectiveConceptId]);

  // Sorted variations
  const sortedImages = useMemo(
    () => sortVariations(selectedConcept?.imageVariations ?? []),
    [selectedConcept?.imageVariations]
  );

  const sortedCaptions = useMemo(
    () => sortVariations(selectedConcept?.captionVariations ?? []),
    [selectedConcept?.captionVariations]
  );

  // Loading state
  if (runLoading || conceptsLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // No run data
  if (!run) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
        Run not found
      </div>
    );
  }

  // Configuring state
  if (run.status === "configuring") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
        <p className="text-sm text-muted-foreground">
          This run hasn&apos;t been started yet.
        </p>
        <p className="text-xs text-muted-foreground/60">
          Go to the Configure tab to set up and start generation.
        </p>
      </div>
    );
  }

  // No concepts
  if (conceptList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
        {isGenerating ? (
          <>
            <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Generating concepts...
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No results yet.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-6">
      {/* Header with cancel button */}
      {isGenerating && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Generating...</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => cancelRun.mutate({ runId })}
            disabled={cancelRun.isPending}
          >
            <XCircleIcon className="size-3.5" />
            Cancel
          </Button>
        </div>
      )}

      {/* Run-level failed banner */}
      {run.status === "failed" && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <AlertCircleIcon className="size-5 shrink-0 text-destructive/70" />
          <div>
            <p className="text-sm font-medium text-destructive">
              Run failed
            </p>
            <p className="text-xs text-muted-foreground">
              Some or all variations failed to generate. You can retry individual
              variations below.
            </p>
          </div>
        </div>
      )}

      {/* Cancelled banner */}
      {run.status === "cancelled" && (
        <div className="flex items-center gap-3 rounded-lg border border-orange-300/30 bg-orange-50/50 px-4 py-3 dark:border-orange-700/30 dark:bg-orange-950/20">
          <XCircleIcon className="size-5 shrink-0 text-orange-600 dark:text-orange-400" />
          <div>
            <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
              Run cancelled
            </p>
            <p className="text-xs text-muted-foreground">
              This run was cancelled. Completed variations are still available
              below.
            </p>
          </div>
        </div>
      )}

      {/* Concept tabs */}
      <Tabs
        value={effectiveConceptId ?? ""}
        onValueChange={(val) => setSelectedConceptId(val)}
      >
        <TabsList className="h-8 bg-muted/50">
          {conceptList.map((concept) => (
            <TabsTrigger
              key={concept.id}
              value={concept.id}
              className="text-xs"
            >
              Concept {concept.conceptNumber}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* One TabsContent per concept — all rendering goes here */}
        {conceptList.map((concept) => (
          <TabsContent key={concept.id} value={concept.id} className="mt-4">
            {concept.id === effectiveConceptId && (
              <ConceptContent
                isLoading={selectedConceptLoading}
                selectedConcept={selectedConcept}
                conceptProgress={conceptProgress}
                isGenerating={isGenerating}
                sortedImages={sortedImages}
                sortedCaptions={sortedCaptions}
                onRateImage={(variationId, rating, comment) =>
                  rateImage.mutate({ variationId, rating, comment })
                }
                onRateCaption={(variationId, rating, comment) =>
                  rateCaption.mutate({ variationId, rating, comment })
                }
                onRetryImage={(variationId) =>
                  retryVariation.mutate({ variationId, type: "image" })
                }
                onRetryCaption={(variationId) =>
                  retryVariation.mutate({ variationId, type: "caption" })
                }
                onEditVariation={(variationId, type) => {
                  setEditVariationId(variationId);
                  setEditVariationType(type);
                }}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Pipeline Tweaker drawer */}
      {editVariationId && run.experimentId && (
        <PipelineTweaker
          open={!!editVariationId}
          onClose={() => setEditVariationId(null)}
          variationId={editVariationId}
          variationType={editVariationType}
          runId={runId}
          experimentId={run.experimentId}
        />
      )}
    </div>
  );
}

// ── Concept Content (extracted to avoid re-mounting on tab switch) ────

interface ConceptContentProps {
  isLoading: boolean;
  selectedConcept: {
    imageVariations: {
      id: string;
      variationNumber: number;
      status: string;
      r2Key: string | null;
      mimeType: string | null;
      rating: number | null;
      ratingComment: string | null;
      imagePrompt: string;
    }[];
    captionVariations: {
      id: string;
      variationNumber: number;
      status: string;
      text: string | null;
      rating: number | null;
      ratingComment: string | null;
      captionPrompt: string;
    }[];
  } | null;
  conceptProgress: {
    images: { generating: number; completed: number; failed: number };
    captions: { generating: number; completed: number; failed: number };
  } | null;
  isGenerating: boolean;
  sortedImages: {
    id: string;
    variationNumber: number;
    status: string;
    r2Key: string | null;
    mimeType: string | null;
    rating: number | null;
    ratingComment: string | null;
    imagePrompt: string;
  }[];
  sortedCaptions: {
    id: string;
    variationNumber: number;
    status: string;
    text: string | null;
    rating: number | null;
    ratingComment: string | null;
    captionPrompt: string;
  }[];
  onRateImage: (variationId: string, rating: number, comment?: string) => void;
  onRateCaption: (variationId: string, rating: number, comment?: string) => void;
  onRetryImage: (variationId: string) => void;
  onRetryCaption: (variationId: string) => void;
  onEditVariation: (variationId: string, type: "image" | "caption") => void;
}

function ConceptContent({
  isLoading,
  selectedConcept,
  conceptProgress,
  isGenerating,
  sortedImages,
  sortedCaptions,
  onRateImage,
  onRateCaption,
  onRetryImage,
  onRetryCaption,
  onEditVariation,
}: ConceptContentProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!selectedConcept) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
        Select a concept to view results.
      </div>
    );
  }

  // Check if all variations failed
  const allImagesFailed =
    sortedImages.length > 0 && sortedImages.every((v) => v.status === "failed");
  const allCaptionsFailed =
    sortedCaptions.length > 0 &&
    sortedCaptions.every((v) => v.status === "failed");
  const allFailed = allImagesFailed && allCaptionsFailed;

  const totalImages =
    (conceptProgress?.images.completed ?? 0) +
    (conceptProgress?.images.generating ?? 0) +
    (conceptProgress?.images.failed ?? 0);
  const totalCaptions =
    (conceptProgress?.captions.completed ?? 0) +
    (conceptProgress?.captions.generating ?? 0) +
    (conceptProgress?.captions.failed ?? 0);
  const completedImages = conceptProgress?.images.completed ?? 0;
  const completedCaptions = conceptProgress?.captions.completed ?? 0;

  return (
    <div className="space-y-8">
      {/* All failed banner */}
      {allFailed && !isGenerating && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-3">
            <AlertCircleIcon className="size-5 text-destructive/70" />
            <div>
              <p className="text-sm font-medium text-destructive">
                All variations failed
              </p>
              <p className="text-xs text-muted-foreground">
                Generation failed for every variation in this concept. Retry to
                try again.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
            onClick={() => {
              sortedImages
                .filter((v) => v.status === "failed")
                .forEach((v) => onRetryImage(v.id));
              sortedCaptions
                .filter((v) => v.status === "failed")
                .forEach((v) => onRetryCaption(v.id));
            }}
          >
            <RefreshCwIcon className="size-3.5" />
            Retry All
          </Button>
        </div>
      )}

      {/* Progress bar when generating */}
      {isGenerating && conceptProgress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {completedImages}/{totalImages} images
              {" \u2022 "}
              {completedCaptions}/{totalCaptions} captions
            </span>
            <span>
              {totalImages + totalCaptions > 0
                ? Math.round(
                    ((completedImages + completedCaptions) /
                      (totalImages + totalCaptions)) *
                      100
                  )
                : 0}
              %
            </span>
          </div>
          <Progress
            value={
              totalImages + totalCaptions > 0
                ? ((completedImages + completedCaptions) /
                    (totalImages + totalCaptions)) *
                  100
                : 0
            }
            className="h-1.5"
          />
        </div>
      )}

      {/* Images section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Images</h3>
          {!allFailed && allImagesFailed && !isGenerating && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs text-destructive hover:text-destructive"
              onClick={() =>
                sortedImages
                  .filter((v) => v.status === "failed")
                  .forEach((v) => onRetryImage(v.id))
              }
            >
              <RefreshCwIcon className="size-3" />
              Retry All
            </Button>
          )}
        </div>
        {sortedImages.length === 0 ? (
          <p className="text-xs text-muted-foreground">No image variations.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {sortedImages.map((variation) => (
              <ImageVariationCard
                key={variation.id}
                variation={variation}
                onRate={(rating, comment) =>
                  onRateImage(variation.id, rating, comment)
                }
                onEdit={() => onEditVariation(variation.id, "image")}
                onRetry={() => onRetryImage(variation.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Captions section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Captions</h3>
          {!allFailed && allCaptionsFailed && !isGenerating && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs text-destructive hover:text-destructive"
              onClick={() =>
                sortedCaptions
                  .filter((v) => v.status === "failed")
                  .forEach((v) => onRetryCaption(v.id))
              }
            >
              <RefreshCwIcon className="size-3" />
              Retry All
            </Button>
          )}
        </div>
        {sortedCaptions.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No caption variations.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {sortedCaptions.map((variation) => (
              <CaptionVariationCard
                key={variation.id}
                variation={variation}
                onRate={(rating, comment) =>
                  onRateCaption(variation.id, rating, comment)
                }
                onEdit={() => onEditVariation(variation.id, "caption")}
                onRetry={() => onRetryCaption(variation.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
