"use client";

import { useState } from "react";
import { XIcon, FileTextIcon, LightbulbIcon, ListIcon, ImageIcon, MessageSquareIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useUpdateNode } from "@/hooks/use-lab";
import { useLabStore } from "@/stores/use-lab-store";
import { DetailPanelPrompts } from "./detail-panel-prompts";
import { DetailPanelActions } from "./detail-panel-actions";
import { cn } from "@/lib/utils";
import { useStyles } from "@/hooks/use-styles";
import type { LabNode } from "./canvas";

const LAYER_LABELS: Record<string, { label: string; icon: typeof FileTextIcon }> = {
  source: { label: "Source", icon: FileTextIcon },
  idea: { label: "Idea", icon: LightbulbIcon },
  outline: { label: "Outline", icon: ListIcon },
  image: { label: "Image", icon: ImageIcon },
  caption: { label: "Caption", icon: MessageSquareIcon },
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  generating: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

interface DetailPanelProps {
  node: LabNode;
  treeId: string;
  allNodes: LabNode[];
  projectId?: string;
}

export function DetailPanel({ node, treeId, allNodes, projectId }: DetailPanelProps) {
  const selectNode = useLabStore((s) => s.selectNode);
  const updateNode = useUpdateNode();

  const layerInfo = LAYER_LABELS[node.layer] ?? { label: node.layer, icon: FileTextIcon };
  const LayerIcon = layerInfo.icon;

  const handleSavePrompts = (systemPrompt: string, contentPrompt: string) => {
    updateNode.mutate(
      {
        nodeId: node.id,
        systemPrompt: systemPrompt || null,
        contentPrompt: contentPrompt || null,
      },
      {
        onSuccess: () => {
          toast.success("Prompts updated");
        },
      }
    );
  };

  return (
    <div className="relative h-full">
      {/* Absolutely positioned inner container gives us a real pixel height */}
      <div className="absolute inset-0 flex flex-col">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <LayerIcon className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{layerInfo.label}</span>
            <Badge
              variant="secondary"
              className={cn("text-[10px] px-1.5 py-0", STATUS_COLORS[node.status])}
            >
              {node.status}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => selectNode(null)}
          >
            <XIcon className="size-4" />
          </Button>
        </div>

        {/* Scrollable content — explicit h so Radix viewport scrolls */}
        <ScrollArea className="h-[calc(100%-3rem)]">
          <div className="space-y-4 p-4">
            {/* Output display */}
            <OutputDisplay node={node} />

            {/* Styles — show on outline nodes */}
            {node.layer === "outline" && (node.imageStyleId || node.captionStyleId) && (
              <>
                <Separator />
                <StylesDisplay imageStyleId={node.imageStyleId} captionStyleId={node.captionStyleId} />
              </>
            )}

            {/* Prompts — skip for source nodes (no AI generation) */}
            {node.layer !== "source" && (
              <>
                <Separator />
                <DetailPanelPrompts
                  nodeId={node.id}
                  systemPrompt={node.systemPrompt}
                  contentPrompt={node.contentPrompt}
                  onSave={handleSavePrompts}
                />
              </>
            )}

            <Separator />

            {/* Actions */}
            <DetailPanelActions node={node} treeId={treeId} allNodes={allNodes} projectId={projectId} />
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// ── Output display by layer ──────────────────────────────────────

function OutputDisplay({ node }: { node: LabNode }) {
  if (node.status === "pending") {
    return (
      <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
        Pending generation...
      </div>
    );
  }

  if (node.status === "generating") {
    return (
      <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground animate-pulse">
        Generating...
      </div>
    );
  }

  if (node.status === "failed") {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
        Generation failed. You can try again from the actions below.
      </div>
    );
  }

  switch (node.layer) {
    case "source":
      return <SourceOutput output={node.output} fileName={node.fileName} />;
    case "idea":
      return <IdeaOutput output={node.output} />;
    case "outline":
      return <OutlineOutput output={node.output} />;
    case "image":
      return <ImageOutput r2Key={node.r2Key} />;
    case "caption":
      return <CaptionOutput output={node.output} />;
    default:
      return (
        <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
          {JSON.stringify(node.output, null, 2)}
        </pre>
      );
  }
}

const SOURCE_TRUNCATE_LENGTH = 500;

function SourceOutput({ output, fileName }: { output: unknown; fileName: string | null }) {
  const text = getOutputText(output);
  const [expanded, setExpanded] = useState(false);
  const isTruncated = text.length > SOURCE_TRUNCATE_LENGTH;
  const displayText = isTruncated && !expanded ? text.slice(0, SOURCE_TRUNCATE_LENGTH) + "..." : text;

  return (
    <div className="space-y-2">
      {fileName && (
        <p className="text-xs font-medium text-muted-foreground">
          {fileName}
        </p>
      )}
      <div className="relative">
        <div className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm leading-relaxed">
          {displayText || "No content"}
        </div>
        {isTruncated && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 h-7 w-full text-xs text-muted-foreground"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUpIcon className="mr-1 size-3" />
                Show less
              </>
            ) : (
              <>
                <ChevronDownIcon className="mr-1 size-3" />
                Show all ({text.length.toLocaleString()} chars)
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function IdeaOutput({ output }: { output: unknown }) {
  const text = getOutputText(output);
  return (
    <div className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm leading-relaxed">
      {text || "No idea content"}
    </div>
  );
}

function OutlineOutput({ output }: { output: unknown }) {
  const data = output as Record<string, unknown> | null;

  // Outline with structured slides data
  if (data && typeof data === "object" && "slides" in data && Array.isArray(data.slides)) {
    const slides = data.slides as Array<{ title?: string; description?: string }>;
    const theme = "overallTheme" in data ? String(data.overallTheme ?? "") : "";

    return (
      <div className="space-y-3">
        {theme && (
          <p className="text-sm font-semibold">{theme}</p>
        )}
        {slides.map((slide, i) => (
          <div key={i} className="rounded-md border p-3">
            {slide.title && (
              <p className="text-xs font-semibold">{slide.title}</p>
            )}
            {slide.description && (
              <p className={cn("text-xs text-muted-foreground", slide.title && "mt-1")}>
                {slide.description}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Fallback: render as text
  const text = getOutputText(output);
  return (
    <div className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm leading-relaxed">
      {text || "No outline content"}
    </div>
  );
}

function ImageOutput({ r2Key }: { r2Key: string | null }) {
  if (!r2Key) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-md border border-dashed bg-muted/50">
        <ImageIcon className="size-8 text-muted-foreground/50" />
      </div>
    );
  }

  const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!publicUrl) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-md border border-dashed bg-muted/50">
        <p className="text-xs text-muted-foreground">Image preview unavailable (R2 URL not configured)</p>
      </div>
    );
  }
  const src = `${publicUrl}/${r2Key}`;

  return (
    <div className="overflow-hidden rounded-md border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Generated image"
        className="h-auto w-full object-contain"
        loading="lazy"
      />
    </div>
  );
}

function CaptionOutput({ output }: { output: unknown }) {
  const text = getOutputText(output);
  return (
    <div className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm leading-relaxed">
      {text || "No caption content"}
    </div>
  );
}

// ── Styles Display ───────────────────────────────────────────────

function StylesDisplay({ imageStyleId, captionStyleId }: { imageStyleId: string | null; captionStyleId: string | null }) {
  const { data: styles } = useStyles();
  const imageStyle = imageStyleId ? styles?.find((s) => s.id === imageStyleId) : null;
  const captionStyle = captionStyleId ? styles?.find((s) => s.id === captionStyleId) : null;

  if (!imageStyle && !captionStyle) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Styles
      </h3>
      {imageStyle && (
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="secondary" className="text-[10px]">Image</Badge>
          <span>{imageStyle.name}</span>
        </div>
      )}
      {captionStyle && (
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="secondary" className="text-[10px]">Caption</Badge>
          <span>{captionStyle.name}</span>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────

function getOutputText(output: unknown): string {
  if (typeof output === "string") return output;
  if (output && typeof output === "object" && "text" in output) {
    return String((output as Record<string, unknown>).text ?? "");
  }
  if (output !== null && output !== undefined) {
    return JSON.stringify(output, null, 2);
  }
  return "";
}
