"use client";

import { useMemo, useState } from "react";
import { useGenerateStore } from "@/stores/use-generate-store";
import type { Platform } from "@/stores/use-generate-store";
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
  FileTextIcon,
  ArrowLeftIcon,
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
  images: Array<{
    id: string;
    slideNumber: number;
    mimeType: string;
    url: string;
  }>;
}

export function StepResults() {
  const { generationId, reset, setStep } = useGenerateStore();
  const platforms: Platform[] = ["instagram"];
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Parse generationId into postIds array
  const postIds = useMemo(() => {
    if (!generationId) return undefined;
    const ids = generationId.split(",").filter(Boolean);
    return ids.length > 0 ? ids : undefined;
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
    setStep(4);
  };

  // Group results by platform
  const resultsByPlatform = useMemo(() => {
    if (!results) return {} as Record<Platform, GenerationResult[]>;
    return (results as GenerationResult[]).reduce(
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
    (r: GenerationResult) =>
      r.status === "completed" || r.status === "failed"
  );
  const anyGenerating = results?.some(
    (r: GenerationResult) => r.status === "generating"
  );
  const completedCount =
    results?.filter((r: GenerationResult) => r.status === "completed")
      .length ?? 0;
  const failedCount =
    results?.filter((r: GenerationResult) => r.status === "failed").length ??
    0;
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
          <Button
            variant="outline"
            onClick={handleGoBack}
            className="gap-1.5"
          >
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
          {Array.from({
            length: Math.min(postIds?.length ?? 4, 4),
          }).map((_, i) => (
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
              {(error as unknown as Error)?.message ?? "Please try again."}
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
            <Badge variant="secondary">{completedCount} completed</Badge>
          )}
          {failedCount > 0 && (
            <Badge variant="destructive">{failedCount} failed</Badge>
          )}
        </div>
      </div>

      {/* Platform tabs */}
      {platformsWithResults.length > 0 || anyGenerating ? (
        <Tabs defaultValue={platformsWithResults[0] ?? platforms[0]}>
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
            src={`/api/images/${result.images[0].id}?type=generated&format=webp&w=480`}
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
