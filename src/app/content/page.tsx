"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Sparkles,
  Trash2,
  Bookmark,
  BookmarkCheck,
  ArrowLeft,
  Loader2,
  ImagePlus,
  FileText,
  Layers,
} from "lucide-react";

// Types
interface ContentSource {
  id: string;
  title: string;
  rawText: string;
  createdAt: string;
  _count: { ideas: number };
}

interface ContentIdea {
  id: string;
  sourceId: string;
  ideaText: string;
  contentType: string;
  format: string;
  slideCount: number;
  isSaved: boolean;
  createdAt: string;
  source?: { title: string };
}

const CONTENT_TYPES = [
  "promotional",
  "educational",
  "social_proof",
  "tips_and_tricks",
  "behind_the_scenes",
  "motivational",
  "how_to",
  "faq",
  "comparison",
  "announcement",
  "ugc_prompt",
  "seasonal",
  "story_based",
  "statistics",
];

const contentTypeColors: Record<string, string> = {
  promotional: "default",
  educational: "secondary",
  social_proof: "outline",
  tips_and_tricks: "secondary",
  behind_the_scenes: "outline",
  motivational: "default",
  how_to: "secondary",
  faq: "outline",
  comparison: "default",
  announcement: "secondary",
  ugc_prompt: "outline",
  seasonal: "default",
  story_based: "secondary",
  statistics: "outline",
};

function formatContentType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Source Card ─────────────────────────────────────────────────────────────

function SourceCard({
  source,
  onDelete,
  onGenerateIdeas,
  onViewIdeas,
}: {
  source: ContentSource;
  onDelete: (id: string) => void;
  onGenerateIdeas: (source: ContentSource) => void;
  onViewIdeas: (source: ContentSource) => void;
}) {
  const truncatedText =
    source.rawText.length > 100
      ? source.rawText.substring(0, 100) + "..."
      : source.rawText;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{source.title}</CardTitle>
            <CardDescription className="text-xs mt-1">
              {formatDate(source.createdAt)}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDelete(source.id)}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {truncatedText}
        </p>
        <div className="flex items-center gap-1 mt-2">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {source._count.ideas} idea{source._count.ideas !== 1 ? "s" : ""}
          </span>
        </div>
      </CardContent>
      <CardFooter className="gap-2 pt-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => onViewIdeas(source)}
        >
          View Ideas
        </Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={() => onGenerateIdeas(source)}
        >
          <Sparkles className="h-4 w-4 mr-1" />
          Generate Ideas
        </Button>
      </CardFooter>
    </Card>
  );
}

// ─── Idea Card ──────────────────────────────────────────────────────────────

function IdeaCard({
  idea,
  onToggleSave,
  onDelete,
}: {
  idea: ContentIdea;
  onToggleSave: (id: string, isSaved: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();

  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-sm leading-relaxed mb-3">{idea.ideaText}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              (contentTypeColors[idea.contentType] as "default" | "secondary" | "outline") ||
              "default"
            }
          >
            {formatContentType(idea.contentType)}
          </Badge>
          <Badge variant={idea.format === "carousel" ? "secondary" : "outline"}>
            {idea.format === "carousel" ? (
              <span className="flex items-center gap-1">
                <Layers className="h-3 w-3" />
                Carousel ({idea.slideCount})
              </span>
            ) : (
              "Static"
            )}
          </Badge>
          {idea.source && (
            <span className="text-xs text-muted-foreground ml-auto">
              From: {idea.source.title}
            </span>
          )}
        </div>
      </CardContent>
      <CardFooter className="gap-2 pt-0">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onToggleSave(idea.id, !idea.isSaved)}
        >
          {idea.isSaved ? (
            <BookmarkCheck className="h-4 w-4 mr-1 text-primary" />
          ) : (
            <Bookmark className="h-4 w-4 mr-1" />
          )}
          {idea.isSaved ? "Saved" : "Save"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            router.push(`/generate?ideaId=${idea.id}`)
          }
        >
          <ImagePlus className="h-4 w-4 mr-1" />
          Generate Post
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          onClick={() => onDelete(idea.id)}
        >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </CardFooter>
    </Card>
  );
}

// ─── Loading Skeletons ──────────────────────────────────────────────────────

function SourceCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-1/4 mt-1" />
      </CardHeader>
      <CardContent className="pb-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3 mt-1" />
        <Skeleton className="h-3 w-1/4 mt-2" />
      </CardContent>
      <CardFooter className="gap-2 pt-2">
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 flex-1" />
      </CardFooter>
    </Card>
  );
}

function IdeaCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full mt-1" />
        <Skeleton className="h-4 w-2/3 mt-1" />
        <div className="flex gap-2 mt-3">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-16" />
        </div>
      </CardContent>
      <CardFooter className="gap-2 pt-0">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-28" />
      </CardFooter>
    </Card>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ContentPage() {
  const [sources, setSources] = useState<ContentSource[]>([]);
  const [savedIdeas, setSavedIdeas] = useState<ContentIdea[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [savedIdeasLoading, setSavedIdeasLoading] = useState(true);

  // Add source dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newRawText, setNewRawText] = useState("");
  const [addingSource, setAddingSource] = useState(false);

  // Generate ideas dialog
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generateSource, setGenerateSource] = useState<ContentSource | null>(null);
  const [selectedContentTypes, setSelectedContentTypes] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

  // Ideas view (shown after generating or viewing a source's ideas)
  const [viewingSource, setViewingSource] = useState<ContentSource | null>(null);
  const [sourceIdeas, setSourceIdeas] = useState<ContentIdea[]>([]);
  const [sourceIdeasLoading, setSourceIdeasLoading] = useState(false);
  const [ideaTypeFilter, setIdeaTypeFilter] = useState<string>("all");

  // ─── Data Fetching ──────────────────────────────────────────────────────

  const fetchSources = useCallback(async () => {
    try {
      setSourcesLoading(true);
      const res = await fetch("/api/content/sources");
      if (!res.ok) throw new Error("Failed to fetch sources");
      const data = await res.json();
      setSources(data);
    } catch {
      toast.error("Failed to load content sources");
    } finally {
      setSourcesLoading(false);
    }
  }, []);

  const fetchSavedIdeas = useCallback(async () => {
    try {
      setSavedIdeasLoading(true);
      const res = await fetch("/api/content/ideas");
      if (!res.ok) throw new Error("Failed to fetch saved ideas");
      const data = await res.json();
      setSavedIdeas(data);
    } catch {
      toast.error("Failed to load saved ideas");
    } finally {
      setSavedIdeasLoading(false);
    }
  }, []);

  const fetchSourceIdeas = useCallback(async (sourceId: string) => {
    try {
      setSourceIdeasLoading(true);
      const res = await fetch(`/api/content/sources/${sourceId}`);
      if (!res.ok) throw new Error("Failed to fetch source ideas");
      const data = await res.json();
      setSourceIdeas(data.ideas || []);
    } catch {
      toast.error("Failed to load ideas for this source");
    } finally {
      setSourceIdeasLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSources();
    fetchSavedIdeas();
  }, [fetchSources, fetchSavedIdeas]);

  // ─── Actions ────────────────────────────────────────────────────────────

  const handleAddSource = async () => {
    if (!newTitle.trim() || !newRawText.trim()) {
      toast.error("Please provide both a title and content text");
      return;
    }

    setAddingSource(true);
    try {
      const res = await fetch("/api/content/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), rawText: newRawText.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create source");
      const source = await res.json();
      setSources((prev) => [source, ...prev]);
      setAddDialogOpen(false);
      setNewTitle("");
      setNewRawText("");
      toast.success("Content source added");
    } catch {
      toast.error("Failed to add content source");
    } finally {
      setAddingSource(false);
    }
  };

  const handleDeleteSource = async (id: string) => {
    try {
      const res = await fetch(`/api/content/sources/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete source");
      setSources((prev) => prev.filter((s) => s.id !== id));
      if (viewingSource?.id === id) {
        setViewingSource(null);
        setSourceIdeas([]);
      }
      toast.success("Content source deleted");
    } catch {
      toast.error("Failed to delete content source");
    }
  };

  const openGenerateDialog = (source: ContentSource) => {
    setGenerateSource(source);
    setSelectedContentTypes([]);
    setGenerateDialogOpen(true);
  };

  const handleGenerateIdeas = async () => {
    if (!generateSource) return;

    setGenerating(true);
    try {
      const res = await fetch("/api/content/ideas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: generateSource.id,
          contentTypes: selectedContentTypes.length > 0 ? selectedContentTypes : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate ideas");
      }
      const ideas = await res.json();
      setSourceIdeas(ideas);
      setViewingSource(generateSource);
      setGenerateDialogOpen(false);
      // Update the source's idea count in the list
      setSources((prev) =>
        prev.map((s) =>
          s.id === generateSource.id
            ? { ...s, _count: { ideas: s._count.ideas + ideas.length } }
            : s
        )
      );
      toast.success(`Generated ${ideas.length} content ideas`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate ideas"
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleViewIdeas = (source: ContentSource) => {
    setViewingSource(source);
    setIdeaTypeFilter("all");
    fetchSourceIdeas(source.id);
  };

  const handleToggleSave = async (id: string, isSaved: boolean) => {
    try {
      const res = await fetch(`/api/content/ideas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSaved }),
      });
      if (!res.ok) throw new Error("Failed to update idea");

      // Update in source ideas view
      setSourceIdeas((prev) =>
        prev.map((idea) => (idea.id === id ? { ...idea, isSaved } : idea))
      );
      // Update in saved ideas list
      if (isSaved) {
        const updated = await res.json();
        setSavedIdeas((prev) => [updated, ...prev]);
      } else {
        setSavedIdeas((prev) => prev.filter((idea) => idea.id !== id));
      }
      toast.success(isSaved ? "Idea saved" : "Idea unsaved");
    } catch {
      toast.error("Failed to update idea");
    }
  };

  const handleDeleteIdea = async (id: string) => {
    try {
      const res = await fetch(`/api/content/ideas/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete idea");
      setSourceIdeas((prev) => prev.filter((idea) => idea.id !== id));
      setSavedIdeas((prev) => prev.filter((idea) => idea.id !== id));
      // Decrement the idea count
      if (viewingSource) {
        setSources((prev) =>
          prev.map((s) =>
            s.id === viewingSource.id
              ? { ...s, _count: { ideas: Math.max(0, s._count.ideas - 1) } }
              : s
          )
        );
      }
      toast.success("Idea deleted");
    } catch {
      toast.error("Failed to delete idea");
    }
  };

  const toggleContentType = (type: string) => {
    setSelectedContentTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  // ─── Filtered ideas ────────────────────────────────────────────────────

  const filteredSourceIdeas =
    ideaTypeFilter === "all"
      ? sourceIdeas
      : sourceIdeas.filter((idea) => idea.contentType === ideaTypeFilter);

  // ─── Ideas View (when viewing a source's ideas) ────────────────────────

  if (viewingSource) {
    const uniqueTypes = Array.from(new Set(sourceIdeas.map((i) => i.contentType)));
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setViewingSource(null);
              setSourceIdeas([]);
              setIdeaTypeFilter("all");
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold truncate">
              {viewingSource.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {sourceIdeas.length} idea{sourceIdeas.length !== 1 ? "s" : ""} generated
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => openGenerateDialog(viewingSource)}
          >
            <Sparkles className="h-4 w-4 mr-1" />
            Generate More
          </Button>
        </div>

        {/* Filter by content type */}
        {uniqueTypes.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={ideaTypeFilter === "all" ? "default" : "outline"}
              onClick={() => setIdeaTypeFilter("all")}
            >
              All
            </Button>
            {uniqueTypes.map((type) => (
              <Button
                key={type}
                size="sm"
                variant={ideaTypeFilter === type ? "default" : "outline"}
                onClick={() => setIdeaTypeFilter(type)}
              >
                {formatContentType(type)}
              </Button>
            ))}
          </div>
        )}

        {/* Ideas list */}
        {sourceIdeasLoading ? (
          <div className="grid gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <IdeaCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredSourceIdeas.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No ideas found. Try generating some!
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredSourceIdeas.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                onToggleSave={handleToggleSave}
                onDelete={handleDeleteIdea}
              />
            ))}
          </div>
        )}

        {/* Generate dialog (reused) */}
        <GenerateDialog
          open={generateDialogOpen}
          onOpenChange={setGenerateDialogOpen}
          sourceName={generateSource?.title || ""}
          selectedContentTypes={selectedContentTypes}
          onToggleContentType={toggleContentType}
          generating={generating}
          onGenerate={handleGenerateIdeas}
        />
      </div>
    );
  }

  // ─── Main View (tabs) ─────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Content Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your content sources and AI-generated ideas
          </p>
        </div>
      </div>

      <Tabs defaultValue="sources">
        <TabsList>
          <TabsTrigger value="sources">Content Sources</TabsTrigger>
          <TabsTrigger value="saved">Saved Ideas</TabsTrigger>
        </TabsList>

        {/* ─── Content Sources Tab ───────────────────────────────────────── */}
        <TabsContent value="sources" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger
                render={
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Content
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add Content Source</DialogTitle>
                  <DialogDescription>
                    Paste your content below. AI will generate social media ideas from it.
                  </DialogDescription>
                </DialogHeader>
                <div className="overflow-y-auto px-4 py-2">
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        placeholder="e.g., Blog Post: 10 Tips for..."
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="rawText">Content</Label>
                      <Textarea
                        id="rawText"
                        placeholder="Paste your article, blog post, product description, or any content here..."
                        className="min-h-[200px]"
                        value={newRawText}
                        onChange={(e) => setNewRawText(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleAddSource}
                    disabled={addingSource || !newTitle.trim() || !newRawText.trim()}
                  >
                    {addingSource && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    {addingSource ? "Adding..." : "Add Source"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {sourcesLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <SourceCardSkeleton key={i} />
              ))}
            </div>
          ) : sources.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No content sources yet</p>
                <p className="text-sm mt-1">
                  Add your first piece of content to start generating ideas.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {sources.map((source) => (
                <SourceCard
                  key={source.id}
                  source={source}
                  onDelete={handleDeleteSource}
                  onGenerateIdeas={openGenerateDialog}
                  onViewIdeas={handleViewIdeas}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Saved Ideas Tab ───────────────────────────────────────────── */}
        <TabsContent value="saved" className="mt-4 space-y-4">
          {savedIdeasLoading ? (
            <div className="grid gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <IdeaCardSkeleton key={i} />
              ))}
            </div>
          ) : savedIdeas.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Bookmark className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No saved ideas yet</p>
                <p className="text-sm mt-1">
                  Generate ideas from your content sources and save the ones you like.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {savedIdeas.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  onToggleSave={handleToggleSave}
                  onDelete={handleDeleteIdea}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Generate Ideas Dialog */}
      <GenerateDialog
        open={generateDialogOpen}
        onOpenChange={setGenerateDialogOpen}
        sourceName={generateSource?.title || ""}
        selectedContentTypes={selectedContentTypes}
        onToggleContentType={toggleContentType}
        generating={generating}
        onGenerate={handleGenerateIdeas}
      />
    </div>
  );
}

// ─── Generate Dialog Component ──────────────────────────────────────────────

function GenerateDialog({
  open,
  onOpenChange,
  sourceName,
  selectedContentTypes,
  onToggleContentType,
  generating,
  onGenerate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceName: string;
  selectedContentTypes: string[];
  onToggleContentType: (type: string) => void;
  generating: boolean;
  onGenerate: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Content Ideas</DialogTitle>
          <DialogDescription>
            Generate AI-powered content ideas from &ldquo;{sourceName}&rdquo;
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto px-4 py-2">
          <div>
            <Label className="text-sm font-medium">
              Content Types{" "}
              <span className="text-muted-foreground font-normal">
                (leave empty for all types)
              </span>
            </Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {CONTENT_TYPES.map((type) => (
                <label
                  key={type}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={selectedContentTypes.includes(type)}
                    onCheckedChange={() => onToggleContentType(type)}
                  />
                  {formatContentType(type)}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onGenerate} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-1" />
                Generate Ideas
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
