"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useCreateArena } from "@/hooks/use-arena";
import { useSources } from "@/hooks/use-content";
import { useStyles } from "@/hooks/use-styles";
import { useBrandIdentities } from "@/hooks/use-brand-identities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SetupViewProps {
  projectId: string;
}

export function SetupView({ projectId }: SetupViewProps) {
  const router = useRouter();
  const createArena = useCreateArena();

  // Data fetching
  const { data: sources, isLoading: sourcesLoading } = useSources(projectId);
  const { data: styles, isLoading: stylesLoading } = useStyles();
  const { data: brandIdentities, isLoading: brandsLoading } =
    useBrandIdentities(projectId);

  // Form state
  const [name, setName] = useState("");
  const [sourceId, setSourceId] = useState<string>("");
  const [selectedStyleIds, setSelectedStyleIds] = useState<string[]>([]);
  const [countPerStyle, setCountPerStyle] = useState(10);
  const [aspectRatio, setAspectRatio] = useState<string>("1:1");
  const [model, setModel] = useState<string>("nano-banana-2");
  const [brandIdentityId, setBrandIdentityId] = useState<string>("");

  // Filter styles to image kind only
  const imageStyles = useMemo(
    () => (styles ?? []).filter((s: { kind: string }) => s.kind === "image"),
    [styles],
  );

  // Get selected source text
  const selectedSource = useMemo(
    () => (sources ?? []).find((s: { id: string }) => s.id === sourceId),
    [sources, sourceId],
  );

  const toggleStyle = (styleId: string) => {
    setSelectedStyleIds((prev) =>
      prev.includes(styleId)
        ? prev.filter((id) => id !== styleId)
        : [...prev, styleId],
    );
  };

  const canSubmit =
    name.trim().length > 0 &&
    selectedSource &&
    selectedStyleIds.length > 0 &&
    countPerStyle >= 1 &&
    countPerStyle <= 50;

  const handleSubmit = () => {
    if (!canSubmit || !selectedSource) return;

    const sourceText = (selectedSource as { rawText?: string }).rawText ?? "";
    if (!sourceText) {
      toast.error("Selected source has no content");
      return;
    }

    createArena.mutate(
      {
        name: name.trim(),
        projectId,
        sourceText,
        imageStyleIds: selectedStyleIds,
        countPerStyle,
        aspectRatio: aspectRatio as "1:1" | "3:4" | "4:5" | "9:16",
        model: model as "nano-banana-2" | "nano-banana-pro",
        ...(brandIdentityId && brandIdentityId !== "none" ? { brandIdentityId } : {}),
      },
      {
        onSuccess: (data) => {
          toast.success("Arena created! Generating images...");
          router.push(
            `/dashboard/projects/${projectId}/lab/arena/${data.arenaId}`,
          );
        },
      },
    );
  };

  const isDataLoading = sourcesLoading || stylesLoading || brandsLoading;

  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Arena</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Arena Name */}
          <div className="space-y-2">
            <Label htmlFor="arena-name">Arena Name</Label>
            <Input
              id="arena-name"
              placeholder="e.g. Spring Campaign Style Test"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Source Picker */}
          <div className="space-y-2">
            <Label htmlFor="source">Content Source</Label>
            {sourcesLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger id="source">
                  <SelectValue placeholder="Select a source..." />
                </SelectTrigger>
                <SelectContent>
                  {(sources ?? []).map(
                    (source: { id: string; title: string }) => (
                      <SelectItem key={source.id} value={source.id}>
                        {source.title}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Image Style Multi-Select */}
          <div className="space-y-2">
            <Label>
              Image Styles
              {selectedStyleIds.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedStyleIds.length} selected
                </Badge>
              )}
            </Label>
            {stylesLoading ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : imageStyles.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No image styles found. Create styles first.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {imageStyles.map(
                  (style: { id: string; name: string }) => {
                    const isSelected = selectedStyleIds.includes(style.id);
                    return (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => toggleStyle(style.id)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-muted-foreground/30",
                        )}
                      >
                        <Checkbox
                          checked={isSelected}
                          tabIndex={-1}
                          className="pointer-events-none"
                        />
                        <span className="truncate">{style.name}</span>
                      </button>
                    );
                  },
                )}
              </div>
            )}
          </div>

          {/* Count per Style */}
          <div className="space-y-2">
            <Label htmlFor="count-per-style">Images per Style</Label>
            <Input
              id="count-per-style"
              type="number"
              min={1}
              max={50}
              value={countPerStyle}
              onChange={(e) =>
                setCountPerStyle(
                  Math.max(1, Math.min(50, parseInt(e.target.value) || 1)),
                )
              }
            />
            <p className="text-xs text-muted-foreground">
              Total images:{" "}
              {selectedStyleIds.length * countPerStyle || 0}
            </p>
          </div>

          {/* Aspect Ratio */}
          <div className="space-y-2">
            <Label htmlFor="aspect-ratio">Aspect Ratio</Label>
            <Select value={aspectRatio} onValueChange={setAspectRatio}>
              <SelectTrigger id="aspect-ratio">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1:1">1:1 (Square)</SelectItem>
                <SelectItem value="3:4">3:4 (Portrait)</SelectItem>
                <SelectItem value="4:5">4:5 (Instagram)</SelectItem>
                <SelectItem value="9:16">9:16 (Story)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Model */}
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger id="model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nano-banana-2">
                  nano-banana-2 (Flash)
                </SelectItem>
                <SelectItem value="nano-banana-pro">
                  nano-banana-pro (Pro)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Brand Identity (optional) */}
          <div className="space-y-2">
            <Label htmlFor="brand-identity">Brand Identity (optional)</Label>
            {brandsLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select
                value={brandIdentityId}
                onValueChange={setBrandIdentityId}
              >
                <SelectTrigger id="brand-identity">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(brandIdentities ?? []).map(
                    (brand: { id: string; name: string }) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Submit */}
          <Button
            className="w-full"
            size="lg"
            disabled={!canSubmit || createArena.isPending || isDataLoading}
            onClick={handleSubmit}
          >
            {createArena.isPending ? (
              <>
                <Loader2Icon className="mr-2 size-4 animate-spin" />
                Creating Arena...
              </>
            ) : (
              "Start Arena"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
