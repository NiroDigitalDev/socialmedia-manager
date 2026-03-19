"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRun, useRunConcepts, useRerun } from "@/hooks/use-lab";
import { useStyles } from "@/hooks/use-styles";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────

interface SettingsSnapshot {
  contentPrompt: string | null;
  contentIdeaId: string | null;
  contentSourceId: string | null;
  assetIds: string[];
  imageStyleId: string | null;
  captionStyleId: string | null;
  model: "nano-banana-2" | "nano-banana-pro";
  aspectRatio: "3:4" | "1:1" | "4:5" | "9:16";
  colorOverride: { accent: string; bg: string } | null;
  conceptCount: number;
  imageVariations: number;
  captionVariations: number;
}

interface PipelineTweakerProps {
  open: boolean;
  onClose: () => void;
  variationId: string;
  variationType: "image" | "caption";
  runId: string;
  experimentId: string;
}

type Scope = "single" | "batch" | "full";

// ── Helpers ──────────────────────────────────────────────────────

function isDiff(current: unknown, original: unknown): boolean {
  return JSON.stringify(current) !== JSON.stringify(original);
}

// ── Component ────────────────────────────────────────────────────

export function PipelineTweaker({
  open,
  onClose,
  variationId,
  variationType,
  runId,
  experimentId,
}: PipelineTweakerProps) {
  const { data: runRaw } = useRun(runId);
  const { data: conceptListData } = useRunConcepts(runId, undefined);
  const { data: styles } = useStyles();
  const rerun = useRerun();

  // Cast run to any early to avoid excessively deep type instantiation from tRPC
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const run = runRaw as any;

  // Find concept that owns this variation
  const conceptList = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = conceptListData as any;
    if (raw?.type === "list") {
      return raw.concepts as { id: string; conceptNumber: number }[];
    }
    return [] as { id: string; conceptNumber: number }[];
  }, [conceptListData]);

  // We need to find which concept owns our variation
  const runConcepts = run?.concepts as { id: string; imageVariations: { id: string }[]; captionVariations: { id: string }[] }[] | undefined;
  const ownerConceptId = useMemo(() => {
    if (!runConcepts) return undefined;
    for (const concept of runConcepts) {
      if (variationType === "image") {
        if (concept.imageVariations.some((v) => v.id === variationId)) {
          return concept.id;
        }
      } else {
        if (concept.captionVariations.some((v) => v.id === variationId)) {
          return concept.id;
        }
      }
    }
    return undefined;
  }, [runConcepts, variationId, variationType]);

  // Fetch the owner concept with full data
  const { data: ownerConceptData } = useRunConcepts(runId, ownerConceptId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ownerConceptRaw = ownerConceptData as any;
  const ownerConcept = ownerConceptRaw?.type === "single" ? ownerConceptRaw.concept : null;

  // Parse settings snapshot from run
  const originalSettings: SettingsSnapshot | null = useMemo(() => {
    if (!run?.settingsSnapshot) return null;
    return run.settingsSnapshot as SettingsSnapshot;
  }, [run?.settingsSnapshot]);

  // ── Form state ─────────────────────────────────────────────────

  const [outline, setOutline] = useState("");
  const [prompt, setPrompt] = useState("");
  const [imageStyleId, setImageStyleId] = useState<string | null>(null);
  const [captionStyleId, setCaptionStyleId] = useState<string | null>(null);
  const [model, setModel] = useState<"nano-banana-2" | "nano-banana-pro">("nano-banana-2");
  const [aspectRatio, setAspectRatio] = useState<"3:4" | "1:1" | "4:5" | "9:16">("1:1");
  const [colorEnabled, setColorEnabled] = useState(false);
  const [accentColor, setAccentColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [variationCount, setVariationCount] = useState(1);
  const [scope, setScope] = useState<Scope>("single");

  // Initialize form from fetched data
  const initializeForm = useCallback(() => {
    if (!originalSettings || !ownerConcept) return;

    // Outline text from concept
    const outlineData = ownerConcept.outline;
    if (outlineData && typeof outlineData === "object") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const outlineObj = outlineData as any;
      setOutline(outlineObj.caption ?? JSON.stringify(outlineData, null, 2));
    }

    // Set prompt based on variation type
    if (variationType === "image") {
      const imageVar = ownerConcept.imageVariations?.find(
        (v: { id: string }) => v.id === variationId
      );
      setPrompt(imageVar?.imagePrompt ?? ownerConcept.imagePrompt ?? "");
    } else {
      const captionVar = ownerConcept.captionVariations?.find(
        (v: { id: string }) => v.id === variationId
      );
      setPrompt(captionVar?.captionPrompt ?? ownerConcept.captionPrompt ?? "");
    }

    // Settings
    setImageStyleId(originalSettings.imageStyleId);
    setCaptionStyleId(originalSettings.captionStyleId);
    setModel(originalSettings.model);
    setAspectRatio(originalSettings.aspectRatio);

    if (originalSettings.colorOverride) {
      setColorEnabled(true);
      setAccentColor(originalSettings.colorOverride.accent);
      setBgColor(originalSettings.colorOverride.bg);
    } else {
      setColorEnabled(false);
      setAccentColor("#000000");
      setBgColor("#ffffff");
    }

    setVariationCount(
      variationType === "image"
        ? originalSettings.imageVariations
        : originalSettings.captionVariations
    );

    setScope("single");
  }, [originalSettings, ownerConcept, variationId, variationType]);

  useEffect(() => {
    if (open) {
      initializeForm();
    }
  }, [open, initializeForm]);

  // ── Derived state ──────────────────────────────────────────────

  const imageStyles = useMemo(
    () => (styles ?? []).filter((s: { kind?: string }) => s.kind !== "caption"),
    [styles]
  );
  const captionStyles = useMemo(
    () => (styles ?? []).filter((s: { kind?: string }) => s.kind === "caption"),
    [styles]
  );

  const styleId = variationType === "image" ? imageStyleId : captionStyleId;
  const setStyleId = variationType === "image" ? setImageStyleId : setCaptionStyleId;
  const filteredStyles = variationType === "image" ? imageStyles : captionStyles;

  // Check which fields differ from original for diff highlighting
  const diffs = useMemo(() => {
    if (!originalSettings || !ownerConcept) return {} as Record<string, boolean>;

    const originalOutline = ownerConcept.outline;
    const originalOutlineText =
      originalOutline && typeof originalOutline === "object"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? ((originalOutline as any).caption ?? JSON.stringify(originalOutline, null, 2))
        : "";

    let originalPrompt = "";
    if (variationType === "image") {
      const imgVar = ownerConcept.imageVariations?.find(
        (v: { id: string }) => v.id === variationId
      );
      originalPrompt = imgVar?.imagePrompt ?? ownerConcept.imagePrompt ?? "";
    } else {
      const capVar = ownerConcept.captionVariations?.find(
        (v: { id: string }) => v.id === variationId
      );
      originalPrompt = capVar?.captionPrompt ?? ownerConcept.captionPrompt ?? "";
    }

    const originalStyleId =
      variationType === "image"
        ? originalSettings.imageStyleId
        : originalSettings.captionStyleId;

    const originalVarCount =
      variationType === "image"
        ? originalSettings.imageVariations
        : originalSettings.captionVariations;

    const currentColorOverride = colorEnabled
      ? { accent: accentColor, bg: bgColor }
      : null;

    return {
      outline: isDiff(outline, originalOutlineText),
      prompt: isDiff(prompt, originalPrompt),
      style: isDiff(styleId, originalStyleId),
      model: isDiff(model, originalSettings.model),
      aspectRatio: isDiff(aspectRatio, originalSettings.aspectRatio),
      colorOverride: isDiff(currentColorOverride, originalSettings.colorOverride),
      variationCount: isDiff(variationCount, originalVarCount),
    };
  }, [
    originalSettings,
    ownerConcept,
    variationId,
    variationType,
    outline,
    prompt,
    styleId,
    model,
    aspectRatio,
    colorEnabled,
    accentColor,
    bgColor,
    variationCount,
  ]);

  // ── Handlers ───────────────────────────────────────────────────

  const handleRegenerate = () => {
    if (!originalSettings) return;

    const tweaks: Partial<SettingsSnapshot> = {};

    if (diffs.model) tweaks.model = model;
    if (diffs.aspectRatio) tweaks.aspectRatio = aspectRatio;
    if (diffs.colorOverride) {
      tweaks.colorOverride = colorEnabled
        ? { accent: accentColor, bg: bgColor }
        : null;
    }
    if (diffs.style) {
      if (variationType === "image") {
        tweaks.imageStyleId = imageStyleId;
      } else {
        tweaks.captionStyleId = captionStyleId;
      }
    }
    if (diffs.variationCount) {
      if (variationType === "image") {
        tweaks.imageVariations = variationCount;
      } else {
        tweaks.captionVariations = variationCount;
      }
    }

    rerun.mutate(
      {
        sourceRunId: runId,
        scope,
        tweaks,
        sourceVariationId: variationId,
        sourceVariationType: variationType,
      },
      {
        onSuccess: (data) => {
          toast.success(`Re-run started (Run #${data.runNumber})`);
          onClose();
        },
      }
    );
  };

  const isLoading = !run || !originalSettings || !ownerConcept;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle>Pipeline Tweaker</SheetTitle>
          <SheetDescription>
            Edit parameters and re-generate{" "}
            {variationType === "image" ? "image" : "caption"} variations.
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
            {/* Outline text */}
            <FieldGroup label="Outline" changed={diffs.outline}>
              <Textarea
                value={outline}
                onChange={(e) => setOutline(e.target.value)}
                rows={3}
                className="resize-y text-sm"
              />
            </FieldGroup>

            {/* Prompt */}
            <FieldGroup
              label={variationType === "image" ? "Image prompt" : "Caption prompt"}
              changed={diffs.prompt}
            >
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={5}
                className="resize-y text-sm"
              />
            </FieldGroup>

            {/* Style */}
            <FieldGroup
              label={variationType === "image" ? "Image style" : "Caption style"}
              changed={diffs.style}
            >
              <Select
                value={styleId ?? "none"}
                onValueChange={(v) => setStyleId(v === "none" ? null : v)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="No style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No style</SelectItem>
                  {filteredStyles.map((s: { id: string; name: string }) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldGroup>

            {/* Model */}
            <FieldGroup label="Model" changed={diffs.model}>
              <RadioGroup
                value={model}
                onValueChange={(v) =>
                  setModel(v as "nano-banana-2" | "nano-banana-pro")
                }
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="nano-banana-2" id="model-flash" />
                  <Label htmlFor="model-flash" className="text-sm font-normal">
                    Flash
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="nano-banana-pro" id="model-pro" />
                  <Label htmlFor="model-pro" className="text-sm font-normal">
                    Pro
                  </Label>
                </div>
              </RadioGroup>
            </FieldGroup>

            {/* Aspect ratio */}
            <FieldGroup label="Aspect ratio" changed={diffs.aspectRatio}>
              <RadioGroup
                value={aspectRatio}
                onValueChange={(v) =>
                  setAspectRatio(v as "3:4" | "1:1" | "4:5" | "9:16")
                }
                className="flex flex-wrap gap-4"
              >
                {(["3:4", "1:1", "4:5", "9:16"] as const).map((ratio) => (
                  <div key={ratio} className="flex items-center gap-2">
                    <RadioGroupItem
                      value={ratio}
                      id={`ratio-${ratio}`}
                    />
                    <Label
                      htmlFor={`ratio-${ratio}`}
                      className="text-sm font-normal"
                    >
                      {ratio}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </FieldGroup>

            {/* Color override */}
            <FieldGroup label="Color override" changed={diffs.colorOverride}>
              <div className="flex items-center gap-3">
                <Switch
                  size="sm"
                  checked={colorEnabled}
                  onCheckedChange={setColorEnabled}
                />
                <span className="text-xs text-muted-foreground">
                  {colorEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              {colorEnabled && (
                <div className="mt-2 flex gap-4">
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">
                      Accent
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="h-8 w-8 cursor-pointer rounded border"
                      />
                      <Input
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="h-8 w-24 text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">
                      Background
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        className="h-8 w-8 cursor-pointer rounded border"
                      />
                      <Input
                        value={bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        className="h-8 w-24 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </FieldGroup>

            {/* Variation count */}
            <FieldGroup label="Variation count" changed={diffs.variationCount}>
              <Input
                type="number"
                min={1}
                max={20}
                value={variationCount}
                onChange={(e) =>
                  setVariationCount(
                    Math.max(1, Math.min(20, Number(e.target.value) || 1))
                  )
                }
                className="h-9 w-24 text-sm"
              />
            </FieldGroup>

            {/* Scope control */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Scope</Label>
              <RadioGroup
                value={scope}
                onValueChange={(v) => setScope(v as Scope)}
                className="gap-3"
              >
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="single" id="scope-single" className="mt-0.5" />
                  <div>
                    <Label htmlFor="scope-single" className="text-sm font-normal">
                      Just this one
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Re-generate only the selected variation.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="batch" id="scope-batch" className="mt-0.5" />
                  <div>
                    <Label htmlFor="scope-batch" className="text-sm font-normal">
                      New batch
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Create a new batch of variations for this concept.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="full" id="scope-full" className="mt-0.5" />
                  <div>
                    <Label htmlFor="scope-full" className="text-sm font-normal">
                      Full re-run
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Generate new outlines and all variations from scratch.
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </div>
        )}

        <SheetFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleRegenerate}
            disabled={isLoading || rerun.isPending}
          >
            {rerun.isPending && (
              <Loader2Icon className="mr-2 size-4 animate-spin" />
            )}
            Re-generate
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ── FieldGroup sub-component ─────────────────────────────────────

function FieldGroup({
  label,
  changed,
  children,
}: {
  label: string;
  changed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "space-y-2 rounded-md border-l-2 pl-3 transition-colors",
        changed
          ? "border-l-amber-400 bg-amber-50/50 dark:bg-amber-950/20"
          : "border-l-transparent"
      )}
    >
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}
