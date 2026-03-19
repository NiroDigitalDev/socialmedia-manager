"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRun, useUpdateRunSettings, useStartGeneration } from "@/hooks/use-lab";
import { useStyles } from "@/hooks/use-styles";
import { useLabStore } from "@/stores/use-lab-store";
import { CostEstimate } from "@/components/lab/cost-estimate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2Icon, SparklesIcon } from "lucide-react";

interface ConfigureTabProps {
  runId: string;
  experimentId: string;
}

const DEFAULT_SETTINGS = {
  contentPrompt: "",
  contentIdeaId: null as string | null,
  contentSourceId: null as string | null,
  assetIds: [] as string[],
  imageStyleId: null as string | null,
  captionStyleId: null as string | null,
  model: "nano-banana-2" as string,
  aspectRatio: "3:4" as string,
  colorOverride: null as { accent: string; bg: string } | null,
  conceptCount: 3,
  imageVariations: 2,
  captionVariations: 2,
};

export function ConfigureTab({ runId, experimentId }: ConfigureTabProps) {
  const { data: run, isLoading: runLoading } = useRun(runId);
  const { data: styles } = useStyles();
  const updateSettings = useUpdateRunSettings();
  const startGeneration = useStartGeneration();
  const setActiveTab = useLabStore((s) => s.setActiveTab);

  // Local form state
  const [prompt, setPrompt] = useState("");
  const [imageStyleId, setImageStyleId] = useState<string>("__none__");
  const [captionStyleId, setCaptionStyleId] = useState<string>("__none__");
  const [conceptCount, setConceptCount] = useState(3);
  const [imageVariations, setImageVariations] = useState(2);
  const [captionVariations, setCaptionVariations] = useState(2);
  const [model, setModel] = useState("nano-banana-2");
  const [aspectRatio, setAspectRatio] = useState("3:4");
  const [colorEnabled, setColorEnabled] = useState(false);
  const [accentColor, setAccentColor] = useState("#6366f1");
  const [bgColor, setBgColor] = useState("#ffffff");

  // Track whether we've initialized from server data
  const initializedRef = useRef(false);

  // Populate form from run settings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settingsSnapshot = (run as any)?.settingsSnapshot as typeof DEFAULT_SETTINGS | undefined;
  useEffect(() => {
    if (!settingsSnapshot || initializedRef.current) return;
    setPrompt(settingsSnapshot.contentPrompt ?? "");
    setImageStyleId(settingsSnapshot.imageStyleId ?? "__none__");
    setCaptionStyleId(settingsSnapshot.captionStyleId ?? "__none__");
    setConceptCount(settingsSnapshot.conceptCount ?? 3);
    setImageVariations(settingsSnapshot.imageVariations ?? 2);
    setCaptionVariations(settingsSnapshot.captionVariations ?? 2);
    setModel(settingsSnapshot.model ?? "nano-banana-2");
    setAspectRatio(settingsSnapshot.aspectRatio ?? "3:4");
    if (settingsSnapshot.colorOverride) {
      setColorEnabled(true);
      setAccentColor(settingsSnapshot.colorOverride.accent);
      setBgColor(settingsSnapshot.colorOverride.bg);
    }
    initializedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsSnapshot]);

  // Reset initialization when runId changes
  useEffect(() => {
    initializedRef.current = false;
  }, [runId]);

  // Build current settings object
  const buildSettings = useCallback(
    () => ({
      contentPrompt: prompt || null,
      contentIdeaId: null,
      contentSourceId: null,
      assetIds: [],
      imageStyleId: imageStyleId === "__none__" ? null : imageStyleId,
      captionStyleId: captionStyleId === "__none__" ? null : captionStyleId,
      model: model as "nano-banana-2" | "nano-banana-pro",
      aspectRatio: aspectRatio as "3:4" | "1:1" | "4:5" | "9:16",
      colorOverride: colorEnabled ? { accent: accentColor, bg: bgColor } : null,
      conceptCount,
      imageVariations,
      captionVariations,
    }),
    [
      prompt,
      imageStyleId,
      captionStyleId,
      model,
      aspectRatio,
      colorEnabled,
      accentColor,
      bgColor,
      conceptCount,
      imageVariations,
      captionVariations,
    ]
  );

  // Save settings on blur (debounced save)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const updateSettingsRef = useRef(updateSettings);
  updateSettingsRef.current = updateSettings;

  const runStatus = run?.status;
  const handleSave = useCallback(() => {
    if (runStatus !== "configuring") return;
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      updateSettingsRef.current.mutate({
        runId,
        settingsSnapshot: buildSettings(),
      });
    }, 500);
  }, [runStatus, runId, buildSettings]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => clearTimeout(saveTimeoutRef.current);
  }, []);

  const handleGenerate = () => {
    // Save settings first, then start generation
    const settings = buildSettings();
    updateSettings.mutate(
      { runId, settingsSnapshot: settings },
      {
        onSuccess: () => {
          startGeneration.mutate(
            { runId },
            {
              onSuccess: () => {
                setActiveTab("results");
              },
            }
          );
        },
      }
    );
  };

  const isConfiguring = run?.status === "configuring";
  const isGenerating = startGeneration.isPending || updateSettings.isPending;

  // Filter styles by kind
  const imageStyles = styles?.filter((s) => s.kind === "image") ?? [];
  const captionStyles = styles?.filter((s) => s.kind === "caption") ?? [];

  if (runLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
        Run not found
      </div>
    );
  }

  if (!isConfiguring) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          This run has already been configured and is{" "}
          <span className="font-medium">{run.status}</span>.
        </p>
        <p className="text-xs text-muted-foreground/60">
          Settings cannot be changed after generation starts.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 overflow-y-auto p-6">
      {/* Content Source */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">Content Source</h3>
          <p className="text-xs text-muted-foreground">
            Describe what you want to create
          </p>
        </div>
        <Textarea
          placeholder="Describe the content you want to generate..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onBlur={handleSave}
          rows={4}
          className="resize-none"
        />
      </section>

      <Separator />

      {/* Style Pickers */}
      <section className="space-y-4">
        <h3 className="text-sm font-medium">Styles</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="image-style">Image Style</Label>
            <Select
              value={imageStyleId}
              onValueChange={(val) => {
                setImageStyleId(val);
                handleSave();
              }}
            >
              <SelectTrigger id="image-style" className="w-full">
                <SelectValue placeholder="Select image style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {imageStyles.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="caption-style">Caption Style</Label>
            <Select
              value={captionStyleId}
              onValueChange={(val) => {
                setCaptionStyleId(val);
                handleSave();
              }}
            >
              <SelectTrigger id="caption-style" className="w-full">
                <SelectValue placeholder="Select caption style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {captionStyles.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <Separator />

      {/* Variation Counts */}
      <section className="space-y-4">
        <h3 className="text-sm font-medium">Variations</h3>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="concept-count">Concepts (N)</Label>
            <Input
              id="concept-count"
              type="number"
              min={1}
              max={20}
              value={conceptCount}
              onChange={(e) =>
                setConceptCount(
                  Math.max(1, Math.min(20, parseInt(e.target.value) || 1))
                )
              }
              onBlur={handleSave}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="image-variations">Images/concept (M)</Label>
            <Input
              id="image-variations"
              type="number"
              min={1}
              max={20}
              value={imageVariations}
              onChange={(e) =>
                setImageVariations(
                  Math.max(1, Math.min(20, parseInt(e.target.value) || 1))
                )
              }
              onBlur={handleSave}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="caption-variations">Captions/concept (K)</Label>
            <Input
              id="caption-variations"
              type="number"
              min={1}
              max={20}
              value={captionVariations}
              onChange={(e) =>
                setCaptionVariations(
                  Math.max(1, Math.min(20, parseInt(e.target.value) || 1))
                )
              }
              onBlur={handleSave}
            />
          </div>
        </div>
      </section>

      <Separator />

      {/* Model */}
      <section className="space-y-3">
        <h3 className="text-sm font-medium">Model</h3>
        <RadioGroup
          value={model}
          onValueChange={(val) => {
            setModel(val);
            handleSave();
          }}
          className="flex gap-4"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="nano-banana-2" id="model-flash" />
            <Label htmlFor="model-flash" className="cursor-pointer text-sm">
              Flash
              <span className="ml-1 text-xs text-muted-foreground">
                (faster, cheaper)
              </span>
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="nano-banana-pro" id="model-pro" />
            <Label htmlFor="model-pro" className="cursor-pointer text-sm">
              Pro
              <span className="ml-1 text-xs text-muted-foreground">
                (higher quality)
              </span>
            </Label>
          </div>
        </RadioGroup>
      </section>

      <Separator />

      {/* Aspect Ratio */}
      <section className="space-y-3">
        <h3 className="text-sm font-medium">Aspect Ratio</h3>
        <RadioGroup
          value={aspectRatio}
          onValueChange={(val) => {
            setAspectRatio(val);
            handleSave();
          }}
          className="flex gap-4"
        >
          {["3:4", "1:1", "4:5", "9:16"].map((ratio) => (
            <div key={ratio} className="flex items-center gap-2">
              <RadioGroupItem value={ratio} id={`ratio-${ratio}`} />
              <Label
                htmlFor={`ratio-${ratio}`}
                className="cursor-pointer text-sm"
              >
                {ratio}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </section>

      <Separator />

      {/* Color Override */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Color Override</h3>
            <p className="text-xs text-muted-foreground">
              Override brand colors for this run
            </p>
          </div>
          <Switch
            checked={colorEnabled}
            onCheckedChange={(checked) => {
              setColorEnabled(checked);
              handleSave();
            }}
          />
        </div>

        {colorEnabled && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="accent-color">Accent Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="accent-color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  onBlur={handleSave}
                  className="h-8 w-10 cursor-pointer rounded border bg-transparent p-0.5"
                />
                <Input
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  onBlur={handleSave}
                  className="flex-1 font-mono text-xs"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bg-color">Background Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="bg-color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  onBlur={handleSave}
                  className="h-8 w-10 cursor-pointer rounded border bg-transparent p-0.5"
                />
                <Input
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  onBlur={handleSave}
                  className="flex-1 font-mono text-xs"
                />
              </div>
            </div>
          </div>
        )}
      </section>

      <Separator />

      {/* Cost Estimate + Generate */}
      <section className="space-y-3">
        <CostEstimate
          model={model}
          conceptCount={conceptCount}
          imageVariations={imageVariations}
          captionVariations={captionVariations}
        />

        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="w-full gap-1.5"
        >
          {isGenerating ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <SparklesIcon className="size-4" />
          )}
          Generate
        </Button>
      </section>
    </div>
  );
}
