"use client";

import { useState } from "react";
import { SparklesIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface GeneratePopoverProps {
  onGenerate: (count: number) => void;
  defaultCount: number;
  nextLayerName: string;
  isGenerating?: boolean;
}

export function GeneratePopover({
  onGenerate,
  defaultCount,
  nextLayerName,
  isGenerating,
}: GeneratePopoverProps) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(defaultCount);

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
      <PopoverContent className="w-56 space-y-3" align="start">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Number of {nextLayerName.toLowerCase()}
          </label>
          <Input
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="h-8"
          />
        </div>
        <Button
          size="sm"
          className="w-full"
          disabled={isGenerating || count < 1}
          onClick={() => {
            onGenerate(count);
            setOpen(false);
          }}
        >
          {isGenerating ? (
            <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <SparklesIcon className="mr-1.5 size-3.5" />
          )}
          Generate {count} {nextLayerName.toLowerCase()}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
