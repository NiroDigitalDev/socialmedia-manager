# Content Input Modes (Step 2) Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Enable all 5 content input modes in the generate flow Step 2: Write, From Idea, From Source, Upload, and From Assets.

**Depends on:** Plan 3 (content-ideas-data-layer -- ideas, sources, and assets must be queryable via tRPC)

**Architecture:** The `StepContent` component is a full rewrite of `src/components/generate/step-content.tsx`. It uses a tabbed mode selector to switch between 5 input modes, each with its own UI. State flows into the Zustand `useGenerateStore` via `setContent()`. Modes can be combined -- switching between them preserves previous selections. A summary bar at the bottom shows the combined selection state. All data is fetched via existing hooks (`useIdeas`, `useSources`, `useAssets`).

**Tech Stack:** Next.js 16, tRPC v11, TanStack Query, Zustand (`useGenerateStore`), shadcn/ui (Button, Textarea, Input, Card, Badge, Skeleton, ScrollArea), Lucide icons, `cn()` utility, existing hooks (`useIdeas` from `src/hooks/use-content.ts`, `useSources` from `src/hooks/use-content.ts`, `useAssets` from `src/hooks/use-assets.ts`)

---

## Existing Code Context

**Current file:** `src/components/generate/step-content.tsx` -- has 5 mode buttons but only "Write" (prompt) is `ready: true`. The other 4 modes are disabled stubs.

**Zustand store** (`src/stores/use-generate-store.ts`):
```typescript
export interface ContentInput {
  prompt: string;
  contentIdeaId?: string;
  contentSourceId?: string;
  assetIds?: string[];
}
// setContent merges: setContent: (content) => set((state) => ({ content: { ...state.content, ...content } }))
```

**Available hooks:**
- `useIdeas(filters?)` from `src/hooks/use-content.ts` -- accepts `{ projectId?, sourceId?, contentType?, isSaved?, campaignId? }`
- `useSources(projectId?)` from `src/hooks/use-content.ts`
- `useAssets(opts?)` from `src/hooks/use-assets.ts` -- accepts `{ projectId?, category? }`

**Generate store access:** `useGenerateStore()` provides `content`, `setContent`, `projectId`, `setStep`

---

## File to Modify

### `src/components/generate/step-content.tsx`

Complete rewrite. Replace the entire file with:

```typescript
"use client";

import { useState, useCallback, useRef } from "react";
import { useGenerateStore } from "@/stores/use-generate-store";
import { useIdeas, useSources } from "@/hooks/use-content";
import { useAssets } from "@/hooks/use-assets";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  PenLineIcon,
  LightbulbIcon,
  FileUpIcon,
  ImageIcon,
  BookOpenIcon,
  SearchIcon,
  CheckCircleIcon,
  FileTextIcon,
  UploadIcon,
} from "lucide-react";

const modes = [
  { id: "prompt", label: "Write", icon: PenLineIcon },
  { id: "idea", label: "From Idea", icon: LightbulbIcon },
  { id: "source", label: "From Source", icon: BookOpenIcon },
  { id: "upload", label: "Upload", icon: FileUpIcon },
  { id: "asset", label: "From Assets", icon: ImageIcon },
] as const;

type Mode = (typeof modes)[number]["id"];

// ---------- Sub-components for each mode ----------

function WriteMode() {
  const { content, setContent } = useGenerateStore();

  return (
    <Textarea
      value={content.prompt}
      onChange={(e) => setContent({ prompt: e.target.value })}
      placeholder="Describe your content. Be as detailed as you like — the AI will use this to generate an outline for each platform."
      rows={8}
      className="resize-none"
    />
  );
}

function FromIdeaMode() {
  const { content, setContent, projectId } = useGenerateStore();
  const [search, setSearch] = useState("");
  const { data: ideas, isLoading } = useIdeas({
    projectId: projectId ?? undefined,
    isSaved: true,
  });

  const filteredIdeas = ideas?.filter((idea) =>
    search
      ? idea.ideaText.toLowerCase().includes(search.toLowerCase())
      : true
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search saved ideas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <ScrollArea className="h-[320px]">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : filteredIdeas && filteredIdeas.length > 0 ? (
          <div className="space-y-2 pr-3">
            {filteredIdeas.map((idea) => {
              const isSelected = content.contentIdeaId === idea.id;
              return (
                <Card
                  key={idea.id}
                  className={cn(
                    "cursor-pointer transition-all",
                    isSelected
                      ? "ring-2 ring-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  )}
                  onClick={() => {
                    setContent({
                      prompt: idea.ideaText,
                      contentIdeaId: idea.id,
                    });
                  }}
                >
                  <CardContent className="p-3">
                    <p className="line-clamp-3 text-sm">
                      {idea.ideaText}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-xs">
                        {idea.contentType}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {idea.format}
                      </Badge>
                      {isSelected && (
                        <CheckCircleIcon className="ml-auto size-4 text-primary" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <LightbulbIcon className="size-8 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              No saved ideas found
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              {projectId
                ? "Save some ideas in the Content section first."
                : "Select a project or save ideas in the Content section."}
            </p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function FromSourceMode() {
  const { content, setContent, projectId } = useGenerateStore();
  const { data: sources, isLoading } = useSources(projectId ?? undefined);

  return (
    <div className="space-y-3">
      <ScrollArea className="h-[320px]">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : sources && sources.length > 0 ? (
          <div className="space-y-2 pr-3">
            {sources.map((source) => {
              const isSelected = content.contentSourceId === source.id;
              const truncatedText = source.rawText.slice(0, 2000);
              return (
                <Card
                  key={source.id}
                  className={cn(
                    "cursor-pointer transition-all",
                    isSelected
                      ? "ring-2 ring-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  )}
                  onClick={() => {
                    setContent({
                      prompt: truncatedText,
                      contentSourceId: source.id,
                    });
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">{source.title}</h4>
                      {isSelected && (
                        <CheckCircleIcon className="size-4 text-primary" />
                      )}
                    </div>
                    <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                      {source.rawText}
                    </p>
                    <Badge variant="secondary" className="mt-2 text-xs">
                      {source._count.ideas} idea{source._count.ideas !== 1 ? "s" : ""}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpenIcon className="size-8 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              No content sources found
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Add sources in the Content section to use them here.
            </p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function UploadMode() {
  const { setContent } = useGenerateStore();
  const [text, setText] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileRead = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setText(content);
        setContent({ prompt: content });
      };
      reader.readAsText(file);
    },
    [setContent]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileRead(file);
    },
    [handleFileRead]
  );

  const handleTextChange = (value: string) => {
    setText(value);
    setContent({ prompt: value });
  };

  return (
    <div className="space-y-4">
      {/* File drop zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileRead(file);
          }}
        />
        <UploadIcon className="size-6 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Drop a .txt or .md file here</p>
          <p className="text-xs text-muted-foreground">or click to browse</p>
        </div>
      </div>

      {/* Or paste text */}
      <div className="relative">
        <div className="absolute inset-x-0 top-0 flex items-center justify-center">
          <span className="bg-background px-2 text-xs text-muted-foreground">
            or paste text directly
          </span>
        </div>
        <Textarea
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Paste your content here..."
          rows={6}
          className="mt-3 resize-none"
        />
      </div>
    </div>
  );
}

function FromAssetsMode() {
  const { content, setContent, projectId } = useGenerateStore();
  const { data: assets, isLoading } = useAssets({
    projectId: projectId,
    category: "asset" as const,
  });

  const selectedIds = content.assetIds ?? [];

  // Filter to images only
  const imageAssets = assets?.filter((a) => a.mimeType.startsWith("image/"));

  const toggleAsset = (id: string) => {
    const newIds = selectedIds.includes(id)
      ? selectedIds.filter((sid) => sid !== id)
      : [...selectedIds, id];
    setContent({ assetIds: newIds });
  };

  return (
    <div className="space-y-3">
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="default">
            {selectedIds.length} asset{selectedIds.length !== 1 ? "s" : ""} selected
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => setContent({ assetIds: [] })}
          >
            Clear selection
          </Button>
        </div>
      )}

      <ScrollArea className="h-[320px]">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : imageAssets && imageAssets.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 pr-3">
            {imageAssets.map((asset) => {
              const isSelected = selectedIds.includes(asset.id);
              // Assets are stored in R2; use the public URL pattern
              // The asset has an r2Key; images served via the R2 public URL
              const assetUrl = `/api/assets/${asset.id}/preview`;
              return (
                <button
                  key={asset.id}
                  onClick={() => toggleAsset(asset.id)}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-lg border-2 transition-all",
                    isSelected
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-transparent hover:border-muted-foreground/30"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={assetUrl}
                    alt={asset.fileName}
                    className="size-full object-cover"
                    loading="lazy"
                  />
                  {isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                      <CheckCircleIcon className="size-6 text-primary drop-shadow" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ImageIcon className="size-8 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              No image assets found
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Upload images in the Assets section to use them here.
            </p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ---------- Selection summary ----------

function SelectionSummary() {
  const { content } = useGenerateStore();

  const parts: string[] = [];
  if (content.prompt.trim()) parts.push("Prompt set");
  if (content.contentIdeaId) parts.push("1 idea selected");
  if (content.contentSourceId) parts.push("1 source selected");
  if (content.assetIds && content.assetIds.length > 0) {
    parts.push(`${content.assetIds.length} asset${content.assetIds.length !== 1 ? "s" : ""} attached`);
  }

  if (parts.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/30 px-3 py-2">
      <FileTextIcon className="size-3.5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">
        {parts.join(", ")}
      </span>
    </div>
  );
}

// ---------- Main component ----------

export function StepContent() {
  const { content, setStep } = useGenerateStore();
  const [activeMode, setActiveMode] = useState<Mode>("prompt");

  const canContinue = content.prompt.trim().length > 0 || (content.assetIds && content.assetIds.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">What&apos;s your content about?</h2>
        <p className="text-sm text-muted-foreground">
          Describe what you want to create, or pick from existing content.
        </p>
      </div>

      {/* Mode tabs */}
      <div className="flex flex-wrap gap-2">
        {modes.map((m) => (
          <Button
            key={m.id}
            variant={activeMode === m.id ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveMode(m.id)}
            className="gap-1.5"
          >
            <m.icon className="size-3.5" />
            {m.label}
          </Button>
        ))}
      </div>

      {/* Active mode content */}
      {activeMode === "prompt" && <WriteMode />}
      {activeMode === "idea" && <FromIdeaMode />}
      {activeMode === "source" && <FromSourceMode />}
      {activeMode === "upload" && <UploadMode />}
      {activeMode === "asset" && <FromAssetsMode />}

      {/* Combined selection summary */}
      <SelectionSummary />

      {/* Navigation */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep(1)}>
          Back
        </Button>
        <Button onClick={() => setStep(3)} disabled={!canContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
```

---

## Key Design Decisions

1. **Mode switching preserves state.** Switching from "From Idea" to "Write" does not clear the `contentIdeaId`. The `setContent()` call merges partial state, so all selections accumulate. The summary bar shows the combined state.

2. **"From Idea" only shows saved ideas** (`isSaved: true`). This avoids showing raw AI-generated ideas that the user hasn't reviewed.

3. **"From Source" truncates rawText to 2000 chars** when setting the prompt. This prevents excessively long prompts while still giving the AI enough context.

4. **"Upload" supports both paste and file drop.** Accepts `.txt` and `.md` files. Reads via `FileReader.readAsText()`.

5. **"From Assets" uses multi-select.** Clicking toggles selection. The `assetIds` array is stored in the Zustand content state. The "Continue" button is enabled if there is either a prompt OR at least one asset selected.

6. **Asset preview URL.** Assets are stored in R2 with an `r2Key`. The component uses `/api/assets/${asset.id}/preview` as the image URL. If your codebase uses a different URL pattern (e.g., the R2 public bucket URL from `AssetGrid`'s `publicUrlBase`), adjust the `assetUrl` construction accordingly.

---

## Verification Checklist

- [ ] All 5 mode buttons are enabled and clickable
- [ ] "Write" mode: textarea works, typing sets prompt in store
- [ ] "From Idea" mode: shows saved ideas, search filters them, clicking selects and sets prompt + contentIdeaId
- [ ] "From Idea" mode: selected idea has ring highlight and check icon
- [ ] "From Idea" mode: skeleton shows while loading
- [ ] "From Idea" mode: empty state shows when no saved ideas exist
- [ ] "From Source" mode: shows sources with title, preview, idea count
- [ ] "From Source" mode: clicking selects and sets prompt (truncated) + contentSourceId
- [ ] "From Source" mode: skeleton and empty state work correctly
- [ ] "Upload" mode: file drop zone accepts .txt and .md files
- [ ] "Upload" mode: file content populates textarea and sets prompt
- [ ] "Upload" mode: paste into textarea also sets prompt
- [ ] "From Assets" mode: shows image assets in grid
- [ ] "From Assets" mode: clicking toggles selection, selected count badge updates
- [ ] "From Assets" mode: "Clear selection" button resets assetIds
- [ ] Switching modes preserves previous selections (e.g., select an idea, switch to Write, idea is still selected)
- [ ] Summary bar shows combined state ("Prompt set, 1 idea selected, 2 assets attached")
- [ ] Summary bar hidden when nothing is selected
- [ ] "Continue" is disabled when no prompt and no assets selected
- [ ] "Continue" navigates to step 3
- [ ] "Back" navigates to step 1
- [ ] No TypeScript errors
