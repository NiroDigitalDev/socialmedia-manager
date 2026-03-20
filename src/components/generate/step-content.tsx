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
  BookmarkIcon,
} from "lucide-react";

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

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
      placeholder="Describe your content. Be as detailed as you like — the AI will use this to generate an outline."
      rows={8}
      className="resize-none"
    />
  );
}

function FromIdeaMode() {
  const { content, setContent, projectId } = useGenerateStore();
  const [search, setSearch] = useState("");
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const { data: ideas, isLoading } = useIdeas({
    projectId: projectId ?? undefined,
    ...(showSavedOnly ? { isSaved: true } : {}),
  });

  const filteredIdeas = ideas?.filter((idea) =>
    search
      ? idea.ideaText.toLowerCase().includes(search.toLowerCase())
      : true
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search ideas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={showSavedOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setShowSavedOnly(!showSavedOnly)}
          className="shrink-0 gap-1.5"
        >
          <BookmarkIcon className="size-3.5" />
          Saved
        </Button>
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
                      format: idea.format === "carousel" ? "carousel" : "static",
                      slideCount: idea.slideCount ?? undefined,
                      slidePrompts: idea.slidePrompts as string[] | undefined,
                      styleGuide: idea.styleGuide ?? undefined,
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
              No ideas found
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              {projectId
                ? "Generate ideas in the Content section first."
                : "Select a project or generate ideas in the Content section."}
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

  const getAssetUrl = (r2Key: string) =>
    `${R2_PUBLIC_URL.replace(/\/$/, "")}/${r2Key}`;

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
              const assetUrl = getAssetUrl(asset.r2Key);
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

      {/* Navigation — no Back button, this is step 1 */}
      <div className="flex gap-2">
        <Button onClick={() => setStep(2)} disabled={!canContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
