"use client";

import { use, useState, useRef, useCallback } from "react";
import {
  FileTextIcon,
  PlusIcon,
  TrashIcon,
  BookmarkIcon,
  Trash2Icon,
  FilterIcon,
  SparklesIcon,
  Loader2Icon,
  UploadIcon,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/empty-state";
import { ContentSourceSkeleton, ContentIdeaSkeleton } from "@/components/skeletons";
import {
  useSources,
  useCreateSource,
  useDeleteSource,
  useIdeas,
  useToggleIdeaSave,
  useBulkDeleteIdeas,
  useGenerateIdeas,
  useParseFile,
  useCreateSourceFromFile,
} from "@/hooks/use-content";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const ACCEPTED_MIMES = ["application/pdf", "text/plain", "text/markdown", "text/x-markdown"];

export default function ContentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const parseFile = useParseFile();
  const createFromFile = useCreateSourceFromFile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      const isText = file.name.match(/\.(md|txt|markdown)$/i);
      if (!ACCEPTED_MIMES.includes(file.type) && !isText) {
        toast.error("Unsupported file type. Use PDF, Markdown, or plain text.");
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error("File too large. Maximum 20MB.");
        return;
      }

      const toastId = toast.loading(`Parsing ${file.name}...`);

      try {
        let text: string;

        if (file.type === "text/plain" || isText) {
          text = await file.text();
        } else {
          const result = await parseFile.mutateAsync(file);
          text = result.text;
          if (result.pageCount) {
            toast.loading(`Extracted ${result.pageCount} pages — creating source...`, { id: toastId });
          }
        }

        if (!text.trim()) {
          toast.error("File is empty", { id: toastId });
          return;
        }

        toast.loading("AI is generating title & description...", { id: toastId });
        await createFromFile.mutateAsync({
          rawText: text.trim(),
          fileName: file.name,
          projectId: id,
        });

        toast.success(`Source created from ${file.name}`, { id: toastId });
      } catch {
        toast.error(`Failed to process ${file.name}`, { id: toastId });
      }
    },
    [id, parseFile, createFromFile]
  );

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  return (
    <div
      className="@container/main relative flex flex-1 flex-col gap-6 py-4 md:py-6"
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Full-page drag overlay */}
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/5 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <UploadIcon className="size-10 text-primary" />
            <p className="text-sm font-medium text-primary">Drop PDF, Markdown, or text file</p>
          </div>
        </div>
      )}

      {/* Hidden file input for browse button */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.md,.txt,.markdown"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processFile(file);
          e.target.value = "";
        }}
      />

      <Tabs defaultValue="sources" className="px-4 lg:px-6">
        <TabsList>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="ideas">Ideas</TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="mt-4">
          <SourcesTab projectId={id} onUploadClick={() => fileInputRef.current?.click()} />
        </TabsContent>

        <TabsContent value="ideas" className="mt-4">
          <IdeasTab projectId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SourcesTab({ projectId, onUploadClick }: { projectId: string; onUploadClick: () => void }) {
  const { data: sources, isLoading, isError } = useSources(projectId);
  const createSource = useCreateSource();
  const deleteSource = useDeleteSource();
  const generateIdeas = useGenerateIdeas();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [rawText, setRawText] = useState("");
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  const [deletingSourceTitle, setDeletingSourceTitle] = useState("");
  const [generatingSourceId, setGeneratingSourceId] = useState<string | null>(null);

  const handleCreate = () => {
    if (!title.trim() || !rawText.trim()) return;
    createSource.mutate(
      { title: title.trim(), rawText: rawText.trim(), projectId },
      {
        onSuccess: () => {
          setOpen(false);
          setTitle("");
          setRawText("");
        },
        onError: (err) => toast.error(err.message ?? "Operation failed"),
      }
    );
  };

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-sm text-muted-foreground">Failed to load data. Please try again.</p>
        <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <ContentSourceSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onUploadClick}>
          <UploadIcon className="mr-2 size-4" />
          Upload File
        </Button>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setTitle(""); setRawText(""); } }}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="mr-2 size-4" />
              Paste Text
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Content Source</DialogTitle>
              <DialogDescription>
                Paste text content that will be used to generate ideas.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="source-title">Title</Label>
                <Input
                  id="source-title"
                  placeholder="e.g. Blog post about AI trends"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="source-text">Content</Label>
                <Textarea
                  id="source-text"
                  placeholder="Paste your content here..."
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={8}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={!title.trim() || !rawText.trim() || createSource.isPending}
              >
                {createSource.isPending ? "Adding..." : "Add Source"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {sources && sources.length > 0 ? (
        <div className="grid gap-4 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
          {sources.map((source) => (
            <Card
              key={source.id}
              className="bg-gradient-to-t from-primary/5 to-card dark:bg-card"
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="line-clamp-1 text-base">
                    {source.title}
                  </CardTitle>
                  <Badge variant="secondary" className="ml-2 shrink-0 tabular-nums">
                    {source._count.ideas} ideas
                  </Badge>
                </div>
                <CardDescription className="line-clamp-2">
                  {source.rawText}
                </CardDescription>
              </CardHeader>
              <CardFooter className="justify-between">
                <span className="text-xs text-muted-foreground">
                  {new Date(source.createdAt).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-1.5"
                    disabled={generateIdeas.isPending && generatingSourceId === source.id}
                    onClick={() => {
                      setGeneratingSourceId(source.id);
                      const toastId = toast.loading(`Generating ideas from "${source.title}"...`);
                      generateIdeas.mutate(
                        { sourceId: source.id, projectId },
                        {
                          onSuccess: (data) => {
                            setGeneratingSourceId(null);
                            toast.success(`Generated ${data.count} ideas`, { id: toastId });
                          },
                          onError: (err) => {
                            setGeneratingSourceId(null);
                            toast.error(err.message ?? "Failed to generate ideas", { id: toastId });
                          },
                        }
                      );
                    }}
                  >
                    {generateIdeas.isPending && generatingSourceId === source.id ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : (
                      <SparklesIcon className="size-3.5" />
                    )}
                    {generateIdeas.isPending && generatingSourceId === source.id
                      ? "Generating..."
                      : "Generate Ideas"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      setDeletingSourceId(source.id);
                      setDeletingSourceTitle(source.title);
                    }}
                    disabled={deleteSource.isPending}
                  >
                    <TrashIcon className="size-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FileTextIcon}
          title="No content sources yet"
          description="Drop a PDF, Markdown, or text file anywhere on this page — or paste text manually."
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={onUploadClick}>
                <UploadIcon className="mr-2 size-4" />
                Upload File
              </Button>
              <Button onClick={() => setOpen(true)}>
                <PlusIcon className="mr-2 size-4" />
                Paste Text
              </Button>
            </div>
          }
        />
      )}

      {/* Delete Source Confirmation */}
      <AlertDialog open={!!deletingSourceId} onOpenChange={(open) => { if (!open) setDeletingSourceId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete content source?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{deletingSourceTitle}&rdquo; and all generated
              ideas from this source. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!deletingSourceId) return;
                deleteSource.mutate(
                  { id: deletingSourceId },
                  {
                    onSuccess: () => {
                      setDeletingSourceId(null);
                      toast.success("Content source deleted");
                    },
                    onError: (err) => toast.error(err.message ?? "Operation failed"),
                  }
                );
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function IdeasTab({ projectId }: { projectId: string }) {
  const [contentTypeFilter, setContentTypeFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: ideas, isLoading, isError } = useIdeas({
    projectId,
    contentType: contentTypeFilter === "all" ? undefined : contentTypeFilter,
  });
  const toggleSave = useToggleIdeaSave();
  const bulkDelete = useBulkDeleteIdeas();

  const contentTypes = ideas
    ? [...new Set(ideas.map((i) => i.contentType))]
    : [];

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!ideas) return;
    if (selectedIds.size === ideas.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(ideas.map((i) => i.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    bulkDelete.mutate(
      { ids: [...selectedIds] },
      {
        onSuccess: () => setSelectedIds(new Set()),
        onError: (err) => toast.error(err.message ?? "Operation failed"),
      }
    );
  };

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-sm text-muted-foreground">Failed to load data. Please try again.</p>
        <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ContentIdeaSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <FilterIcon className="size-4 text-muted-foreground" />
          <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {contentTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {ideas && ideas.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
              {selectedIds.size === ideas.length ? "Deselect all" : "Select all"}
            </Button>
            {selectedIds.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={bulkDelete.isPending}
              >
                <Trash2Icon className="mr-2 size-4" />
                Delete {selectedIds.size}
              </Button>
            )}
          </div>
        )}
      </div>

      {ideas && ideas.length > 0 ? (
        <div className="grid gap-4 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
          {ideas.map((idea) => (
            <Card
              key={idea.id}
              className={cn(
                "bg-gradient-to-t from-primary/5 to-card dark:bg-card",
                selectedIds.has(idea.id) && "ring-2 ring-primary"
              )}
            >
              <CardHeader>
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedIds.has(idea.id)}
                    onCheckedChange={() => toggleSelect(idea.id)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <CardDescription className="line-clamp-3">
                      {idea.ideaText}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{idea.contentType}</Badge>
                  <Badge variant="outline">{idea.format}</Badge>
                  {idea.source && (
                    <Badge variant="outline" className="max-w-32 truncate">
                      {idea.source.title}
                    </Badge>
                  )}
                </div>
              </CardContent>
              <CardFooter className="justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSave.mutate({ id: idea.id }, { onError: (err) => toast.error(err.message ?? "Operation failed") })}
                  disabled={toggleSave.isPending}
                >
                  <BookmarkIcon
                    className={cn(
                      "size-4",
                      idea.isSaved && "fill-current text-primary"
                    )}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() =>
                    bulkDelete.mutate(
                      { ids: [idea.id] },
                      { onError: (err) => toast.error(err.message ?? "Failed to delete idea") }
                    )
                  }
                  disabled={bulkDelete.isPending}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FileTextIcon}
          title="No ideas yet"
          description={
            contentTypeFilter !== "all"
              ? "No ideas match the selected filter. Try a different content type."
              : "Ideas will appear here once content sources are processed."
          }
        />
      )}
    </div>
  );
}
