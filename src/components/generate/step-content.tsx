"use client";

import { useGenerateStore } from "@/stores/use-generate-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  PenLineIcon,
  LightbulbIcon,
  FileUpIcon,
  ImageIcon,
  BookOpenIcon,
} from "lucide-react";
import { useState } from "react";

const modes = [
  { id: "prompt", label: "Write", icon: PenLineIcon, ready: true },
  { id: "idea", label: "From Idea", icon: LightbulbIcon, ready: false },
  { id: "source", label: "From Source", icon: BookOpenIcon, ready: false },
  { id: "upload", label: "Upload", icon: FileUpIcon, ready: false },
  { id: "asset", label: "From Assets", icon: ImageIcon, ready: false },
];

export function StepContent() {
  const { content, setContent, setStep } = useGenerateStore();
  const [activeMode, setActiveMode] = useState("prompt");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">What&apos;s your content about?</h2>
        <p className="text-sm text-muted-foreground">
          Describe what you want to create.
        </p>
      </div>

      <div className="flex gap-2">
        {modes.map((m) => (
          <Button
            key={m.id}
            variant={activeMode === m.id ? "default" : "outline"}
            size="sm"
            onClick={() => m.ready && setActiveMode(m.id)}
            disabled={!m.ready}
            className="gap-1.5"
          >
            <m.icon className="size-3.5" />
            {m.label}
          </Button>
        ))}
      </div>

      {activeMode === "prompt" && (
        <Textarea
          value={content.prompt}
          onChange={(e) => setContent({ prompt: e.target.value })}
          placeholder="Describe your content. Be as detailed as you like — the AI will use this to generate an outline for each platform."
          rows={8}
          className="resize-none"
        />
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setStep(1)}>
          Back
        </Button>
        <Button onClick={() => setStep(3)} disabled={!content.prompt.trim()}>
          Continue
        </Button>
      </div>
    </div>
  );
}
