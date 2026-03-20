"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  useStyles,
  useCreateStyle,
  useDeleteStyle,
  useGenerateStylePreview,
  useSeedStyles,
  useStyleFromImage,
  useRemixStyle,
  useBlendStyles,
  useGenerateCaptionPreview,
  useGeneratePreviewsForStyles,
} from "@/hooks/use-styles";
import { Badge } from "@/components/ui/badge";
import { StyleCard } from "@/components/style-card";
import { StyleInspector } from "@/components/style-inspector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  PlusIcon,
  SparklesIcon,
  Loader2Icon,
  PaletteIcon,
  UploadIcon,
  ShuffleIcon,
  MergeIcon,
  TypeIcon,
} from "lucide-react";
import { toast } from "sonner";

const PLATFORMS = [
  { id: "all", label: "All" },
  { id: "instagram", label: "Instagram" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "x", label: "X" },
  { id: "reddit", label: "Reddit" },
  { id: "blog", label: "Blog" },
  { id: "email", label: "Email" },
] as const;

export default function StylesPage() {
  const { data: styles, isLoading, isError } = useStyles();
  const createStyle = useCreateStyle();
  const deleteStyle = useDeleteStyle();
  const generatePreview = useGenerateStylePreview();
  const seedStyles = useSeedStyles();
  const styleFromImage = useStyleFromImage();
  const remixStyle = useRemixStyle();
  const blendStyles = useBlendStyles();
  const generateCaptionPreview = useGenerateCaptionPreview();
  const generateForStyles = useGeneratePreviewsForStyles();

  const [createOpen, setCreateOpen] = useState(false);
  const [createTab, setCreateTab] = useState("text");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Platform filter
  const [activePlatform, setActivePlatform] = useState("all");

  // Inspector
  const [inspectStyle, setInspectStyle] = useState<any>(null);
  const [inspectOpen, setInspectOpen] = useState(false);

  // Auto-seed: create missing caption styles OR generate samples for ones that have none
  const seededRef = useRef(false);
  useEffect(() => {
    if (!styles || seededRef.current) return;
    const captionStyles = styles.filter((s) => s.kind === "caption" && s.isPredefined);
    const needsSeed = captionStyles.length === 0;
    const needsSamples = captionStyles.some((s) => !s.sampleTexts || s.sampleTexts.length === 0);
    if (needsSeed || needsSamples) {
      seededRef.current = true;
      seedStyles.mutate();
    }
  }, [styles]);

  // Caption create form state
  const [captionName, setCaptionName] = useState("");
  const [captionDescription, setCaptionDescription] = useState("");
  const [captionPromptText, setCaptionPromptText] = useState("");
  const [captionSampleTexts, setCaptionSampleTexts] = useState<string[]>([]);

  // Create form state -- From Text tab
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPromptText, setNewPromptText] = useState("");
  const [previewImageUrls, setPreviewImageUrls] = useState<string[]>([]);

  // Create form state -- From Image tab
  const [imgName, setImgName] = useState("");
  const [imgDescription, setImgDescription] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [analyzedPrompt, setAnalyzedPrompt] = useState("");
  const [imgPreviewUrls, setImgPreviewUrls] = useState<string[]>([]);

  // Remix state
  const [remixOpen, setRemixOpen] = useState(false);
  const [remixName, setRemixName] = useState("");
  const [remixDescription, setRemixDescription] = useState("");
  const [remixPrompt, setRemixPrompt] = useState("");
  const [remixPlatforms, setRemixPlatforms] = useState<string[]>([]);
  const [remixParentIds, setRemixParentIds] = useState<string[]>([]);

  // Blend state
  const [blendOpen, setBlendOpen] = useState(false);
  const [blendPickerOpen, setBlendPickerOpen] = useState(false);
  const [blendFirstId, setBlendFirstId] = useState<string | null>(null);
  const [blendName, setBlendName] = useState("");
  const [blendDescription, setBlendDescription] = useState("");
  const [blendPrompt, setBlendPrompt] = useState("");
  const [blendPlatforms, setBlendPlatforms] = useState<string[]>([]);
  const [blendParentIds, setBlendParentIds] = useState<string[]>([]);

  // Filtered styles
  const filteredStyles =
    styles?.filter((s) =>
      activePlatform === "all" ? true : s.platforms?.includes(activePlatform)
    ) ?? [];

  const resetForm = useCallback(() => {
    setNewName("");
    setNewDescription("");
    setNewPromptText("");
    setPreviewImageUrls([]);
    setImgName("");
    setImgDescription("");
    setUploadedFile(null);
    setUploadPreview(null);
    setAnalyzedPrompt("");
    setImgPreviewUrls([]);
    setCaptionName("");
    setCaptionDescription("");
    setCaptionPromptText("");
    setCaptionSampleTexts([]);
  }, []);

  const handleInspect = (style: any) => {
    setInspectStyle(style);
    setInspectOpen(true);
  };

  const handleGenerateCaptionPreview = () => {
    if (!captionPromptText.trim()) {
      toast.error("Enter a caption style prompt first");
      return;
    }
    generateCaptionPreview.mutate(
      { promptText: captionPromptText },
      {
        onSuccess: (data) => {
          setCaptionSampleTexts(data.sampleTexts);
          toast.success("Caption samples generated");
        },
      }
    );
  };

  const handleSaveCaptionStyle = () => {
    if (!captionName.trim() || !captionPromptText.trim()) {
      toast.error("Name and prompt are required");
      return;
    }
    createStyle.mutate(
      {
        name: captionName,
        description: captionDescription || undefined,
        promptText: captionPromptText,
        kind: "caption",
        sampleTexts: captionSampleTexts,
        platforms: ["instagram"],
      },
      {
        onSuccess: () => {
          toast.success("Caption style created");
          setCaptionName("");
          setCaptionDescription("");
          setCaptionPromptText("");
          setCaptionSampleTexts([]);
          setCreateOpen(false);
        },
        onError: (err) => toast.error(err.message ?? "Failed to create style"),
      }
    );
  };

  const handleSeed = () => {
    seedStyles.mutate(undefined, {
      onSuccess: () => toast.success("Predefined styles loaded"),
      onError: (err) => toast.error(err.message ?? "Failed to seed styles"),
    });
  };

  const handleGeneratePreview = () => {
    if (!newPromptText.trim()) {
      toast.error("Enter a style prompt first");
      return;
    }
    generatePreview.mutate(
      { promptText: newPromptText },
      {
        onSuccess: (data) => {
          setPreviewImageUrls(data.sampleImageUrls);
          toast.success("Preview generated");
        },
        onError: (err) =>
          toast.error(err.message ?? "Failed to generate preview"),
      }
    );
  };

  const handleSaveFromText = () => {
    if (!newName.trim() || !newPromptText.trim()) {
      toast.error("Name and prompt text are required");
      return;
    }
    createStyle.mutate(
      {
        name: newName,
        description: newDescription || undefined,
        promptText: newPromptText,
      },
      {
        onSuccess: (data) => {
          toast.success("Style created — generating previews...");
          resetForm();
          setCreateOpen(false);
          // Auto-generate IG preview images in background
          generateForStyles.mutate({ styleIds: [data.id] });
        },
        onError: (err) =>
          toast.error(err.message ?? "Failed to create style"),
      }
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    const reader = new FileReader();
    reader.onload = () => setUploadPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      setUploadedFile(file);
      const reader = new FileReader();
      reader.onload = () => setUploadPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyzeImage = () => {
    if (!uploadedFile) {
      toast.error("Upload an image first");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      styleFromImage.mutate(
        { base64, mimeType: uploadedFile.type },
        {
          onSuccess: (data) => {
            setImgPreviewUrls(data.sampleImageUrls);
            setAnalyzedPrompt(data.promptText);
            toast.success("Image analyzed and preview generated");
          },
          onError: (err) =>
            toast.error(err.message ?? "Failed to analyze image"),
        }
      );
    };
    reader.readAsDataURL(uploadedFile);
  };

  const handleSaveFromImage = () => {
    if (!imgName.trim()) {
      toast.error("Name is required");
      return;
    }
    createStyle.mutate(
      {
        name: imgName,
        description: imgDescription || undefined,
        promptText:
          analyzedPrompt || "Custom style from reference image",
      },
      {
        onSuccess: (data) => {
          toast.success("Style created — generating previews...");
          resetForm();
          setCreateOpen(false);
          generateForStyles.mutate({ styleIds: [data.id] });
        },
        onError: (err) =>
          toast.error(err.message ?? "Failed to create style"),
      }
    );
  };

  const handleDelete = (id: string) => {
    deleteStyle.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success("Style deleted");
          setDeleteId(null);
        },
        onError: (err) => toast.error(err.message ?? "Failed to delete style"),
      }
    );
  };

  // Remix handlers
  const handleRemix = (styleId: string) => {
    toast.info("Generating style variation...");
    remixStyle.mutate(
      { sourceStyleId: styleId },
      {
        onSuccess: (data) => {
          setRemixName(data.name);
          setRemixDescription(data.description ?? "");
          setRemixPrompt(data.promptText);
          setRemixPlatforms(data.platforms);
          setRemixParentIds(data.parentStyleIds);
          setRemixOpen(true);
        },
      }
    );
  };

  const handleSaveRemix = () => {
    if (!remixName.trim() || !remixPrompt.trim()) return;
    createStyle.mutate(
      {
        name: remixName,
        description: remixDescription || undefined,
        promptText: remixPrompt,
        platforms: remixPlatforms,
        parentStyleIds: remixParentIds,
      },
      {
        onSuccess: () => {
          toast.success("Remixed style created");
          setRemixOpen(false);
        },
        onError: (err) => toast.error(err.message ?? "Failed to save remix"),
      }
    );
  };

  // Blend handlers
  const handleBlendStart = (styleId: string) => {
    setBlendFirstId(styleId);
    setBlendPickerOpen(true);
  };

  const handleBlendSelect = (secondId: string) => {
    if (!blendFirstId) return;
    setBlendPickerOpen(false);
    toast.info("Blending styles...");
    blendStyles.mutate(
      { styleIdA: blendFirstId, styleIdB: secondId },
      {
        onSuccess: (data) => {
          setBlendName(data.name);
          setBlendDescription(data.description ?? "");
          setBlendPrompt(data.promptText);
          setBlendPlatforms(data.platforms);
          setBlendParentIds(data.parentStyleIds);
          setBlendOpen(true);
        },
      }
    );
  };

  const handleSaveBlend = () => {
    if (!blendName.trim() || !blendPrompt.trim()) return;
    createStyle.mutate(
      {
        name: blendName,
        description: blendDescription || undefined,
        promptText: blendPrompt,
        platforms: blendPlatforms,
        parentStyleIds: blendParentIds,
      },
      {
        onSuccess: () => {
          toast.success("Blended style created");
          setBlendOpen(false);
        },
        onError: (err) => toast.error(err.message ?? "Failed to save blend"),
      }
    );
  };

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          onClick={() => {
            resetForm();
            setCreateOpen(true);
          }}
          className="gap-1.5"
        >
          <PlusIcon className="size-3.5" />
          Create Style
        </Button>
      </div>

      {/* Platform filter tabs */}
      {!isError && !isLoading && styles && styles.length > 0 && (
        <div className="flex gap-1 overflow-x-auto">
          {PLATFORMS.map((p) => {
            const count =
              p.id === "all"
                ? styles.length
                : styles.filter((s) => s.platforms?.includes(p.id)).length;
            return (
              <Button
                key={p.id}
                variant={activePlatform === p.id ? "default" : "outline"}
                size="sm"
                onClick={() => setActivePlatform(p.id)}
                className="shrink-0 gap-1.5"
              >
                {p.label}
                <span className="text-xs opacity-60">{count}</span>
              </Button>
            );
          })}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
          <p className="text-sm text-muted-foreground">
            Failed to load data. Please try again.
          </p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading skeleton grid */}
      {!isError && isLoading && (
        <div className="@container/main">
          <div className="grid gap-4 grid-cols-1 @xl/main:grid-cols-2 @3xl/main:grid-cols-3 @5xl/main:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-square w-full rounded-xl" />
                <div className="space-y-2 px-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && styles && styles.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
            <PaletteIcon className="size-8 text-muted-foreground/40" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">
              No styles yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Load predefined styles or create your own to get started.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeed}
              disabled={seedStyles.isPending}
              className="gap-1.5"
            >
              {seedStyles.isPending ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <SparklesIcon className="size-3.5" />
              )}
              Load Predefined Styles
            </Button>
            <Button
              size="sm"
              onClick={() => {
                resetForm();
                setCreateOpen(true);
              }}
              className="gap-1.5"
            >
              <PlusIcon className="size-3.5" />
              Create Style
            </Button>
          </div>
        </div>
      )}

      {/* Style cards grid */}
      {!isLoading && styles && styles.length > 0 && (
        <div className="@container/main">
          <div className="grid gap-4 grid-cols-1 @xl/main:grid-cols-2 @3xl/main:grid-cols-3 @5xl/main:grid-cols-4">
            {filteredStyles.map((style) => (
              <div key={style.id}>
                {!style.isPredefined ? (
                  <AlertDialog
                    open={deleteId === style.id}
                    onOpenChange={(open) =>
                      setDeleteId(open ? style.id : null)
                    }
                  >
                    <StyleCard
                      style={style}
                      onDelete={() => setDeleteId(style.id)}
                      onRemix={() => handleRemix(style.id)}
                      onBlend={() => handleBlendStart(style.id)}
                      onInspect={() => handleInspect(style)}
                    />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete style?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete &ldquo;{style.name}
                          &rdquo;. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(style.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {deleteStyle.isPending ? (
                            <Loader2Icon className="size-3.5 animate-spin" />
                          ) : (
                            "Delete"
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <StyleCard
                    style={style}
                    onRemix={() => handleRemix(style.id)}
                    onBlend={() => handleBlendStart(style.id)}
                    onInspect={() => handleInspect(style)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Style Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="w-[90vw] !max-w-[90vw] h-[90vh] max-h-[90vh] overflow-hidden p-0">
          <div className="grid grid-cols-1 md:grid-cols-2 h-[90vh]">
            {/* Left column — Preview */}
            <div className="flex flex-col bg-muted/30 p-6 overflow-y-auto">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-sm font-medium text-muted-foreground">Preview</h3>
                <Badge variant="outline" className="text-[10px]">
                  {createTab === "caption" ? "Caption" : "Image"}
                </Badge>
              </div>

              {createTab === "text" && (
                <div className="grid grid-cols-2 gap-2 flex-1">
                  {[0, 1, 2, 3].map((idx) => {
                    const url = previewImageUrls[idx];
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
              )}

              {createTab === "caption" && (
                <div className="space-y-3 flex-1">
                  {captionSampleTexts.map((text, i) => (
                    <div
                      key={i}
                      className="rounded-lg border bg-background/60 p-4 text-sm italic text-foreground/80"
                    >
                      &ldquo;{text}&rdquo;
                    </div>
                  ))}
                  {captionSampleTexts.length === 0 && (
                    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                      No samples yet — generate them after writing a prompt
                    </div>
                  )}
                </div>
              )}

              {createTab === "image" && (
                <div className="space-y-4 flex-1">
                  {uploadPreview && (
                    <div className="text-center">
                      <p className="mb-2 text-xs text-muted-foreground">Reference Image</p>
                      <img
                        src={uploadPreview}
                        alt="Reference"
                        className="mx-auto max-h-40 rounded-lg object-contain"
                      />
                    </div>
                  )}
                  {imgPreviewUrls.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {imgPreviewUrls.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt=""
                          className="aspect-square w-full rounded-lg object-cover"
                          loading="lazy"
                        />
                      ))}
                    </div>
                  )}
                  {!uploadPreview && imgPreviewUrls.length === 0 && (
                    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                      Upload a reference image to extract a style
                    </div>
                  )}
                </div>
              )}

              {(generatePreview.isPending || styleFromImage.isPending || generateCaptionPreview.isPending) && (
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2Icon className="size-3.5 animate-spin" />
                  Generating...
                </div>
              )}
            </div>

            {/* Right column — Form */}
            <div className="flex flex-col p-6 overflow-y-auto">
              <DialogHeader className="mb-6">
                <DialogTitle>Create Style</DialogTitle>
                <DialogDescription>
                  Define a visual style by writing a prompt or uploading a reference image.
                </DialogDescription>
              </DialogHeader>

              <Tabs value={createTab} onValueChange={setCreateTab} className="flex-1">
                <TabsList className="w-full">
                  <TabsTrigger value="text" className="flex-1 gap-1.5">
                    <PaletteIcon className="size-3.5" />
                    From Text
                  </TabsTrigger>
                  <TabsTrigger value="caption" className="flex-1 gap-1.5">
                    <TypeIcon className="size-3.5" />
                    Caption
                  </TabsTrigger>
                  <TabsTrigger value="image" className="flex-1 gap-1.5">
                    <UploadIcon className="size-3.5" />
                    From Image
                  </TabsTrigger>
                </TabsList>

                {/* FROM TEXT TAB */}
                <TabsContent value="text" className="space-y-5 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="style-name">Name</Label>
                    <Input
                      id="style-name"
                      placeholder="e.g. Minimal Corporate"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="style-description">
                      Description <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="style-description"
                      placeholder="Brief description of this style"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="style-prompt">Style Prompt</Label>
                    <Textarea
                      id="style-prompt"
                      placeholder="Describe the visual style: colors, typography, mood, composition, textures..."
                      value={newPromptText}
                      onChange={(e) => setNewPromptText(e.target.value)}
                      rows={6}
                      className="resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handleGeneratePreview}
                      disabled={generatePreview.isPending || !newPromptText.trim()}
                      className="gap-1.5"
                    >
                      {generatePreview.isPending ? (
                        <Loader2Icon className="size-3.5 animate-spin" />
                      ) : (
                        <SparklesIcon className="size-3.5" />
                      )}
                      Preview
                    </Button>
                    <Button
                      onClick={handleSaveFromText}
                      disabled={createStyle.isPending || !newName.trim() || !newPromptText.trim()}
                      className="gap-1.5 flex-1"
                    >
                      {createStyle.isPending && <Loader2Icon className="size-3.5 animate-spin" />}
                      Save Style
                    </Button>
                  </div>
                </TabsContent>

                {/* CAPTION STYLE TAB */}
                <TabsContent value="caption" className="space-y-5 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="caption-name">Name</Label>
                    <Input
                      id="caption-name"
                      placeholder="e.g. Professional & Concise"
                      value={captionName}
                      onChange={(e) => setCaptionName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="caption-description">
                      Description <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="caption-description"
                      placeholder="Brief description of this writing style"
                      value={captionDescription}
                      onChange={(e) => setCaptionDescription(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="caption-prompt">Style Prompt</Label>
                    <Textarea
                      id="caption-prompt"
                      placeholder="Describe the writing style: tone, structure, emoji usage, hashtag style, CTA approach..."
                      value={captionPromptText}
                      onChange={(e) => setCaptionPromptText(e.target.value)}
                      rows={6}
                      className="resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handleGenerateCaptionPreview}
                      disabled={generateCaptionPreview.isPending || !captionPromptText.trim()}
                      className="gap-1.5"
                    >
                      {generateCaptionPreview.isPending ? (
                        <Loader2Icon className="size-3.5 animate-spin" />
                      ) : (
                        <SparklesIcon className="size-3.5" />
                      )}
                      Generate Samples
                    </Button>
                    <Button
                      onClick={handleSaveCaptionStyle}
                      disabled={createStyle.isPending || !captionName.trim() || !captionPromptText.trim()}
                      className="gap-1.5 flex-1"
                    >
                      {createStyle.isPending && <Loader2Icon className="size-3.5 animate-spin" />}
                      Save Style
                    </Button>
                  </div>
                </TabsContent>

                {/* FROM IMAGE TAB */}
                <TabsContent value="image" className="space-y-5 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="img-style-name">Name</Label>
                    <Input
                      id="img-style-name"
                      placeholder="e.g. My Brand Look"
                      value={imgName}
                      onChange={(e) => setImgName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="img-style-description">
                      Description <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="img-style-description"
                      placeholder="Brief description"
                      value={imgDescription}
                      onChange={(e) => setImgDescription(e.target.value)}
                    />
                  </div>
                  {/* File upload drop zone */}
                  <div
                    className="relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors hover:border-primary/50"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                  >
                    {uploadPreview ? (
                      <div className="space-y-2 text-center">
                        <p className="text-xs text-muted-foreground">{uploadedFile?.name}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setUploadedFile(null); setUploadPreview(null); }}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <>
                        <UploadIcon className="size-8 text-muted-foreground/40" />
                        <p className="mt-2 text-sm text-muted-foreground">Drag & drop an image here</p>
                        <p className="text-xs text-muted-foreground/60">or click to browse</p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="absolute inset-0 cursor-pointer opacity-0"
                        />
                      </>
                    )}
                  </div>
                  {analyzedPrompt && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Extracted Style Description</Label>
                      <p className="rounded-lg border bg-muted/30 p-3 text-sm">{analyzedPrompt}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handleAnalyzeImage}
                      disabled={styleFromImage.isPending || !uploadedFile}
                      className="gap-1.5"
                    >
                      {styleFromImage.isPending ? (
                        <Loader2Icon className="size-3.5 animate-spin" />
                      ) : (
                        <SparklesIcon className="size-3.5" />
                      )}
                      Analyze & Generate
                    </Button>
                    <Button
                      onClick={handleSaveFromImage}
                      disabled={createStyle.isPending || !imgName.trim()}
                      className="gap-1.5 flex-1"
                    >
                      {createStyle.isPending && <Loader2Icon className="size-3.5 animate-spin" />}
                      Save Style
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remix Style Dialog */}
      <Dialog open={remixOpen} onOpenChange={setRemixOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShuffleIcon className="size-4" />
              Remix Style
            </DialogTitle>
            <DialogDescription>
              AI generated a variation. Edit before saving.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={remixName}
                onChange={(e) => setRemixName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Description{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                value={remixDescription}
                onChange={(e) => setRemixDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Style Prompt</Label>
              <Textarea
                value={remixPrompt}
                onChange={(e) => setRemixPrompt(e.target.value)}
                rows={5}
                className="resize-none"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setRemixOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveRemix}
                disabled={
                  createStyle.isPending ||
                  !remixName.trim() ||
                  !remixPrompt.trim()
                }
                className="flex-1 gap-1.5"
              >
                {createStyle.isPending && (
                  <Loader2Icon className="size-3.5 animate-spin" />
                )}
                Save Remix
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Blend Picker Dialog */}
      <Dialog open={blendPickerOpen} onOpenChange={setBlendPickerOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MergeIcon className="size-4" />
              Choose Second Style to Blend
            </DialogTitle>
            <DialogDescription>
              Select a style to blend with &ldquo;
              {styles?.find((s) => s.id === blendFirstId)?.name}&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto max-h-[50vh] mt-2">
            {styles
              ?.filter((s) => s.id !== blendFirstId)
              .map((s) => (
                <StyleCard
                  key={s.id}
                  style={s}
                  onSelect={() => handleBlendSelect(s.id)}
                />
              ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Blend Style Dialog */}
      <Dialog open={blendOpen} onOpenChange={setBlendOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MergeIcon className="size-4" />
              Blend Styles
            </DialogTitle>
            <DialogDescription>
              AI blended both styles. Edit before saving.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={blendName}
                onChange={(e) => setBlendName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Description{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                value={blendDescription}
                onChange={(e) => setBlendDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Style Prompt</Label>
              <Textarea
                value={blendPrompt}
                onChange={(e) => setBlendPrompt(e.target.value)}
                rows={5}
                className="resize-none"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setBlendOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveBlend}
                disabled={
                  createStyle.isPending ||
                  !blendName.trim() ||
                  !blendPrompt.trim()
                }
                className="flex-1 gap-1.5"
              >
                {createStyle.isPending && (
                  <Loader2Icon className="size-3.5 animate-spin" />
                )}
                Save Blend
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Style Inspector */}
      <StyleInspector
        style={inspectStyle}
        open={inspectOpen}
        onOpenChange={(open) => {
          setInspectOpen(open);
          if (!open) setInspectStyle(null);
        }}
        onRemix={() => {
          if (inspectStyle) {
            const styleId = inspectStyle.id;
            setInspectOpen(false);
            setInspectStyle(null);
            handleRemix(styleId);
          }
        }}
        onBlend={() => {
          if (inspectStyle) {
            const styleId = inspectStyle.id;
            setInspectOpen(false);
            setInspectStyle(null);
            handleBlendStart(styleId);
          }
        }}
      />
    </div>
  );
}
