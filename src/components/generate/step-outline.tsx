"use client";

import { useEffect, useState, useRef } from "react";
import {
  useGenerateStore,
  type OutlineSection,
  type Platform,
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
 * Transform raw AI outline response into OutlineSection[].
 *
 * The tRPC mutation returns an array of platform objects like:
 * [{ platform, headline, sections: [{ title, bullet_points, cta }], tone, format_recommendation }]
 *
 * We flatten these into OutlineSection[] for the Zustand store.
 */
function transformOutlineResponse(data: any[]): OutlineSection[] {
  const sections: OutlineSection[] = [];
  let order = 0;

  for (const platformObj of data) {
    const platform = platformObj.platform as Platform;

    // Add headline as the first section
    if (platformObj.headline) {
      sections.push({
        id: `${platform}-headline-${order}`,
        platform,
        label: "Headline",
        content: platformObj.headline,
        order: order++,
      });
    }

    // Add each sub-section
    if (Array.isArray(platformObj.sections)) {
      for (const sec of platformObj.sections) {
        const bullets = Array.isArray(sec.bullet_points)
          ? sec.bullet_points.join("\n")
          : "";
        const content = [bullets, sec.cta ? `CTA: ${sec.cta}` : ""]
          .filter(Boolean)
          .join("\n");

        sections.push({
          id: `${platform}-${order}`,
          platform,
          label: sec.title ?? "Section",
          content,
          order: order++,
        });
      }
    }

    // Add tone/format as a metadata section
    const meta = [
      platformObj.tone ? `Tone: ${platformObj.tone}` : "",
      platformObj.format_recommendation
        ? `Format: ${platformObj.format_recommendation}`
        : "",
    ]
      .filter(Boolean)
      .join(" | ");

    if (meta) {
      sections.push({
        id: `${platform}-meta-${order}`,
        platform,
        label: "Style Notes",
        content: meta,
        order: order++,
      });
    }
  }

  return sections;
}

const platformLabels: Record<Platform, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  reddit: "Reddit",
  x: "X",
  blog: "Blog",
  email: "Email",
};

export function StepOutline() {
  const {
    platforms,
    content,
    outline,
    setOutline,
    updateOutlineSection,
    setStep,
  } = useGenerateStore();

  const generateOutline = useGenerateOutline();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [regeneratingPlatform, setRegeneratingPlatform] =
    useState<Platform | null>(null);
  const hasTriggeredRef = useRef(false);

  // Auto-generate outline on mount when outline is null and we have data
  useEffect(() => {
    if (
      !outline &&
      platforms.length > 0 &&
      content.prompt.trim() &&
      !hasTriggeredRef.current &&
      !generateOutline.isPending
    ) {
      hasTriggeredRef.current = true;
      generateOutline.mutate(
        { prompt: content.prompt, platforms },
        {
          onSuccess: (data) => {
            setOutline(transformOutlineResponse(data));
          },
          onError: (err) => {
            toast.error(err.message ?? "Failed to generate outline");
          },
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Group sections by platform
  const sectionsByPlatform = (outline ?? []).reduce(
    (acc, section) => {
      if (!acc[section.platform]) acc[section.platform] = [];
      acc[section.platform].push(section);
      return acc;
    },
    {} as Record<Platform, OutlineSection[]>
  );

  // Regenerate outline for a single platform
  const handleRegeneratePlatform = (platform: Platform) => {
    setRegeneratingPlatform(platform);
    generateOutline.mutate(
      { prompt: content.prompt, platforms: [platform] },
      {
        onSuccess: (data) => {
          // Merge: replace sections for this platform, keep others
          const otherSections = (outline ?? []).filter(
            (s) => s.platform !== platform
          );
          const newSections = [...otherSections, ...transformOutlineResponse(data)].sort(
            (a, b) => a.order - b.order
          );
          setOutline(newSections);
          setRegeneratingPlatform(null);
          toast.success(
            `${platformLabels[platform]} outline regenerated`
          );
        },
        onError: (err) => {
          setRegeneratingPlatform(null);
          toast.error(
            err.message ??
              `Failed to regenerate ${platformLabels[platform]} outline`
          );
        },
      }
    );
  };

  // Regenerate all platforms
  const handleRegenerateAll = () => {
    generateOutline.mutate(
      { prompt: content.prompt, platforms },
      {
        onSuccess: (data) => {
          setOutline(transformOutlineResponse(data));
          toast.success("All outlines regenerated");
        },
        onError: (err) => {
          toast.error(err.message ?? "Failed to regenerate outlines");
        },
      }
    );
  };

  // Retry after initial failure
  const handleRetry = () => {
    generateOutline.mutate(
      { prompt: content.prompt, platforms },
      {
        onSuccess: (data) => {
          setOutline(transformOutlineResponse(data));
        },
        onError: (err) => {
          toast.error(err.message ?? "Failed to generate outline");
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

        <div className="space-y-6">
          {platforms.map((platform) => (
            <div key={platform} className="space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="space-y-2">
                {Array.from({ length: platform === "blog" ? 4 : 3 }).map(
                  (_, i) => (
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
                  )
                )}
              </div>
            </div>
          ))}
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
            Edit the outline for each platform. Click any section to modify
            it.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRegenerateAll}
          disabled={generateOutline.isPending}
          className="gap-1.5"
        >
          {generateOutline.isPending && !regeneratingPlatform ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <RefreshCwIcon className="size-3.5" />
          )}
          Regenerate All
        </Button>
      </div>

      <div className="space-y-6">
        {platforms.map((platform) => {
          const isRegenerating = regeneratingPlatform === platform;
          const sections = sectionsByPlatform[platform] ?? [];

          return (
            <div key={platform} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-medium">
                    {platformLabels[platform]}
                  </h3>
                  <Badge variant="secondary">
                    {sections.length} sections
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRegeneratePlatform(platform)}
                  disabled={
                    generateOutline.isPending || isRegenerating
                  }
                  className="gap-1.5"
                >
                  {isRegenerating ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCwIcon className="size-3.5" />
                  )}
                  Regenerate
                </Button>
              </div>

              {isRegenerating ? (
                // Skeleton while this platform regenerates
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i} size="sm">
                      <CardHeader className="pb-0">
                        <Skeleton className="h-3 w-20" />
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-2/3" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {sections.map((section) => {
                    const isEditing = editingId === section.id;
                    return (
                      <Card key={section.id} size="sm">
                        <CardHeader className="pb-0">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                              {section.label}
                            </CardTitle>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-6 p-0"
                              onClick={() =>
                                setEditingId(
                                  isEditing ? null : section.id
                                )
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
                            <Textarea
                              value={section.content}
                              onChange={(e) =>
                                updateOutlineSection(
                                  section.id,
                                  e.target.value
                                )
                              }
                              rows={3}
                              className="resize-none text-sm"
                              autoFocus
                              onBlur={() => setEditingId(null)}
                            />
                          ) : (
                            <p
                              className={cn(
                                "text-sm cursor-pointer rounded px-1 -mx-1 py-0.5 hover:bg-muted/50 transition-colors",
                                !section.content &&
                                  "text-muted-foreground italic"
                              )}
                              onClick={() =>
                                setEditingId(section.id)
                              }
                            >
                              {section.content ||
                                "Click to add content..."}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep(2)}>
          Back
        </Button>
        <Button
          onClick={() => setStep(4)}
          disabled={!outline || outline.length === 0}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
