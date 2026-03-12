"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Style {
  id: string;
  name: string;
  promptText: string;
  sampleImageUrls: string[];
  isPredefined: boolean;
}

interface GeneratedPost {
  id: string;
  prompt: string;
  format: string;
  aspectRatio: string;
  model: string;
  status: string;
  images: { id: string; slideNumber: number; cloudinaryUrl: string }[];
  style?: Style;
}

const ASPECT_RATIOS = [
  { key: "3:4", label: "3:4", desc: "Vertical" },
  { key: "1:1", label: "1:1", desc: "Square" },
  { key: "4:5", label: "4:5", desc: "Portrait" },
  { key: "9:16", label: "9:16", desc: "Story" },
];

const MODELS = [
  { key: "nano-banana-2", label: "Nano Banana 2", desc: "Fast (Default)" },
  { key: "nano-banana-pro", label: "Nano Banana Pro", desc: "Highest Quality" },
];

export default function GeneratePageWrapper() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <GeneratePage />
    </Suspense>
  );
}

function GeneratePage() {
  const searchParams = useSearchParams();
  const ideaId = searchParams.get("ideaId");

  const [prompt, setPrompt] = useState("");
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState("4:5");
  const [format, setFormat] = useState<"static" | "carousel">("static");
  const [model, setModel] = useState("nano-banana-2");
  const [includeLogo, setIncludeLogo] = useState(false);
  const [slideCount, setSlideCount] = useState(3);
  const [styles, setStyles] = useState<Style[]>([]);
  const [generating, setGenerating] = useState(false);
  const [activeGenerations, setActiveGenerations] = useState<GeneratedPost[]>([]);
  const [loadingStyles, setLoadingStyles] = useState(true);

  const fetchStyles = useCallback(async () => {
    try {
      const res = await fetch("/api/styles");
      if (res.ok) {
        setStyles(await res.json());
      }
    } catch {
      console.error("Failed to fetch styles");
    } finally {
      setLoadingStyles(false);
    }
  }, []);

  useEffect(() => {
    fetchStyles();
  }, [fetchStyles]);

  // Load content idea if ideaId is provided
  useEffect(() => {
    if (ideaId) {
      fetch(`/api/content/ideas/${ideaId}`)
        .then((res) => res.json())
        .then((idea) => {
          if (idea.ideaText) {
            setPrompt(idea.ideaText);
            setFormat(idea.format === "carousel" ? "carousel" : "static");
            if (idea.slideCount > 1) setSlideCount(idea.slideCount);
          }
        })
        .catch(() => {});
    }
  }, [ideaId]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          styleId: selectedStyleId,
          contentIdeaId: ideaId,
          aspectRatio,
          format,
          model,
          includeLogo,
          slideCount: format === "carousel" ? slideCount : 1,
        }),
      });

      if (!res.ok) throw new Error("Generation failed");

      const post = await res.json();
      setActiveGenerations((prev) => [post, ...prev]);
      toast.success("Images generated successfully!");
    } catch {
      toast.error("Failed to generate images");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Generate Post</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Style Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Style</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingStyles ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  <button
                    onClick={() => setSelectedStyleId(null)}
                    className={`relative rounded-lg border-2 p-3 text-center text-sm transition-colors ${
                      selectedStyleId === null
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="text-2xl mb-1">-</div>
                    <div className="text-xs text-muted-foreground">None</div>
                  </button>
                  {styles.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setSelectedStyleId(style.id)}
                      className={`relative rounded-lg border-2 overflow-hidden transition-colors ${
                        selectedStyleId === style.id
                          ? "border-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {style.sampleImageUrls.length > 0 ? (
                        <img
                          src={style.sampleImageUrls[0]}
                          alt={style.name}
                          className="w-full h-16 object-cover"
                        />
                      ) : (
                        <div className="w-full h-16 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">
                            {style.name.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div className="p-1.5 text-xs truncate">{style.name}</div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Prompt Editor */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Prompt</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Describe the image you want to generate..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </CardContent>
          </Card>

          {/* Format & Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Format */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Format</Label>
                <div className="flex gap-3">
                  <Button
                    variant={format === "static" ? "default" : "outline"}
                    onClick={() => setFormat("static")}
                    size="sm"
                  >
                    Static
                  </Button>
                  <Button
                    variant={format === "carousel" ? "default" : "outline"}
                    onClick={() => setFormat("carousel")}
                    size="sm"
                  >
                    Carousel
                  </Button>
                </div>
                {format === "carousel" && (
                  <div className="mt-3 flex items-center gap-3">
                    <Label className="text-sm">Slides:</Label>
                    <Input
                      type="number"
                      min={2}
                      max={10}
                      value={slideCount}
                      onChange={(e) =>
                        setSlideCount(
                          Math.min(10, Math.max(2, parseInt(e.target.value) || 2))
                        )
                      }
                      className="w-20"
                    />
                  </div>
                )}
              </div>

              <Separator />

              {/* Aspect Ratio */}
              <div>
                <Label className="text-sm font-medium mb-3 block">
                  Aspect Ratio
                </Label>
                <div className="flex gap-3">
                  {ASPECT_RATIOS.map((ar) => (
                    <Button
                      key={ar.key}
                      variant={aspectRatio === ar.key ? "default" : "outline"}
                      onClick={() => setAspectRatio(ar.key)}
                      size="sm"
                      className="flex-col h-auto py-2 px-4"
                    >
                      <span className="text-sm font-medium">{ar.label}</span>
                      <span className="text-[10px] opacity-70">{ar.desc}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Model */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Model</Label>
                <div className="flex gap-3">
                  {MODELS.map((m) => (
                    <Button
                      key={m.key}
                      variant={model === m.key ? "default" : "outline"}
                      onClick={() => setModel(m.key)}
                      size="sm"
                      className="flex-col h-auto py-2 px-4"
                    >
                      <span className="text-sm font-medium">{m.label}</span>
                      <span className="text-[10px] opacity-70">{m.desc}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Brand Logo */}
              <div className="flex items-center gap-3">
                <Checkbox
                  id="includeLogo"
                  checked={includeLogo}
                  onCheckedChange={(checked) =>
                    setIncludeLogo(checked === true)
                  }
                />
                <Label htmlFor="includeLogo" className="text-sm">
                  Include brand logo & details in generation
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            size="lg"
            className="w-full"
          >
            {generating ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Generating...
              </>
            ) : (
              "Generate"
            )}
          </Button>
        </div>

        {/* Right: Generation Queue */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Recent Generations</h2>
          {activeGenerations.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground text-sm">
                Generated posts will appear here
              </CardContent>
            </Card>
          ) : (
            activeGenerations.map((post) => (
              <Card key={post.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge
                      variant={
                        post.status === "completed" ? "default" : "secondary"
                      }
                    >
                      {post.status}
                    </Badge>
                    <Badge variant="outline">{post.format}</Badge>
                    <Badge variant="outline">{post.aspectRatio}</Badge>
                  </div>
                  {post.status === "completed" && post.images.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {post.images.map((img) => (
                        <img
                          key={img.id}
                          src={img.cloudinaryUrl}
                          alt={`Slide ${img.slideNumber}`}
                          className="rounded-lg w-full object-cover"
                        />
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    {post.prompt}
                  </p>
                  {post.status === "completed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() => {
                        window.open(
                          `/api/posts/${post.id}/download`,
                          "_blank"
                        );
                      }}
                    >
                      Download
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
