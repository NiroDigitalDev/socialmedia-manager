# Generation Pipeline UI Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Wire the Generate button (Step 5) and Results display (Step 6) to the real Gemini generation pipeline via tRPC mutations and queries with polling.

**Depends on:** Plan 2 (generation-data-layer -- `generation.generate` + `generation.getResults` procedures and `useGenerate` + `useGenerationResults` hooks), Plan 6 (style picker wired -- so styles are selectable in Step 4)

**Architecture:** Step 5 (`step-settings.tsx`) replaces its fake `handleGenerate` with a real `useGenerate()` mutation that sends all flow state to the server. On success, it stores the returned `postIds` and advances to Step 6. Step 6 (`step-results.tsx`) parses the post IDs, calls `useGenerationResults(postIds)` with automatic polling (refetch every 2s while any post has `status === "generating"`), and renders platform-tabbed result cards with images, text content, download, copy, and navigation actions.

**Tech Stack:** tRPC v11 mutations/queries via custom hooks, TanStack Query polling, Zustand (`useGenerateStore`), shadcn/ui (Tabs, TabsList, TabsTrigger, TabsContent, Card, CardContent, CardHeader, CardTitle, Button, Badge, Skeleton), Sonner toast, lucide-react icons, `cn()` utility

---

## Pre-flight Checks

- [ ] **Step 0a: Verify `generation.generate` procedure exists**

Check `src/lib/trpc/routers/generation.ts` has a `generate` mutation accepting:
```typescript
{
  prompt: string;
  platforms: string[];
  styleIds: string[];
  brandIdentityId?: string;
  colorOverride?: { accent: string; bg: string };
  formatPerPlatform: Record<string, string>;
  aspectRatioPerPlatform: Record<string, string>;
  model: "flash" | "pro";
  variations: number;
  includeLogo: boolean;
  outline: Array<{ id: string; platform: string; label: string; content: string; order: number }>;
  projectId?: string;
  campaignId?: string;
}
```
Returns: `{ postIds: string[] }`.

If not, implement it first per Plan 2.

- [ ] **Step 0b: Verify `generation.getResults` procedure exists**

Check `src/lib/trpc/routers/generation.ts` has a `getResults` query accepting `{ postIds: string[] }` and returning an array of:
```typescript
{
  id: string;
  prompt: string;
  format: string;
  aspectRatio: string;
  model: string;
  platform: Platform | null;
  status: string; // "pending" | "generating" | "completed" | "failed"
  description: string | null;
  textContent: string | null;
  createdAt: Date;
  style: { name: string } | null;
  images: Array<{ id: string; slideNumber: number; mimeType: string }>;
}
```

If not, implement it first per Plan 2.

- [ ] **Step 0c: Verify hooks exist in `src/hooks/use-generations.ts`**

Must export:
- `useGenerate()` -- TanStack `useMutation` wrapping `generation.generate`
- `useGenerationResults(postIds: string[])` -- TanStack `useQuery` with polling

If not present, add them:
```typescript
export function useGenerate() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.generation.generate.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.generation.recent.queryKey(),
      });
    },
  });
}

export function useGenerationResults(postIds: string[]) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.generation.getResults.queryOptions({ postIds }),
    enabled: postIds.length > 0,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.some((p: any) => p.status === "generating")) return 2000;
      return false;
    },
  });
}
```

---

## Task 1: Rewrite step-settings.tsx (Step 5)

- [ ] **Step 1: Replace `src/components/generate/step-settings.tsx`**

Full file rewrite. The existing file is 297 lines. Replace the entire contents:

```typescript
"use client";

import { useGenerateStore, type Platform } from "@/stores/use-generate-store";
import { useGenerate } from "@/hooks/use-generations";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  SparklesIcon,
  ZapIcon,
  CrownIcon,
  Loader2Icon,
} from "lucide-react";
import { toast } from "sonner";

const platformLabels: Record<Platform, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  reddit: "Reddit",
  x: "X",
  blog: "Blog",
  email: "Email",
};

const platformFormats: Record<Platform, { id: string; label: string }[]> = {
  instagram: [
    { id: "static", label: "Static" },
    { id: "carousel", label: "Carousel" },
  ],
  linkedin: [
    { id: "short", label: "Short" },
    { id: "long", label: "Long-form" },
  ],
  reddit: [
    { id: "text", label: "Text" },
    { id: "image", label: "Image" },
  ],
  x: [
    { id: "single", label: "Single" },
    { id: "thread", label: "Thread" },
  ],
  blog: [
    { id: "standard", label: "Standard" },
    { id: "listicle", label: "Listicle" },
  ],
  email: [
    { id: "newsletter", label: "Newsletter" },
    { id: "marketing", label: "Marketing" },
  ],
};

const imagePlatforms: Platform[] = ["instagram", "x", "reddit"];

const aspectRatios = [
  { id: "3:4", label: "3:4" },
  { id: "1:1", label: "1:1" },
  { id: "4:5", label: "4:5" },
  { id: "9:16", label: "9:16" },
];

const variationOptions = [1, 2, 3, 4, 6];

export function StepSettings() {
  const {
    platforms,
    content,
    outline,
    styleIds,
    brandIdentityId,
    colorOverride,
    settings,
    updateSettings,
    projectId,
    campaignId,
    setStep,
    setGenerationId,
  } = useGenerateStore();

  const generate = useGenerate();

  const handleGenerate = () => {
    generate.mutate(
      {
        prompt: content.prompt,
        platforms,
        styleIds,
        brandIdentityId: brandIdentityId ?? undefined,
        colorOverride: colorOverride ?? undefined,
        formatPerPlatform: settings.formatPerPlatform,
        aspectRatioPerPlatform: settings.aspectRatioPerPlatform,
        model: settings.model,
        variations: settings.variations,
        includeLogo: settings.includeLogo,
        outline: outline ?? [],
        projectId: projectId ?? undefined,
        campaignId: campaignId ?? undefined,
      },
      {
        onSuccess: (data) => {
          setGenerationId(data.postIds.join(","));
          setStep(6);
          toast.success("Generation started", {
            description:
              "Your content is being generated. Results will appear shortly.",
          });
        },
        onError: (err) => {
          toast.error(err.message ?? "Generation failed. Please try again.");
        },
      }
    );
  };

  const estimatedOutputs = platforms.length * settings.variations;

  const imagePlatformsSelected = platforms.filter((p) =>
    imagePlatforms.includes(p)
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Final configuration</h2>
        <p className="text-sm text-muted-foreground">
          Review your selections and configure generation settings.
        </p>
      </div>

      {/* Generation Summary */}
      <Card className="bg-gradient-to-t from-primary/5 to-card dark:bg-card">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Platforms:</span>
            <div className="flex gap-1 flex-wrap">
              {platforms.map((p) => (
                <Badge key={p} variant="secondary">
                  {platformLabels[p]}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Content:</span>
            <p className="text-sm mt-0.5 line-clamp-2">{content.prompt}</p>
          </div>
          {styleIds.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Styles:</span>
              <Badge variant="secondary">
                {styleIds.length} style{styleIds.length !== 1 ? "s" : ""}{" "}
                selected
              </Badge>
            </div>
          )}
          {outline && outline.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Outline:</span>
              <Badge variant="secondary">
                {outline.length} sections across {platforms.length} platforms
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-platform format */}
      <Card>
        <CardHeader>
          <CardTitle>Format</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {platforms.map((platform) => {
            const formats = platformFormats[platform];
            const current =
              settings.formatPerPlatform[platform] ?? formats[0].id;
            return (
              <div key={platform} className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  {platformLabels[platform]}
                </Label>
                <ToggleGroup
                  type="single"
                  value={current}
                  onValueChange={(val) => {
                    if (val) {
                      updateSettings({
                        formatPerPlatform: {
                          ...settings.formatPerPlatform,
                          [platform]: val,
                        },
                      });
                    }
                  }}
                  className="justify-start"
                >
                  {formats.map((f) => (
                    <ToggleGroupItem key={f.id} value={f.id} size="sm">
                      {f.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Aspect Ratio (only for image platforms) */}
      {imagePlatformsSelected.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Aspect Ratio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {imagePlatformsSelected.map((platform) => {
              const current =
                settings.aspectRatioPerPlatform[platform] ?? "1:1";
              return (
                <div key={platform} className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    {platformLabels[platform]}
                  </Label>
                  <ToggleGroup
                    type="single"
                    value={current}
                    onValueChange={(val) => {
                      if (val) {
                        updateSettings({
                          aspectRatioPerPlatform: {
                            ...settings.aspectRatioPerPlatform,
                            [platform]: val,
                          },
                        });
                      }
                    }}
                    className="justify-start"
                  >
                    {aspectRatios.map((ar) => (
                      <ToggleGroupItem key={ar.id} value={ar.id} size="sm">
                        {ar.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Model + Variations + Logo */}
      <Card>
        <CardHeader>
          <CardTitle>Generation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Model */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">AI Model</Label>
            <ToggleGroup
              type="single"
              value={settings.model}
              onValueChange={(val) => {
                if (val === "flash" || val === "pro") {
                  updateSettings({ model: val });
                }
              }}
              className="justify-start"
            >
              <ToggleGroupItem value="flash" className="gap-1.5">
                <ZapIcon className="size-3.5" />
                Flash
              </ToggleGroupItem>
              <ToggleGroupItem value="pro" className="gap-1.5">
                <CrownIcon className="size-3.5" />
                Pro
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Variations */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Variations per platform
            </Label>
            <ToggleGroup
              type="single"
              value={String(settings.variations)}
              onValueChange={(val) => {
                if (val) updateSettings({ variations: parseInt(val) });
              }}
              className="justify-start"
            >
              {variationOptions.map((n) => (
                <ToggleGroupItem key={n} value={String(n)} size="sm">
                  {n}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {/* Include Logo */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="include-logo"
              checked={settings.includeLogo}
              onCheckedChange={(checked) =>
                updateSettings({ includeLogo: checked === true })
              }
            />
            <Label htmlFor="include-logo" className="text-sm">
              Include logo in generated images
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Estimated output */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
        <div className="text-sm">
          <span className="text-muted-foreground">Estimated outputs:</span>{" "}
          <span className="font-medium">{estimatedOutputs} items</span>
          <span className="text-muted-foreground">
            {" "}
            ({platforms.length} platforms &times; {settings.variations}{" "}
            variations)
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep(4)}>
          Back
        </Button>
        <Button
          onClick={handleGenerate}
          size="lg"
          disabled={generate.isPending}
          className={cn("gap-2 flex-1 @lg/main:flex-none")}
        >
          {generate.isPending ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <SparklesIcon className="size-4" />
          )}
          {generate.isPending ? "Generating..." : "Generate"}
        </Button>
      </div>
    </div>
  );
}
```

**Key changes from original (297 lines):**

1. **Added** `import { useGenerate } from "@/hooks/use-generations"` and `Loader2Icon`
2. **Added** `outline`, `styleIds`, `brandIdentityId`, `colorOverride`, `projectId`, `campaignId` to destructured store values
3. **Replaced** fake `handleGenerate` (which just set `gen-${Date.now()}`) with real `generate.mutate()` call passing all flow state
4. **On success**: stores `data.postIds.join(",")` as generation ID, advances to step 6
5. **On error**: shows toast with server error message
6. **Disabled** Generate button while `generate.isPending`
7. **Added** loading spinner on button during generation
8. **Enhanced** Summary card with style count and outline section count
9. **Added** gradient to summary card: `bg-gradient-to-t from-primary/5 to-card dark:bg-card`

- [ ] **Step 2: Verify build**
```bash
bunx tsc --noEmit
```

- [ ] **Step 3: Commit**
```bash
git add src/components/generate/step-settings.tsx
git commit -m "feat: wire generate button to real Gemini API in Step 5"
```

---

## Task 2: Rewrite step-results.tsx (Step 6)

- [ ] **Step 1: Replace `src/components/generate/step-results.tsx`**

Full file rewrite. The existing file is 108 lines. Replace the entire contents:

```typescript
"use client";

import { useMemo } from "react";
import { useGenerateStore, type Platform } from "@/stores/use-generate-store";
import { useGenerationResults } from "@/hooks/use-generations";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  RotateCcwIcon,
  DownloadIcon,
  CopyIcon,
  CheckIcon,
  InboxIcon,
  Loader2Icon,
  ImageIcon,
  FileTextIcon,
  ArrowLeftIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const platformLabels: Record<Platform, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  reddit: "Reddit",
  x: "X",
  blog: "Blog",
  email: "Email",
};

const imagePlatforms: Platform[] = ["instagram", "x", "reddit"];

function isImagePlatform(platform: Platform): boolean {
  return imagePlatforms.includes(platform);
}

interface GenerationResult {
  id: string;
  prompt: string;
  format: string;
  aspectRatio: string;
  model: string;
  platform: Platform | null;
  status: string;
  description: string | null;
  textContent: string | null;
  createdAt: string | Date;
  style: { name: string } | null;
  images: Array<{ id: string; slideNumber: number; mimeType: string }>;
}

export function StepResults() {
  const { platforms, generationId, reset, setStep } = useGenerateStore();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Parse generationId into postIds array
  const postIds = useMemo(() => {
    if (!generationId) return [];
    return generationId.split(",").filter(Boolean);
  }, [generationId]);

  // Query results with polling
  const {
    data: results,
    isLoading,
    isError,
    error,
  } = useGenerationResults(postIds);

  const handleStartOver = () => {
    reset();
    setStep(1);
  };

  const handleGoBack = () => {
    setStep(5);
  };

  // Group results by platform
  const resultsByPlatform = useMemo(() => {
    if (!results) return {} as Record<Platform, GenerationResult[]>;
    return results.reduce(
      (acc, result) => {
        const platform = result.platform as Platform;
        if (platform) {
          if (!acc[platform]) acc[platform] = [];
          acc[platform].push(result);
        }
        return acc;
      },
      {} as Record<Platform, GenerationResult[]>
    );
  }, [results]);

  // Platforms that actually have results
  const platformsWithResults = useMemo(() => {
    return platforms.filter(
      (p) => resultsByPlatform[p] && resultsByPlatform[p].length > 0
    );
  }, [platforms, resultsByPlatform]);

  // Overall generation status
  const allCompleted = results?.every(
    (r) => r.status === "completed" || r.status === "failed"
  );
  const anyGenerating = results?.some((r) => r.status === "generating");
  const completedCount =
    results?.filter((r) => r.status === "completed").length ?? 0;
  const failedCount =
    results?.filter((r) => r.status === "failed").length ?? 0;
  const totalCount = results?.length ?? 0;

  const handleCopyText = async (text: string, resultId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(resultId);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleDownloadImage = (imageId: string, filename: string) => {
    const link = document.createElement("a");
    link.href = `/api/images/${imageId}?type=generated`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ---- NO GENERATION STARTED ----
  if (!generationId) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Your content</h2>
          <p className="text-sm text-muted-foreground">
            No generation started yet.
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <InboxIcon className="size-8 text-muted-foreground/40" />
            <p className="mt-4 text-sm font-medium text-muted-foreground">
              No results yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Go back to Settings and hit Generate to create content.
            </p>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleGoBack} className="gap-1.5">
            <ArrowLeftIcon className="size-3.5" />
            Back to Settings
          </Button>
        </div>
      </div>
    );
  }

  // ---- LOADING STATE (initial fetch) ----
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Your content</h2>
          <p className="text-sm text-muted-foreground">
            Loading generation results...
          </p>
        </div>

        <div className="space-y-4">
          {Array.from({ length: Math.min(postIds.length, 4) }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <Skeleton className="size-32 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-16 rounded-full" />
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ---- ERROR STATE ----
  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Your content</h2>
          <p className="text-sm text-muted-foreground">
            Failed to load results.
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <InboxIcon className="size-8 text-destructive/40" />
            <p className="mt-4 text-sm font-medium text-muted-foreground">
              Error loading results
            </p>
            <p className="mt-1 max-w-sm text-center text-xs text-muted-foreground/60">
              {(error as Error)?.message ?? "Please try again."}
            </p>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleGoBack}
            className="gap-1.5"
          >
            <ArrowLeftIcon className="size-3.5" />
            Back to Settings
          </Button>
          <Button
            variant="outline"
            onClick={handleStartOver}
            className="gap-1.5"
          >
            <RotateCcwIcon className="size-3.5" />
            Start Over
          </Button>
        </div>
      </div>
    );
  }

  // ---- RESULTS STATE ----
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Your content</h2>
          <p className="text-sm text-muted-foreground">
            {anyGenerating
              ? "Generation in progress. Results appear as they complete."
              : allCompleted
                ? `Generation complete. ${completedCount} of ${totalCount} succeeded.`
                : "Reviewing results."}
          </p>
        </div>
        {/* Status badges */}
        <div className="flex items-center gap-2">
          {anyGenerating && (
            <Badge variant="secondary" className="gap-1.5">
              <Loader2Icon className="size-3 animate-spin" />
              Generating...
            </Badge>
          )}
          {completedCount > 0 && (
            <Badge variant="secondary">
              {completedCount} completed
            </Badge>
          )}
          {failedCount > 0 && (
            <Badge variant="destructive">{failedCount} failed</Badge>
          )}
        </div>
      </div>

      {/* Platform tabs */}
      {platformsWithResults.length > 0 || anyGenerating ? (
        <Tabs
          defaultValue={platformsWithResults[0] ?? platforms[0]}
        >
          <TabsList>
            {platforms.map((platform) => {
              const count = resultsByPlatform[platform]?.length ?? 0;
              const platformGenerating = resultsByPlatform[platform]?.some(
                (r) => r.status === "generating"
              );
              return (
                <TabsTrigger
                  key={platform}
                  value={platform}
                  className="gap-1.5"
                >
                  {platformLabels[platform]}
                  {count > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-1 size-5 justify-center p-0 text-[10px]"
                    >
                      {count}
                    </Badge>
                  )}
                  {platformGenerating && (
                    <Loader2Icon className="ml-0.5 size-3 animate-spin" />
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {platforms.map((platform) => {
            const platformResults = resultsByPlatform[platform] ?? [];
            const isImage = isImagePlatform(platform);

            return (
              <TabsContent
                key={platform}
                value={platform}
                className="space-y-4"
              >
                {platformResults.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      {anyGenerating ? (
                        <>
                          <Loader2Icon className="size-8 animate-spin text-muted-foreground/40" />
                          <p className="mt-4 text-sm font-medium text-muted-foreground">
                            Generating {platformLabels[platform]} content...
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground/60">
                            Results will appear here as they complete.
                          </p>
                        </>
                      ) : (
                        <>
                          <InboxIcon className="size-8 text-muted-foreground/40" />
                          <p className="mt-4 text-sm font-medium text-muted-foreground">
                            No {platformLabels[platform]} results
                          </p>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div
                    className={cn(
                      "grid gap-4",
                      isImage
                        ? "grid-cols-1 @xl/main:grid-cols-2 @3xl/main:grid-cols-3"
                        : "grid-cols-1"
                    )}
                  >
                    {platformResults.map((result) => (
                      <ResultCard
                        key={result.id}
                        result={result}
                        isImage={isImage}
                        copiedId={copiedId}
                        onCopyText={handleCopyText}
                        onDownloadImage={handleDownloadImage}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <InboxIcon className="size-8 text-muted-foreground/40" />
            <p className="mt-4 text-sm font-medium text-muted-foreground">
              No results yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Results will appear as generation completes.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={handleGoBack}
          className="gap-1.5"
        >
          <ArrowLeftIcon className="size-3.5" />
          Generate More
        </Button>
        <Button
          variant="outline"
          onClick={handleStartOver}
          className="gap-1.5"
        >
          <RotateCcwIcon className="size-3.5" />
          Start Over
        </Button>
      </div>
    </div>
  );
}

// ---------- ResultCard sub-component ----------

interface ResultCardProps {
  result: GenerationResult;
  isImage: boolean;
  copiedId: string | null;
  onCopyText: (text: string, resultId: string) => void;
  onDownloadImage: (imageId: string, filename: string) => void;
}

function ResultCard({
  result,
  isImage,
  copiedId,
  onCopyText,
  onDownloadImage,
}: ResultCardProps) {
  // Still generating -- show skeleton
  if (result.status === "generating" || result.status === "pending") {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Skeleton
              className={cn(
                "shrink-0 rounded-lg",
                isImage ? "size-32" : "h-20 w-20"
              )}
            />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Generating...
                </span>
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Failed
  if (result.status === "failed") {
    return (
      <Card className="border-destructive/30 overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
              <InboxIcon className="size-6 text-destructive/40" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">
                Generation failed
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                {result.description ?? "An error occurred during generation."}
              </p>
              <div className="mt-2 flex gap-1">
                {result.style && (
                  <Badge variant="outline" className="text-[10px]">
                    {result.style.name}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px]">
                  {result.model}
                </Badge>
                <Badge variant="destructive" className="text-[10px]">
                  Failed
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Completed -- image platform
  if (isImage && result.images.length > 0) {
    return (
      <Card className="overflow-hidden bg-gradient-to-t from-primary/5 to-card dark:bg-card">
        <div className="relative aspect-square overflow-hidden">
          <img
            src={`/api/images/${result.images[0].id}?type=generated`}
            alt={result.description ?? "Generated image"}
            className="size-full object-cover"
            loading="lazy"
          />
          {result.images.length > 1 && (
            <Badge
              variant="secondary"
              className="absolute right-2 top-2 text-[10px]"
            >
              {result.images.length} slides
            </Badge>
          )}
        </div>
        <CardContent className="p-3 space-y-2">
          {/* Badges */}
          <div className="flex flex-wrap gap-1">
            {result.style && (
              <Badge variant="outline" className="text-[10px]">
                {result.style.name}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">
              {result.model}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {result.aspectRatio}
            </Badge>
          </div>

          {/* Description / caption */}
          {result.description && (
            <p className="text-xs text-muted-foreground line-clamp-3">
              {result.description}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-1 pt-1">
            {result.images.map((img, idx) => (
              <Button
                key={img.id}
                variant="ghost"
                size="sm"
                onClick={() =>
                  onDownloadImage(
                    img.id,
                    `${result.platform}-${idx + 1}.png`
                  )
                }
                className="gap-1.5 text-xs"
              >
                <DownloadIcon className="size-3" />
                {result.images.length > 1
                  ? `Slide ${idx + 1}`
                  : "Download"}
              </Button>
            ))}
            {result.textContent && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  onCopyText(result.textContent!, result.id)
                }
                className="gap-1.5 text-xs"
              >
                {copiedId === result.id ? (
                  <CheckIcon className="size-3" />
                ) : (
                  <CopyIcon className="size-3" />
                )}
                Copy Caption
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Completed -- text platform
  return (
    <Card className="overflow-hidden bg-gradient-to-t from-primary/5 to-card dark:bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileTextIcon className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm">
              {platformLabels[result.platform as Platform] ?? "Content"}
            </CardTitle>
          </div>
          <div className="flex gap-1">
            {result.style && (
              <Badge variant="outline" className="text-[10px]">
                {result.style.name}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">
              {result.model}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {result.format}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Text content */}
        {result.textContent ? (
          <div className="max-h-64 overflow-y-auto rounded-lg bg-muted/30 p-3">
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm">
              {result.textContent}
            </div>
          </div>
        ) : (
          <p className="text-sm italic text-muted-foreground">
            No text content generated.
          </p>
        )}

        {/* Description */}
        {result.description && (
          <p className="text-xs text-muted-foreground">
            {result.description}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-1">
          {result.textContent && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                onCopyText(result.textContent!, result.id)
              }
              className="gap-1.5 text-xs"
            >
              {copiedId === result.id ? (
                <CheckIcon className="size-3" />
              ) : (
                <CopyIcon className="size-3" />
              )}
              Copy Text
            </Button>
          )}
          {result.images.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                onDownloadImage(
                  result.images[0].id,
                  `${result.platform}-content.png`
                )
              }
              className="gap-1.5 text-xs"
            >
              <DownloadIcon className="size-3" />
              Download Image
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Key changes from original (108 lines):**

1. **Added** `import { useGenerationResults } from "@/hooks/use-generations"` and several new shadcn imports
2. **Added** `postIds` memo that parses `generationId` (comma-separated) into an array
3. **Added** `useGenerationResults(postIds)` query with automatic polling (polls every 2s while any post has `status === "generating"`)
4. **Added** `resultsByPlatform` memo that groups results by platform
5. **Added** `platformsWithResults` memo that filters to platforms with actual results (only those appear as tabs)
6. **Added** status tracking: `allCompleted`, `anyGenerating`, `completedCount`, `failedCount`
7. **Added** `handleCopyText()` for clipboard copying with visual feedback (check icon for 2 seconds)
8. **Added** `handleDownloadImage()` that creates an anchor element to trigger download
9. **Split** into 4 rendering states: no generation, loading, error, results
10. **Created** `ResultCard` sub-component with 4 states: generating (skeleton), failed (error card), completed image (image card with download), completed text (text card with copy)
11. **Image results**: show full image via `/api/images/${imageId}?type=generated`, multi-slide badge, per-slide download buttons
12. **Text results**: show rendered text in a scrollable container with copy button
13. **All result cards** show style badge, model badge, status badge
14. **Renamed** "Back to Settings" to "Generate More" (goes back to step 5 to generate again)
15. **Tab badges** show result count and spinning loader for platforms still generating

- [ ] **Step 2: Verify build**
```bash
bunx tsc --noEmit
```

- [ ] **Step 3: Commit**
```bash
git add src/components/generate/step-results.tsx
git commit -m "feat: display real generation results with polling in Step 6"
```

---

## Task 3: Smoke Test Checklist

### Step 5 (Settings)
- [ ] Navigate through generate flow to Step 5
- [ ] Summary card shows platforms, content prompt, style count, outline section count
- [ ] All format, aspect ratio, model, variation controls work as before
- [ ] Click "Generate" -- button shows spinner, becomes disabled
- [ ] On success: automatically advances to Step 6
- [ ] On error: toast shows error message, stays on Step 5

### Step 6 (Results)
- [ ] After generation starts: results page shows with platform tabs
- [ ] "Generating..." badge shows in header while any posts are in progress
- [ ] Skeleton cards appear for posts still being generated
- [ ] As posts complete (polling every 2s): real result cards replace skeletons
- [ ] Image platforms: show generated image with aspect ratio, download button works
- [ ] Text platforms: show text content in scrollable area, copy button works
- [ ] Copy button shows check icon for 2 seconds after copying
- [ ] Failed posts show error card with red border
- [ ] Tab badges show result count per platform
- [ ] "Generate More" button goes back to Step 5
- [ ] "Start Over" button resets entire flow to Step 1
- [ ] If no generation was started: shows empty state with "Back to Settings" button

---

## File Manifest

| File | Action | Description |
|------|--------|-------------|
| `src/components/generate/step-settings.tsx` | REPLACE | Full rewrite with real generation mutation |
| `src/components/generate/step-results.tsx` | REPLACE | Full rewrite with polling results display |

## Dependencies (must exist before executing)

| File | Provided By |
|------|-------------|
| `src/hooks/use-generations.ts` (exports `useGenerate`, `useGenerationResults`) | Plan 2 |
| `src/lib/trpc/routers/generation.ts` (has `generate` mutation, `getResults` query) | Plan 2 |
| `src/stores/use-generate-store.ts` (has `generationId`, `setGenerationId`, `outline`, etc.) | Already exists |
| `src/components/generate/step-style-brand.tsx` (style picker wired) | Plan 6 |
