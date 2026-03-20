"use client";

import { useState, useMemo } from "react";
import { SparklesIcon, Loader2Icon, PaletteIcon, MessageSquareIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStyles } from "@/hooks/use-styles";
import { cn } from "@/lib/utils";

interface GeneratePopoverProps {
  onGenerate: (count: number, options?: { imageStyleIds?: string[]; captionStyleId?: string }) => void;
  defaultCount: number;
  nextLayerName: string;
  isGenerating?: boolean;
  showStylePickers?: boolean;
}

export function GeneratePopover({
  onGenerate,
  defaultCount,
  nextLayerName,
  isGenerating,
  showStylePickers,
}: GeneratePopoverProps) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(defaultCount);
  const [selectedImageStyleIds, setSelectedImageStyleIds] = useState<Set<string>>(new Set());
  const [captionStyleId, setCaptionStyleId] = useState<string | undefined>();

  const { data: styles } = useStyles();

  const imageStyles = useMemo(
    () => styles?.filter((s) => s.kind === "image") ?? [],
    [styles],
  );
  const captionStyles = useMemo(
    () => styles?.filter((s) => s.kind === "caption") ?? [],
    [styles],
  );

  const toggleImageStyle = (id: string) => {
    setSelectedImageStyleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const totalOutlines = showStylePickers && selectedImageStyleIds.size > 0
    ? count * selectedImageStyleIds.size
    : count;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={isGenerating}>
          {isGenerating ? (
            <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <SparklesIcon className="mr-1.5 size-3.5" />
          )}
          Generate {nextLayerName}
        </Button>
      </PopoverTrigger>
      <PopoverContent className={showStylePickers ? "w-80 space-y-3" : "w-56 space-y-3"} align="start">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {showStylePickers && selectedImageStyleIds.size > 0
              ? `${count} per style × ${selectedImageStyleIds.size} style${selectedImageStyleIds.size > 1 ? "s" : ""}`
              : `Number of ${nextLayerName.toLowerCase()}`}
          </Label>
          <Input
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="h-8"
          />
        </div>

        {showStylePickers && (
          <>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <PaletteIcon className="size-3" />
                Image Styles
                {selectedImageStyleIds.size > 0 && (
                  <span className="ml-auto text-[10px] font-medium text-primary">
                    {selectedImageStyleIds.size} selected
                  </span>
                )}
              </Label>
              <ScrollArea className="h-[140px] rounded-md border">
                <div className="p-1.5 space-y-0.5">
                  {imageStyles.map((s) => {
                    const selected = selectedImageStyleIds.has(s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => toggleImageStyle(s.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors",
                          selected
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <div className={cn(
                          "flex size-3.5 shrink-0 items-center justify-center rounded-sm border",
                          selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30",
                        )}>
                          {selected && <CheckIcon className="size-2.5" />}
                        </div>
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MessageSquareIcon className="size-3" />
                Caption Style
              </Label>
              <Select
                value={captionStyleId ?? "__none__"}
                onValueChange={(v) => setCaptionStyleId(v === "__none__" ? undefined : v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="None" />
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
          </>
        )}

        <Button
          size="sm"
          className="w-full"
          disabled={isGenerating || count < 1}
          onClick={() => {
            const ids = Array.from(selectedImageStyleIds);
            onGenerate(
              count,
              showStylePickers ? { imageStyleIds: ids.length > 0 ? ids : undefined, captionStyleId } : undefined,
            );
            setOpen(false);
          }}
        >
          {isGenerating ? (
            <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <SparklesIcon className="mr-1.5 size-3.5" />
          )}
          Generate {totalOutlines} {nextLayerName.toLowerCase()}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
