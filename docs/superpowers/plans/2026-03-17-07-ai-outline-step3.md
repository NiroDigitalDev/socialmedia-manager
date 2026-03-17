# AI Outline Step 3 Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Replace mock outline generation in Step 3 with real Gemini AI-powered outlines using the `generation.generateOutline` tRPC mutation.

**Depends on:** Plan 2 (generation-data-layer -- `generateOutline` procedure in `src/lib/trpc/routers/generation.ts` and `useGenerateOutline` hook in `src/hooks/use-generations.ts`)

**Architecture:** The current `step-outline.tsx` uses a local `generateMockOutline()` function that returns hardcoded templates per platform. This plan rewrites the component to call the `useGenerateOutline()` mutation on mount (when outline is null), display skeleton loading states grouped by platform, handle errors with retry, and support per-platform regeneration. Inline editing of sections via `updateOutlineSection()` is preserved. The `OutlineSection` type (`{ id, platform, label, content, order }`) from the Zustand store remains unchanged.

**Tech Stack:** tRPC v11 mutation via `useGenerateOutline()`, Zustand (`useGenerateStore`), shadcn/ui (Card, CardContent, CardHeader, CardTitle, Button, Badge, Textarea, Skeleton), Sonner toast, lucide-react icons

---

## Pre-flight Checks

- [ ] **Step 0a: Verify `generation.generateOutline` procedure exists**

Check `src/lib/trpc/routers/generation.ts` has a `generateOutline` mutation that accepts `{ prompt: string, platforms: string[] }` and returns `{ sections: OutlineSection[] }`. If not, implement it first per Plan 2.

- [ ] **Step 0b: Verify `useGenerateOutline` hook exists**

Check `src/hooks/use-generations.ts` exports `useGenerateOutline()` returning a TanStack `useMutation` result. If not, add it:

```typescript
export function useGenerateOutline() {
  const trpc = useTRPC();
  return useMutation(trpc.generation.generateOutline.mutationOptions());
}
```

- [ ] **Step 0c: Verify Zustand store types**

`src/stores/use-generate-store.ts` already exports:
- `Platform` type: `"instagram" | "linkedin" | "reddit" | "x" | "blog" | "email"`
- `OutlineSection` interface: `{ id: string, platform: Platform, label: string, content: string, order: number }`
- Store has: `outline: OutlineSection[] | null`, `setOutline()`, `updateOutlineSection()`

---

## Task 1: Rewrite step-outline.tsx

- [ ] **Step 1: Replace `src/components/generate/step-outline.tsx`**

This is a full file rewrite. Replace the entire 218-line file with the following:

```typescript
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
            setOutline(data.sections);
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
          const newSections = [...otherSections, ...data.sections].sort(
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
          setOutline(data.sections);
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
          setOutline(data.sections);
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
```

**Key changes from original (218 lines):**

1. **Removed** `generateMockOutline()` and `getMockSections()` functions (lines 26-91 in original) -- no more hardcoded templates
2. **Added** `import { useGenerateOutline } from "@/hooks/use-generations"` and `import { Skeleton } from "@/components/ui/skeleton"`
3. **Added** `content` to the destructured store values (need the prompt for the API call)
4. **Added** `useGenerateOutline()` mutation hook
5. **Added** `hasTriggeredRef` to prevent double-firing in React strict mode
6. **Replaced** the `useEffect` that called `generateMockOutline()` with one that calls `generateOutline.mutate()` and stores result via `setOutline(data.sections)`
7. **Added** three distinct rendering states:
   - **Loading**: skeleton cards per platform (3-4 per platform depending on type)
   - **Error**: error message with retry button
   - **Success**: existing section editing UI (preserved from original)
8. **Replaced** the toast-based "Regenerate" handler with `handleRegeneratePlatform()` that calls the mutation for a single platform and merges the result into existing outline
9. **Added** "Regenerate All" button in the header that replaces the entire outline
10. **Added** per-platform skeleton state while individual platforms are being regenerated (tracked via `regeneratingPlatform`)
11. **Added** `onBlur` to the editing textarea so it auto-closes on blur
12. **Added** `disabled` guard on Continue button when outline is empty

- [ ] **Step 2: Verify build**
```bash
bunx tsc --noEmit
```

- [ ] **Step 3: Commit**
```bash
git add src/components/generate/step-outline.tsx
git commit -m "feat: replace mock outline generation with real Gemini AI in Step 3"
```

---

## Task 2: Smoke Test Checklist

- [ ] Navigate to generate flow, select platforms in Step 1, enter prompt in Step 2, advance to Step 3
- [ ] On entering Step 3: skeleton loading state shows immediately with platform headers
- [ ] After API returns: sections appear grouped by platform with labels and content
- [ ] Click a section's pencil icon -- textarea appears for editing
- [ ] Edit content, click check icon or blur -- content is saved
- [ ] Click anywhere on the text -- enters edit mode
- [ ] Click "Regenerate" on a single platform -- that platform shows skeleton, others remain
- [ ] After regeneration: new sections replace old ones for that platform only
- [ ] Click "Regenerate All" -- all platforms show loading, then all replaced
- [ ] If API fails: error state shows with "Try Again" button
- [ ] Click "Try Again" -- re-attempts generation
- [ ] Navigate back to Step 2 and forward again -- outline is preserved (Zustand state)
- [ ] Continue button is disabled when outline has 0 sections

---

## File Manifest

| File | Action | Description |
|------|--------|-------------|
| `src/components/generate/step-outline.tsx` | REPLACE | Full rewrite with AI-powered outline generation |

## Dependencies (must exist before executing)

| File | Provided By |
|------|-------------|
| `src/hooks/use-generations.ts` (exports `useGenerateOutline`) | Plan 2 |
| `src/lib/trpc/routers/generation.ts` (has `generateOutline` mutation) | Plan 2 |
| `src/stores/use-generate-store.ts` (has `outline`, `setOutline`, `updateOutlineSection`, `content`) | Already exists |
