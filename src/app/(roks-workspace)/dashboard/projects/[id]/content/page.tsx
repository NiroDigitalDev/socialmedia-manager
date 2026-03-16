"use client";

import { use, useState } from "react";
import {
  FileTextIcon,
  PlusIcon,
  TrashIcon,
  BookmarkIcon,
  Trash2Icon,
  FilterIcon,
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
import {
  useSources,
  useCreateSource,
  useDeleteSource,
  useIdeas,
  useToggleIdeaSave,
  useBulkDeleteIdeas,
} from "@/hooks/use-content";
import { cn } from "@/lib/utils";

export default function ContentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="@container/main flex flex-1 flex-col gap-6 py-4 md:py-6">
      <div className="px-4 lg:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Content</h1>
        <p className="text-sm text-muted-foreground">
          Manage content sources and ideas for this project.
        </p>
      </div>

      <Tabs defaultValue="sources" className="px-4 lg:px-6">
        <TabsList>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="ideas">Ideas</TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="mt-4">
          <SourcesTab projectId={id} />
        </TabsContent>

        <TabsContent value="ideas" className="mt-4">
          <IdeasTab projectId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SourcesTab({ projectId }: { projectId: string }) {
  const { data: sources, isLoading } = useSources(projectId);
  const createSource = useCreateSource();
  const deleteSource = useDeleteSource();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [rawText, setRawText] = useState("");

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
      }
    );
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="mr-2 size-4" />
              Add Source
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => deleteSource.mutate({ id: source.id })}
                  disabled={deleteSource.isPending}
                >
                  <TrashIcon className="size-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FileTextIcon}
          title="No content sources yet"
          description="Add content sources like blog posts, articles, or notes to generate ideas from."
          action={
            <Button onClick={() => setOpen(true)}>
              <PlusIcon className="mr-2 size-4" />
              Add Source
            </Button>
          }
        />
      )}
    </div>
  );
}

function IdeasTab({ projectId }: { projectId: string }) {
  const [contentTypeFilter, setContentTypeFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: ideas, isLoading } = useIdeas({
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
      { onSuccess: () => setSelectedIds(new Set()) }
    );
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 @xl/main:grid-cols-2 @3xl/main:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl bg-muted" />
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
              <CardFooter className="justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSave.mutate({ id: idea.id })}
                  disabled={toggleSave.isPending}
                >
                  <BookmarkIcon
                    className={cn(
                      "size-4",
                      idea.isSaved && "fill-current text-primary"
                    )}
                  />
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
