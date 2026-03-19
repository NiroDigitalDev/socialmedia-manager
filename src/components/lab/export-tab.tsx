"use client";

import { useState, useMemo, useCallback } from "react";
import { useRunConcepts, useExportToGallery } from "@/hooks/use-lab";
import { useTRPC } from "@/lib/trpc/client";
import { useQueries } from "@tanstack/react-query";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StarRating } from "@/components/lab/star-rating";
import { cn } from "@/lib/utils";
import {
  CheckCircle2Icon,
  DownloadIcon,
  ImageIcon,
  Loader2Icon,
  MessageSquareTextIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

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

interface Selections {
  [conceptId: string]: {
    imageVariationId: string | null;
    captionVariationId: string | null;
  };
}

// ── Helpers ──────────────────────────────────────────────────────

/** Pick the highest-rated completed variation, or first completed if none rated. */
function pickBest<T extends { id: string; status: string; rating: number | null }>(
  variations: T[]
): string | null {
  const completed = variations.filter((v) => v.status === "completed");
  if (completed.length === 0) return null;

  // Sort by rating descending (nulls treated as 0)
  const sorted = [...completed].sort(
    (a, b) => (b.rating ?? 0) - (a.rating ?? 0)
  );
  return sorted[0].id;
}

// ── Component ────────────────────────────────────────────────────

interface ExportTabProps {
  runId: string;
}

export function ExportTab({ runId }: ExportTabProps) {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const trpc = useTRPC();

  // 1. Fetch concept list
  const { data: conceptListData, isLoading: conceptsLoading } =
    useRunConcepts(runId, undefined);

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
    return [];
  }, [conceptListRaw]);

  // 2. Fetch all concept details in parallel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conceptQueries: Array<{ data: any; isSuccess: boolean; isLoading: boolean; dataUpdatedAt: number }> =
    useQueries({
      queries: conceptList.map((c) => ({
        ...trpc.lab.getRunConcepts.queryOptions({
          runId,
          conceptId: c.id,
        }),
      })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

  const allConceptsLoaded = conceptQueries.every((q) => q.isSuccess);
  const anyConceptLoading = conceptQueries.some((q) => q.isLoading);

  // 3. Parse concept data
  const concepts: ConceptData[] = useMemo(() => {
    if (!allConceptsLoaded) return [];
    return conceptQueries
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
  }, [allConceptsLoaded, ...conceptQueries.map((q) => q.dataUpdatedAt)]);

  // 4. Build initial selections (highest rated winners)
  const defaultSelections = useMemo(() => {
    const sel: Selections = {};
    for (const concept of concepts) {
      sel[concept.id] = {
        imageVariationId: pickBest(concept.imageVariations),
        captionVariationId: pickBest(concept.captionVariations),
      };
    }
    return sel;
  }, [concepts]);

  // 5. Selection state (initialized from defaults)
  const [selections, setSelections] = useState<Selections>({});

  // Merge defaults with user overrides
  const mergedSelections = useMemo(() => {
    const merged: Selections = {};
    for (const concept of concepts) {
      merged[concept.id] = {
        imageVariationId:
          selections[concept.id]?.imageVariationId ??
          defaultSelections[concept.id]?.imageVariationId ??
          null,
        captionVariationId:
          selections[concept.id]?.captionVariationId ??
          defaultSelections[concept.id]?.captionVariationId ??
          null,
      };
    }
    return merged;
  }, [concepts, selections, defaultSelections]);

  const handleImageSelect = useCallback(
    (conceptId: string, imageVariationId: string) => {
      setSelections((prev) => ({
        ...prev,
        [conceptId]: {
          ...prev[conceptId],
          imageVariationId,
          captionVariationId:
            prev[conceptId]?.captionVariationId ??
            defaultSelections[conceptId]?.captionVariationId ??
            null,
        },
      }));
    },
    [defaultSelections]
  );

  const handleCaptionSelect = useCallback(
    (conceptId: string, captionVariationId: string) => {
      setSelections((prev) => ({
        ...prev,
        [conceptId]: {
          ...prev[conceptId],
          captionVariationId,
          imageVariationId:
            prev[conceptId]?.imageVariationId ??
            defaultSelections[conceptId]?.imageVariationId ??
            null,
        },
      }));
    },
    [defaultSelections]
  );

  // 6. Export mutation
  const exportToGallery = useExportToGallery();

  // Determine which concepts can be exported (both image & caption selected)
  const exportableConcepts = useMemo(
    () =>
      concepts.filter((c) => {
        const sel = mergedSelections[c.id];
        return sel?.imageVariationId && sel?.captionVariationId;
      }),
    [concepts, mergedSelections]
  );

  const hasCompletedVariations = concepts.some(
    (c) =>
      c.imageVariations.some((v) => v.status === "completed") &&
      c.captionVariations.some((v) => v.status === "completed")
  );

  const handleExport = useCallback(
    (conceptIds: string[]) => {
      const exports = conceptIds
        .map((cId) => {
          const sel = mergedSelections[cId];
          if (!sel?.imageVariationId || !sel?.captionVariationId) return null;
          return {
            conceptId: cId,
            imageVariationId: sel.imageVariationId,
            captionVariationId: sel.captionVariationId,
          };
        })
        .filter(
          (e): e is NonNullable<typeof e> => e !== null
        );

      if (exports.length === 0) return;
      exportToGallery.mutate({ exports });
    },
    [mergedSelections, exportToGallery]
  );

  const handleExportAll = useCallback(() => {
    handleExport(exportableConcepts.map((c) => c.id));
  }, [handleExport, exportableConcepts]);

  // ── Loading ──────────────────────────────────────────────────

  if (conceptsLoading || anyConceptLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  // ── Empty ────────────────────────────────────────────────────

  if (concepts.length === 0 || !hasCompletedVariations) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
        <DownloadIcon className="size-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          No completed variations to export yet.
        </p>
        <p className="text-xs text-muted-foreground/60">
          Generate and rate results first, then come back to assemble and export
          your best combinations.
        </p>
      </div>
    );
  }

  // ── Success state ────────────────────────────────────────────

  if (exportToGallery.isSuccess) {
    const count = exportToGallery.data.postIds.length;
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <CheckCircle2Icon className="size-10 text-green-500" />
        <div className="space-y-1">
          <p className="text-sm font-medium">
            Exported {count} post{count === 1 ? "" : "s"} to Gallery
          </p>
          <p className="text-xs text-muted-foreground">
            Your selected winners are now available in the content gallery.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/projects/${projectId}/content`}>
              View Gallery
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => exportToGallery.reset()}
          >
            Export more
          </Button>
        </div>
      </div>
    );
  }

  // ── Main UI ──────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Export to Gallery</h2>
          <p className="text-xs text-muted-foreground">
            Pick one image and one caption per concept, then export.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportAll}
            disabled={
              exportableConcepts.length === 0 || exportToGallery.isPending
            }
          >
            {exportToGallery.isPending ? (
              <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <DownloadIcon className="mr-1.5 size-3.5" />
            )}
            Export All ({exportableConcepts.length})
          </Button>
        </div>
      </div>

      {/* Concept Accordions */}
      <Accordion
        type="multiple"
        defaultValue={concepts.map((c) => c.id)}
        className="space-y-2"
      >
        {concepts.map((concept) => {
          const sel = mergedSelections[concept.id];
          const completedImages = concept.imageVariations.filter(
            (v) => v.status === "completed" && v.r2Key
          );
          const completedCaptions = concept.captionVariations.filter(
            (v) => v.status === "completed" && v.text
          );

          const selectedImage = completedImages.find(
            (v) => v.id === sel?.imageVariationId
          );
          const selectedCaption = completedCaptions.find(
            (v) => v.id === sel?.captionVariationId
          );

          const canExport = !!sel?.imageVariationId && !!sel?.captionVariationId;

          return (
            <AccordionItem key={concept.id} value={concept.id} className="rounded-lg border">
              <AccordionTrigger className="px-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    Concept {concept.conceptNumber}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {completedImages.length} images, {completedCaptions.length}{" "}
                    captions
                  </span>
                  {canExport && (
                    <CheckCircle2Icon className="size-3.5 text-green-500" />
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr_280px]">
                  {/* Image Picker */}
                  <section className="space-y-3">
                    <div className="flex items-center gap-1.5">
                      <ImageIcon className="size-3.5 text-muted-foreground" />
                      <h4 className="text-xs font-medium">Select Image</h4>
                    </div>
                    {completedImages.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No completed images.
                      </p>
                    ) : (
                      <RadioGroup
                        value={sel?.imageVariationId ?? ""}
                        onValueChange={(val) =>
                          handleImageSelect(concept.id, val)
                        }
                        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                      >
                        {completedImages.map((img) => {
                          const imgSrc = img.r2Key ? r2Url(img.r2Key) : null;
                          const isSelected =
                            sel?.imageVariationId === img.id;
                          return (
                            <label
                              key={img.id}
                              className={cn(
                                "group relative cursor-pointer rounded-lg border-2 p-1 transition-colors",
                                isSelected
                                  ? "border-primary bg-primary/5"
                                  : "border-transparent hover:border-muted-foreground/20"
                              )}
                            >
                              <RadioGroupItem
                                value={img.id}
                                className="sr-only"
                              />
                              <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
                                {imgSrc ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={imgSrc}
                                    alt={`Variation ${img.variationNumber}`}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                                    No image
                                  </div>
                                )}
                                {isSelected && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-primary/10">
                                    <CheckCircle2Icon className="size-6 text-primary" />
                                  </div>
                                )}
                              </div>
                              <div className="mt-1 flex items-center justify-between px-0.5">
                                <span className="text-[10px] text-muted-foreground">
                                  #{img.variationNumber}
                                </span>
                                <StarRating
                                  value={img.rating}
                                  onChange={() => {}}
                                  size="sm"
                                />
                              </div>
                            </label>
                          );
                        })}
                      </RadioGroup>
                    )}
                  </section>

                  {/* Caption Picker */}
                  <section className="space-y-3">
                    <div className="flex items-center gap-1.5">
                      <MessageSquareTextIcon className="size-3.5 text-muted-foreground" />
                      <h4 className="text-xs font-medium">Select Caption</h4>
                    </div>
                    {completedCaptions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No completed captions.
                      </p>
                    ) : (
                      <RadioGroup
                        value={sel?.captionVariationId ?? ""}
                        onValueChange={(val) =>
                          handleCaptionSelect(concept.id, val)
                        }
                        className="space-y-2"
                      >
                        {completedCaptions.map((cap) => {
                          const isSelected =
                            sel?.captionVariationId === cap.id;
                          return (
                            <label
                              key={cap.id}
                              className={cn(
                                "group cursor-pointer rounded-lg border-2 p-3 transition-colors",
                                isSelected
                                  ? "border-primary bg-primary/5"
                                  : "border-transparent hover:border-muted-foreground/20"
                              )}
                            >
                              <RadioGroupItem
                                value={cap.id}
                                className="sr-only"
                              />
                              <div className="flex items-start justify-between gap-2">
                                <p className="line-clamp-3 flex-1 text-xs leading-relaxed">
                                  {cap.text}
                                </p>
                                {isSelected && (
                                  <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                                )}
                              </div>
                              <div className="mt-1.5 flex items-center justify-between">
                                <span className="text-[10px] text-muted-foreground">
                                  #{cap.variationNumber}
                                </span>
                                <StarRating
                                  value={cap.rating}
                                  onChange={() => {}}
                                  size="sm"
                                />
                              </div>
                            </label>
                          );
                        })}
                      </RadioGroup>
                    )}
                  </section>

                  {/* Preview */}
                  <section className="space-y-3">
                    <h4 className="text-xs font-medium">Preview</h4>
                    <Card className="overflow-hidden">
                      {/* Instagram-style preview */}
                      <div className="flex flex-col">
                        {/* Header */}
                        <div className="flex items-center gap-2 px-3 py-2">
                          <div className="size-6 rounded-full bg-muted" />
                          <span className="text-xs font-medium">
                            your_brand
                          </span>
                        </div>
                        {/* Image */}
                        <div className="aspect-square w-full bg-muted">
                          {selectedImage?.r2Key ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={r2Url(selectedImage.r2Key)}
                              alt="Selected image"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                              Select an image
                            </div>
                          )}
                        </div>
                        {/* Caption */}
                        <div className="px-3 py-2">
                          {selectedCaption?.text ? (
                            <p className="text-xs leading-relaxed">
                              <span className="font-semibold">
                                your_brand
                              </span>{" "}
                              {selectedCaption.text}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Select a caption
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>

                    {/* Per-concept export button */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={!canExport || exportToGallery.isPending}
                      onClick={() => handleExport([concept.id])}
                    >
                      <DownloadIcon className="mr-1.5 size-3.5" />
                      Export Concept {concept.conceptNumber}
                    </Button>
                  </section>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
