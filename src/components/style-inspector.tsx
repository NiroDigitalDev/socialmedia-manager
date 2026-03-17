"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SparklesIcon,
  Loader2Icon,
  HistoryIcon,
  ChevronRightIcon,
  RotateCcwIcon,
  CheckIcon,
  XIcon,
  PlusIcon,
} from "lucide-react";
import {
  useGenerateStylePreview,
  useGenerateCaptionPreview,
  useSaveStyleWithHistory,
  useStyleHistory,
  useRestoreStyleHistory,
} from "@/hooks/use-styles";
import { toast } from "sonner";

interface StyleInspectorProps {
  style: {
    id: string;
    name: string;
    description?: string | null;
    promptText: string;
    kind?: string;
    isPredefined: boolean;
    sampleImageIds: string[];
    sampleImageUrls?: string[];
    sampleTexts?: string[];
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StyleInspector({ style, open, onOpenChange }: StyleInspectorProps) {
  const generateImagePreview = useGenerateStylePreview();
  const generateCaptionPreview = useGenerateCaptionPreview();
  const saveWithHistory = useSaveStyleWithHistory();
  const restoreHistory = useRestoreStyleHistory();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [dirty, setDirty] = useState(false);

  const [pendingImageUrls, setPendingImageUrls] = useState<string[] | null>(null);
  const [pendingImageIds, setPendingImageIds] = useState<string[] | null>(null);
  const [pendingTexts, setPendingTexts] = useState<string[] | null>(null);

  const kind = style?.kind ?? "image";
  const isImage = kind === "image";

  const { data: history } = useStyleHistory(open ? style?.id : undefined);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (style) {
      setName(style.name);
      setDescription(style.description ?? "");
      setPrompt(style.promptText);
      setDirty(false);
      setPendingImageUrls(null);
      setPendingImageIds(null);
      setPendingTexts(null);
    }
  }, [style]);

  if (!style) return null;

  const isGenerating = generateImagePreview.isPending || generateCaptionPreview.isPending;

  const handleRegenerate = () => {
    if (isImage) {
      toast.info("Generating 4 preview images...");
      generateImagePreview.mutate(
        { promptText: prompt },
        {
          onSuccess: (data) => {
            setPendingImageUrls(data.sampleImageUrls);
            setPendingImageIds(data.sampleImageIds);
            setDirty(true);
          },
        }
      );
    } else {
      toast.info("Generating caption samples...");
      generateCaptionPreview.mutate(
        { promptText: prompt },
        {
          onSuccess: (data) => {
            setPendingTexts(data.sampleTexts);
            setDirty(true);
          },
        }
      );
    }
  };

  const handleSave = () => {
    saveWithHistory.mutate(
      {
        id: style.id,
        promptText: prompt,
        name: name !== style.name ? name : undefined,
        description: description !== (style.description ?? "") ? description : undefined,
        ...(pendingImageIds ? { sampleImageIds: pendingImageIds } : {}),
        ...(pendingTexts ? { sampleTexts: pendingTexts } : {}),
      },
      {
        onSuccess: () => {
          toast.success("Style saved");
          setDirty(false);
          setPendingImageUrls(null);
          setPendingImageIds(null);
          setPendingTexts(null);
          onOpenChange(false);
        },
      }
    );
  };

  const handleDiscard = () => {
    setName(style.name);
    setDescription(style.description ?? "");
    setPrompt(style.promptText);
    setPendingImageUrls(null);
    setPendingImageIds(null);
    setPendingTexts(null);
    setDirty(false);
  };

  const handleRestore = (historyId: string) => {
    restoreHistory.mutate(
      { historyId },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  const displayImageUrls = pendingImageUrls ?? style.sampleImageUrls ?? [];
  const displayTexts = pendingTexts ?? style.sampleTexts ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] !max-w-[90vw] h-[90vh] max-h-[90vh] overflow-hidden p-0">
        <div className="grid grid-cols-1 md:grid-cols-2 h-[90vh]">
          {/* Left column — Preview */}
          <div className="flex flex-col bg-muted/30 p-6 overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">Preview</h3>
              <Badge variant="outline" className="text-[10px]">
                {isImage ? "Image" : "Caption"}
              </Badge>
            </div>

            {isImage ? (
              <div className="grid grid-cols-2 gap-2 flex-1">
                {[0, 1, 2, 3].map((idx) => {
                  const url = displayImageUrls[idx];
                  return url ? (
                    <img
                      key={idx}
                      src={url}
                      alt=""
                      className="aspect-square w-full rounded-lg object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      key={idx}
                      className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-muted-foreground/20 bg-muted/50"
                    >
                      <PlusIcon className="size-4 text-muted-foreground/30" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3 flex-1">
                {displayTexts.map((text, i) => (
                  <div
                    key={i}
                    className="rounded-lg border bg-background/60 p-4 text-sm italic text-foreground/80"
                  >
                    &ldquo;{text}&rdquo;
                  </div>
                ))}
                {displayTexts.length === 0 && (
                  <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                    No samples yet
                  </div>
                )}
              </div>
            )}

            {isGenerating && (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-3.5 animate-spin" />
                Generating...
              </div>
            )}
          </div>

          {/* Right column — Editor */}
          <div className="flex flex-col p-6 overflow-y-auto">
            <DialogHeader className="mb-6">
              <DialogTitle>Style Inspector</DialogTitle>
              <DialogDescription>
                Edit the style prompt and regenerate previews.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 space-y-5">
              {/* Name */}
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => { setName(e.target.value); setDirty(true); }}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); setDirty(true); }}
                />
              </div>

              {/* Prompt */}
              <div className="space-y-2">
                <Label>Style Prompt</Label>
                <Textarea
                  value={prompt}
                  onChange={(e) => { setPrompt(e.target.value); setDirty(true); }}
                  rows={6}
                  className="resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleRegenerate}
                  disabled={isGenerating || !prompt.trim()}
                  className="gap-1.5"
                >
                  {isGenerating ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <SparklesIcon className="size-3.5" />
                  )}
                  Regenerate
                </Button>
                {dirty && (
                  <>
                    <Button
                      onClick={handleSave}
                      disabled={saveWithHistory.isPending}
                      className="flex-1 gap-1.5"
                    >
                      {saveWithHistory.isPending ? (
                        <Loader2Icon className="size-3.5 animate-spin" />
                      ) : (
                        <CheckIcon className="size-3.5" />
                      )}
                      Save
                    </Button>
                    <Button variant="ghost" onClick={handleDiscard}>
                      <XIcon className="size-3.5" />
                    </Button>
                  </>
                )}
              </div>

              {/* History */}
              {history && history.length > 0 && (
                <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
                  <CollapsibleTrigger className="flex w-full items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                    <HistoryIcon className="size-3.5" />
                    History ({history.length})
                    <ChevronRightIcon className="ml-auto size-3.5 transition-transform data-[state=open]:rotate-90" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3 space-y-2">
                    {history.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start justify-between gap-2 rounded-lg border p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">
                            {new Date(entry.createdAt).toLocaleString()}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm">{entry.promptText}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRestore(entry.id)}
                          disabled={restoreHistory.isPending}
                          className="shrink-0 gap-1"
                        >
                          <RotateCcwIcon className="size-3" />
                          Restore
                        </Button>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
