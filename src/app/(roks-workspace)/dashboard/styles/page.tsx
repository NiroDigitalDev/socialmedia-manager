"use client";

import { useState, useCallback } from "react";
import {
  useStyles,
  useCreateStyle,
  useDeleteStyle,
  useGenerateStylePreview,
  useSeedStyles,
  useStyleFromImage,
} from "@/hooks/use-styles";
import { StyleCard } from "@/components/style-card";
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
} from "lucide-react";
import { toast } from "sonner";

export default function StylesPage() {
  const { data: styles, isLoading } = useStyles();
  const createStyle = useCreateStyle();
  const deleteStyle = useDeleteStyle();
  const generatePreview = useGenerateStylePreview();
  const seedStyles = useSeedStyles();
  const styleFromImage = useStyleFromImage();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Create form state -- From Text tab
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPromptText, setNewPromptText] = useState("");
  const [previewImageIds, setPreviewImageIds] = useState<string[]>([]);

  // Create form state -- From Image tab
  const [imgName, setImgName] = useState("");
  const [imgDescription, setImgDescription] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [analyzedPrompt, setAnalyzedPrompt] = useState("");
  const [imgPreviewIds, setImgPreviewIds] = useState<string[]>([]);

  const hasPredefined = styles?.some((s) => s.isPredefined) ?? false;

  const resetForm = useCallback(() => {
    setNewName("");
    setNewDescription("");
    setNewPromptText("");
    setPreviewImageIds([]);
    setImgName("");
    setImgDescription("");
    setUploadedFile(null);
    setUploadPreview(null);
    setAnalyzedPrompt("");
    setImgPreviewIds([]);
  }, []);

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
          setPreviewImageIds(data.sampleImageIds);
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
        onSuccess: () => {
          toast.success("Style created");
          resetForm();
          setCreateOpen(false);
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
            setImgPreviewIds(data.sampleImageIds);
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
          analyzedPrompt ||
          "Custom style from reference image",
      },
      {
        onSuccess: () => {
          toast.success("Style created from image");
          resetForm();
          setCreateOpen(false);
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

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Styles</h1>
          <p className="text-sm text-muted-foreground">
            Manage visual styles for content generation. Select styles in the
            generate flow to influence how your posts look.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!hasPredefined && !isLoading && (
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
          )}
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

      {/* Loading skeleton grid */}
      {isLoading && (
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
            {styles.map((style) => (
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
                  <StyleCard style={style} />
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Style</DialogTitle>
            <DialogDescription>
              Define a visual style by writing a prompt or uploading a reference
              image.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="text" className="mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="text" className="flex-1 gap-1.5">
                <PaletteIcon className="size-3.5" />
                From Text
              </TabsTrigger>
              <TabsTrigger value="image" className="flex-1 gap-1.5">
                <UploadIcon className="size-3.5" />
                From Image
              </TabsTrigger>
            </TabsList>

            {/* FROM TEXT TAB */}
            <TabsContent value="text" className="space-y-4 mt-4">
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
                  Description{" "}
                  <span className="text-muted-foreground">(optional)</span>
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
                  rows={5}
                  className="resize-none"
                />
              </div>

              {/* Preview area */}
              {previewImageIds.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Preview
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {previewImageIds.map((imgId) => (
                      <img
                        key={imgId}
                        src={`/api/images/${imgId}?type=stored`}
                        alt="Style preview"
                        className="aspect-square rounded-lg object-cover"
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={handleGeneratePreview}
                  disabled={
                    generatePreview.isPending || !newPromptText.trim()
                  }
                  className="gap-1.5"
                >
                  {generatePreview.isPending ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <SparklesIcon className="size-3.5" />
                  )}
                  Generate Preview
                </Button>
                <Button
                  onClick={handleSaveFromText}
                  disabled={
                    createStyle.isPending ||
                    !newName.trim() ||
                    !newPromptText.trim()
                  }
                  className="gap-1.5 flex-1"
                >
                  {createStyle.isPending && (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  )}
                  Save Style
                </Button>
              </div>
            </TabsContent>

            {/* FROM IMAGE TAB */}
            <TabsContent value="image" className="space-y-4 mt-4">
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
                  Description{" "}
                  <span className="text-muted-foreground">(optional)</span>
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
                className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors hover:border-primary/50"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                {uploadPreview ? (
                  <div className="space-y-2 text-center">
                    <img
                      src={uploadPreview}
                      alt="Uploaded reference"
                      className="mx-auto max-h-40 rounded-lg object-contain"
                    />
                    <p className="text-xs text-muted-foreground">
                      {uploadedFile?.name}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setUploadedFile(null);
                        setUploadPreview(null);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <>
                    <UploadIcon className="size-8 text-muted-foreground/40" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      Drag & drop an image here
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      or click to browse
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 cursor-pointer opacity-0"
                      style={{ position: "relative" }}
                    />
                  </>
                )}
              </div>

              {/* Analyzed result */}
              {analyzedPrompt && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Extracted Style Description
                  </Label>
                  <p className="rounded-lg border bg-muted/30 p-3 text-sm">
                    {analyzedPrompt}
                  </p>
                </div>
              )}

              {imgPreviewIds.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Generated Samples
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {imgPreviewIds.map((imgId) => (
                      <img
                        key={imgId}
                        src={`/api/images/${imgId}?type=stored`}
                        alt="Sample"
                        className="aspect-square rounded-lg object-cover"
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
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
                  {createStyle.isPending && (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  )}
                  Save Style
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
