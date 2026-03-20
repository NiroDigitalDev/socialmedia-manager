"use client";

import { useEffect, useState, useRef } from "react";
import {
  useGenerateStore,
  type GenerateOutline,
} from "@/stores/use-generate-store";
import { useGenerateOutline } from "@/hooks/use-generations";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  RefreshCwIcon,
  PencilIcon,
  CheckIcon,
  AlertCircleIcon,
  Loader2Icon,
} from "lucide-react";
import { toast } from "sonner";

/**
 * Transform raw AI outline response into GenerateOutline.
 *
 * The tRPC mutation still expects `platforms` in its input, so we pass
 * `["instagram"]`. The response shape we request from the AI is:
 * { slides: [{ imagePrompt, layoutNotes }], caption: "..." }
 *
 * We handle fallback for the old platform-grouped shape too.
 */
function transformOutlineResponse(data: unknown): GenerateOutline | null {
  if (!data || typeof data !== "object") return null;

  // New shape: { slides: [...], caption: "..." }
  if ("slides" in (data as any) && Array.isArray((data as any).slides)) {
    const raw = data as any;
    return {
      slides: raw.slides.map((s: any, i: number) => ({
        id: `slide-${i + 1}`,
        slideNumber: i + 1,
        imagePrompt: s.imagePrompt ?? s.image_prompt ?? s.content ?? "",
        layoutNotes: s.layoutNotes ?? s.layout_notes ?? "",
      })),
      caption: raw.caption ?? "",
    };
  }

  // Old shape: array of platform objects — extract Instagram sections
  if (Array.isArray(data)) {
    const igObj = data.find((d: any) => d?.platform === "instagram") ?? data[0];
    if (!igObj) return null;

    const slides = (igObj.sections ?? []).map((sec: any, i: number) => ({
      id: `slide-${i + 1}`,
      slideNumber: i + 1,
      imagePrompt:
        sec.imagePrompt ??
        sec.image_prompt ??
        (Array.isArray(sec.bullet_points) ? sec.bullet_points.join(". ") : sec.title ?? ""),
      layoutNotes: sec.layoutNotes ?? sec.layout_notes ?? sec.cta ?? "",
    }));

    return {
      slides,
      caption: igObj.headline ?? "",
    };
  }

  return null;
}

export function StepOutline() {
  const {
    content,
    imageStyleId,
    captionStyleId,
    outline,
    setOutline,
    updateOutlineSlide,
    updateOutlineCaption,
    setStep,
  } = useGenerateStore();

  const generateOutline = useGenerateOutline();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCaption, setEditingCaption] = useState(false);
  const hasTriggeredRef = useRef(false);

  // Auto-generate outline on mount when outline is null and we have data
  useEffect(() => {
    if (
      !outline &&
      content.prompt.trim() &&
      !hasTriggeredRef.current &&
      !generateOutline.isPending
    ) {
      hasTriggeredRef.current = true;
      const toastId = toast.loading("Generating content outline...");

      generateOutline
        .mutateAsync({ prompt: content.prompt, platforms: ["instagram"] })
        .then((data) => {
          const parsed = transformOutlineResponse(data);
          setOutline(parsed);
          toast.success("Outline ready", { id: toastId });
        })
        .catch((err) => {
          toast.error(err?.message ?? "Failed to generate outline", {
            id: toastId,
          });
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Regenerate entire outline
  const handleRegenerateAll = () => {
    const toastId = toast.loading("Regenerating outline...");
    generateOutline.mutate(
      { prompt: content.prompt, platforms: ["instagram"] },
      {
        onSuccess: (data) => {
          const parsed = transformOutlineResponse(data);
          setOutline(parsed);
          toast.success("Outline regenerated", { id: toastId });
        },
        onError: (err) => {
          toast.error(err.message ?? "Failed to regenerate outline", {
            id: toastId,
          });
        },
      }
    );
  };

  // Retry after initial failure
  const handleRetry = () => {
    const toastId = toast.loading("Generating content outline...");
    generateOutline.mutate(
      { prompt: content.prompt, platforms: ["instagram"] },
      {
        onSuccess: (data) => {
          const parsed = transformOutlineResponse(data);
          setOutline(parsed);
          toast.success("Outline ready", { id: toastId });
        },
        onError: (err) => {
          toast.error(err.message ?? "Failed to generate outline", {
            id: toastId,
          });
        },
      }
    );
  };

  // ---- LOADING STATE ----
  if (!outline && generateOutline.isPending) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Review the plan</h2>
          <p className="text-sm text-muted-foreground">
            AI is generating your content outline...
          </p>
        </div>

        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} size="sm">
              <CardHeader className="pb-0">
                <Skeleton className="h-3 w-20" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
          {/* Caption skeleton */}
          <Card size="sm">
            <CardHeader className="pb-0">
              <Skeleton className="h-3 w-16" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ---- ERROR STATE (no outline, mutation failed) ----
  if (!outline && generateOutline.isError) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Review the plan</h2>
          <p className="text-sm text-muted-foreground">
            Something went wrong while generating the outline.
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircleIcon className="size-10 text-destructive/60" />
            <p className="mt-4 text-sm font-medium text-muted-foreground">
              Failed to generate outline
            </p>
            <p className="mt-1 max-w-sm text-center text-xs text-muted-foreground/60">
              {generateOutline.error?.message ??
                "The AI service may be temporarily unavailable. Please try again."}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={generateOutline.isPending}
              className="mt-4 gap-1.5"
            >
              {generateOutline.isPending ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <RefreshCwIcon className="size-3.5" />
              )}
              Try Again
            </Button>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep(2)}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  // ---- SUCCESS STATE (outline exists) ----
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Review the plan</h2>
          <p className="text-sm text-muted-foreground">
            Edit the slide prompts and caption. Click any section to modify it.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRegenerateAll}
          disabled={generateOutline.isPending}
          className="gap-1.5"
        >
          {generateOutline.isPending ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <RefreshCwIcon className="size-3.5" />
          )}
          Regenerate
        </Button>
      </div>

      {/* Slides */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-medium">Slides</h3>
          <Badge variant="secondary">
            {outline?.slides.length ?? 0} slide
            {(outline?.slides.length ?? 0) !== 1 ? "s" : ""}
          </Badge>
        </div>

        <div className="space-y-2">
          {(outline?.slides ?? []).map((slide) => {
            const isEditing = editingId === slide.id;
            return (
              <Card key={slide.id} size="sm">
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Slide {slide.slideNumber}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-6 p-0"
                      onClick={() =>
                        setEditingId(isEditing ? null : slide.id)
                      }
                    >
                      {isEditing ? (
                        <CheckIcon className="size-3" />
                      ) : (
                        <PencilIcon className="size-3" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isEditing ? (
                    <div className="space-y-2">
                      <Textarea
                        value={slide.imagePrompt}
                        onChange={(e) =>
                          updateOutlineSlide(slide.id, {
                            imagePrompt: e.target.value,
                          })
                        }
                        rows={3}
                        className="resize-none text-sm"
                        autoFocus
                        placeholder="Image prompt for this slide..."
                      />
                      <Textarea
                        value={slide.layoutNotes}
                        onChange={(e) =>
                          updateOutlineSlide(slide.id, {
                            layoutNotes: e.target.value,
                          })
                        }
                        rows={2}
                        className="resize-none text-xs"
                        placeholder="Layout notes (optional)..."
                      />
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "cursor-pointer rounded px-1 -mx-1 py-0.5 hover:bg-muted/50 transition-colors"
                      )}
                      onClick={() => setEditingId(slide.id)}
                    >
                      <p
                        className={cn(
                          "text-sm",
                          !slide.imagePrompt && "text-muted-foreground italic"
                        )}
                      >
                        {slide.imagePrompt || "Click to add image prompt..."}
                      </p>
                      {slide.layoutNotes && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {slide.layoutNotes}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Caption */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium">Caption</h3>
          <Button
            variant="ghost"
            size="sm"
            className="size-6 p-0"
            onClick={() => setEditingCaption(!editingCaption)}
          >
            {editingCaption ? (
              <CheckIcon className="size-3" />
            ) : (
              <PencilIcon className="size-3" />
            )}
          </Button>
        </div>

        <Card size="sm">
          <CardContent>
            {editingCaption ? (
              <Textarea
                value={outline?.caption ?? ""}
                onChange={(e) => updateOutlineCaption(e.target.value)}
                rows={4}
                className="resize-none text-sm"
                autoFocus
                placeholder="Instagram caption text..."
                onBlur={() => setEditingCaption(false)}
              />
            ) : (
              <p
                className={cn(
                  "text-sm cursor-pointer rounded px-1 -mx-1 py-0.5 hover:bg-muted/50 transition-colors whitespace-pre-wrap",
                  !outline?.caption && "text-muted-foreground italic"
                )}
                onClick={() => setEditingCaption(true)}
              >
                {outline?.caption || "Click to add caption..."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep(2)}>
          Back
        </Button>
        <Button
          onClick={() => setStep(4)}
          disabled={!outline || outline.slides.length === 0}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
