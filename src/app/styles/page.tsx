"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Style {
  id: string;
  name: string;
  description: string | null;
  promptText: string;
  referenceImageUrl: string | null;
  sampleImageUrls: string[];
  isPredefined: boolean;
  createdAt: string;
}

const STYLE_COLORS: Record<string, string> = {
  "Corporate Clean": "from-blue-500 to-blue-300",
  "Bold & Vibrant": "from-red-500 to-yellow-400",
  Minimalist: "from-gray-200 to-white",
  "Retro/Vintage": "from-amber-600 to-orange-300",
  "Neon/Cyberpunk": "from-purple-600 to-cyan-400",
  "Pastel Soft": "from-pink-300 to-blue-200",
  "Dark Luxury": "from-gray-900 to-yellow-600",
  "Earthy Natural": "from-green-700 to-amber-500",
  "Gradient Modern": "from-indigo-500 to-pink-500",
  "Hand-Drawn Sketch": "from-stone-400 to-stone-200",
};

function getStyleGradient(name: string): string {
  return STYLE_COLORS[name] || "from-slate-500 to-slate-300";
}

export default function StylesPage() {
  const [styles, setStyles] = useState<Style[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [textName, setTextName] = useState("");
  const [textPrompt, setTextPrompt] = useState("");
  const [textDescription, setTextDescription] = useState("");
  const [generatedPreviews, setGeneratedPreviews] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [savingText, setSavingText] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [imageDescription, setImageDescription] = useState("");
  const [imageAnalysisResult, setImageAnalysisResult] = useState<{
    promptText: string;
    referenceImageUrl: string;
    sampleImageUrls: string[];
  } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [savingImage, setSavingImage] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStyles = useCallback(async () => {
    try {
      const res = await fetch("/api/styles");
      if (!res.ok) throw new Error("Failed to fetch styles");
      setStyles(await res.json());
    } catch {
      toast.error("Failed to load styles");
    } finally {
      setLoading(false);
    }
  }, []);

  const seedStyles = useCallback(async () => {
    try {
      await fetch("/api/styles/seed", { method: "POST" });
      await fetchStyles();
    } catch {
      toast.error("Failed to seed predefined styles");
    }
  }, [fetchStyles]);

  useEffect(() => {
    fetchStyles();
  }, [fetchStyles]);

  useEffect(() => {
    if (!loading && styles.length === 0) {
      seedStyles();
    }
  }, [loading, styles.length, seedStyles]);

  const resetDialog = () => {
    setTextName("");
    setTextPrompt("");
    setTextDescription("");
    setGeneratedPreviews([]);
    setImageFile(null);
    setImagePreview(null);
    setImageName("");
    setImageDescription("");
    setImageAnalysisResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleGeneratePreview = async () => {
    if (!textPrompt.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/styles/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptText: textPrompt }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGeneratedPreviews(data.sampleImageUrls);
      toast.success("Preview images generated!");
    } catch {
      toast.error("Failed to generate preview images");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveTextStyle = async () => {
    if (!textName.trim() || !textPrompt.trim()) return;
    setSavingText(true);
    try {
      const res = await fetch("/api/styles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: textName,
          description: textDescription || null,
          promptText: textPrompt,
          sampleImageUrls: generatedPreviews,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Style created!");
      setDialogOpen(false);
      resetDialog();
      fetchStyles();
    } catch {
      toast.error("Failed to save style");
    } finally {
      setSavingText(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
      setImageAnalysisResult(null);
    }
  };

  const handleAnalyzeImage = async () => {
    if (!imageFile) return;
    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      const res = await fetch("/api/styles/from-image", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error();
      setImageAnalysisResult(await res.json());
      toast.success("Image analyzed!");
    } catch {
      toast.error("Failed to analyze image");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveImageStyle = async () => {
    if (!imageName.trim() || !imageAnalysisResult) return;
    setSavingImage(true);
    try {
      const res = await fetch("/api/styles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: imageName,
          description: imageDescription || null,
          promptText: imageAnalysisResult.promptText,
          referenceImageUrl: imageAnalysisResult.referenceImageUrl,
          sampleImageUrls: imageAnalysisResult.sampleImageUrls,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Style created!");
      setDialogOpen(false);
      resetDialog();
      fetchStyles();
    } catch {
      toast.error("Failed to save style");
    } finally {
      setSavingImage(false);
    }
  };

  const handleDeleteStyle = async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/styles/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Style deleted");
      setStyles((prev) => prev.filter((s) => s.id !== id));
    } catch {
      toast.error("Failed to delete style");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Styles</h1>
          <p className="text-muted-foreground">
            Manage visual styles for your social media posts
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetDialog(); }}>
          <DialogTrigger render={<Button />}>
            Create Style
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Create New Style</DialogTitle>
              <DialogDescription>
                Define a visual style from text or analyze an existing image.
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="text">
              <TabsList className="w-full">
                <TabsTrigger value="text" className="flex-1">From Text</TabsTrigger>
                <TabsTrigger value="image" className="flex-1">From Image</TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="text-name">Style Name</Label>
                  <Input id="text-name" placeholder="e.g., Sunset Glow" value={textName} onChange={(e) => setTextName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="text-description">Description (optional)</Label>
                  <Input id="text-description" placeholder="Brief description" value={textDescription} onChange={(e) => setTextDescription(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="text-prompt">Style Prompt</Label>
                  <Textarea id="text-prompt" placeholder="Describe the visual style..." value={textPrompt} onChange={(e) => setTextPrompt(e.target.value)} rows={3} />
                </div>
                <Button onClick={handleGeneratePreview} disabled={generating || !textPrompt.trim()} variant="secondary" className="w-full">
                  {generating ? "Generating Preview..." : "Generate Preview"}
                </Button>
                {generating && (
                  <div className="grid grid-cols-2 gap-2">
                    <Skeleton className="aspect-square w-full rounded-lg" />
                    <Skeleton className="aspect-square w-full rounded-lg" />
                  </div>
                )}
                {generatedPreviews.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {generatedPreviews.map((url, i) => (
                      <img key={i} src={url} alt={`Preview ${i + 1}`} className="aspect-square w-full object-cover rounded-lg" />
                    ))}
                  </div>
                )}
                <Button onClick={handleSaveTextStyle} disabled={savingText || !textName.trim() || !textPrompt.trim()} className="w-full">
                  {savingText ? "Saving..." : "Save Style"}
                </Button>
              </TabsContent>

              <TabsContent value="image" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="image-name">Style Name</Label>
                  <Input id="image-name" placeholder="e.g., My Brand Style" value={imageName} onChange={(e) => setImageName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="image-description">Description (optional)</Label>
                  <Input id="image-description" placeholder="Brief description" value={imageDescription} onChange={(e) => setImageDescription(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="image-upload">Reference Image</Label>
                  <Input id="image-upload" type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} />
                </div>
                {imagePreview && (
                  <img src={imagePreview} alt="Reference preview" className="w-full aspect-video object-cover rounded-lg" />
                )}
                <Button onClick={handleAnalyzeImage} disabled={analyzing || !imageFile} variant="secondary" className="w-full">
                  {analyzing ? "Analyzing & Generating..." : "Analyze & Generate"}
                </Button>
                {analyzing && (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <div className="grid grid-cols-2 gap-2">
                      <Skeleton className="aspect-square w-full rounded-lg" />
                      <Skeleton className="aspect-square w-full rounded-lg" />
                    </div>
                  </div>
                )}
                {imageAnalysisResult && (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Detected Style</p>
                      <p className="text-sm">{imageAnalysisResult.promptText}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {imageAnalysisResult.sampleImageUrls.map((url, i) => (
                        <img key={i} src={url} alt={`Sample ${i + 1}`} className="aspect-square w-full object-cover rounded-lg" />
                      ))}
                    </div>
                  </div>
                )}
                <Button onClick={handleSaveImageStyle} disabled={savingImage || !imageName.trim() || !imageAnalysisResult} className="w-full">
                  {savingImage ? "Saving..." : "Save Style"}
                </Button>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
              <CardContent><Skeleton className="aspect-square w-full rounded-lg" /></CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {styles.map((style) => (
            <Card key={style.id} className="group">
              <CardHeader>
                <CardTitle>{style.name}</CardTitle>
                <CardAction>
                  <Badge variant={style.isPredefined ? "secondary" : "outline"}>
                    {style.isPredefined ? "Predefined" : "Custom"}
                  </Badge>
                </CardAction>
                {style.description && <CardDescription>{style.description}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-3">
                {style.sampleImageUrls.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {style.sampleImageUrls.map((url, i) => (
                      <img key={i} src={url} alt={`${style.name} sample ${i + 1}`} className="aspect-square w-full object-cover rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <div className={`flex aspect-square items-center justify-center rounded-lg bg-gradient-to-br ${getStyleGradient(style.name)}`}>
                    <span className="text-3xl font-bold text-white/80">
                      {style.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                    </span>
                  </div>
                )}
                <p className="line-clamp-2 text-xs text-muted-foreground">{style.promptText}</p>
                {!style.isPredefined && (
                  <Button variant="destructive" size="sm" className="w-full" disabled={deleting === style.id} onClick={() => handleDeleteStyle(style.id)}>
                    {deleting === style.id ? "Deleting..." : "Delete"}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
