"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useCreateSourceNode } from "@/hooks/use-lab";
import { useSources, useParseFile } from "@/hooks/use-content";
import { toast } from "sonner";
import {
  FileTextIcon,
  UploadIcon,
  LibraryIcon,
  SearchIcon,
  Loader2Icon,
  CheckIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SourceUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  treeId: string;
  projectId: string;
}

export function SourceUploadDialog({
  open,
  onOpenChange,
  treeId,
  projectId,
}: SourceUploadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Source</DialogTitle>
          <DialogDescription>
            Add source material for content generation. Paste text, upload a
            file, or pick from your library.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="paste" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="paste" className="flex-1 gap-1.5">
              <FileTextIcon className="size-3.5" />
              Paste Text
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex-1 gap-1.5">
              <UploadIcon className="size-3.5" />
              Upload File
            </TabsTrigger>
            <TabsTrigger value="library" className="flex-1 gap-1.5">
              <LibraryIcon className="size-3.5" />
              From Library
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paste">
            <PasteTab
              treeId={treeId}
              onSuccess={() => onOpenChange(false)}
            />
          </TabsContent>

          <TabsContent value="upload">
            <UploadTab
              treeId={treeId}
              onSuccess={() => onOpenChange(false)}
            />
          </TabsContent>

          <TabsContent value="library">
            <LibraryTab
              treeId={treeId}
              projectId={projectId}
              onSuccess={() => onOpenChange(false)}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ── Paste Text Tab ────────────────────────────────────────────────

function PasteTab({
  treeId,
  onSuccess,
}: {
  treeId: string;
  onSuccess: () => void;
}) {
  const [text, setText] = useState("");
  const createSource = useCreateSourceNode();

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;

    createSource.mutate(
      { treeId, text: trimmed },
      {
        onSuccess: () => {
          toast.success("Source node created");
          setText("");
          onSuccess();
        },
      }
    );
  }, [text, treeId, createSource, onSuccess]);

  return (
    <div className="space-y-4 pt-2">
      <Textarea
        placeholder="Paste your source text here..."
        className="min-h-[160px] resize-none"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={!text.trim() || createSource.isPending}
        >
          {createSource.isPending && (
            <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
          )}
          Add Source
        </Button>
      </div>
    </div>
  );
}

// ── Upload File Tab ───────────────────────────────────────────────

function UploadTab({
  treeId,
  onSuccess,
}: {
  treeId: string;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const parseFile = useParseFile();
  const createSource = useCreateSourceNode();

  const isPending = parseFile.isPending || createSource.isPending;

  const handleUpload = useCallback(() => {
    if (!file) return;

    parseFile.mutate(file, {
      onSuccess: (data) => {
        createSource.mutate(
          { treeId, text: data.text, fileName: file.name },
          {
            onSuccess: () => {
              toast.success("Source node created from file");
              setFile(null);
              onSuccess();
            },
          }
        );
      },
    });
  }, [file, treeId, parseFile, createSource, onSuccess]);

  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <Input
          type="file"
          accept=".pdf,.doc,.docx,.txt,.md"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file && (
          <p className="text-xs text-muted-foreground">
            Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </p>
        )}
      </div>
      <div className="flex justify-end">
        <Button onClick={handleUpload} disabled={!file || isPending}>
          {isPending && (
            <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
          )}
          {parseFile.isPending
            ? "Parsing..."
            : createSource.isPending
              ? "Creating..."
              : "Upload & Add"}
        </Button>
      </div>
    </div>
  );
}

// ── From Library Tab ──────────────────────────────────────────────

function LibraryTab({
  treeId,
  projectId,
  onSuccess,
}: {
  treeId: string;
  projectId: string;
  onSuccess: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: sources, isLoading } = useSources(projectId);
  const createSource = useCreateSourceNode();

  const filtered = (sources ?? []).filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  const selectedSource = sources?.find((s) => s.id === selectedId);

  const handleAdd = useCallback(() => {
    if (!selectedSource) return;

    createSource.mutate(
      { treeId, text: selectedSource.rawText },
      {
        onSuccess: () => {
          toast.success("Source node created from library");
          setSelectedId(null);
          onSuccess();
        },
      }
    );
  }, [selectedSource, treeId, createSource, onSuccess]);

  return (
    <div className="space-y-4 pt-2">
      {/* Search */}
      <div className="relative">
        <SearchIcon className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
        <Input
          placeholder="Search sources..."
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Source list */}
      <div className="max-h-[200px] overflow-y-auto space-y-1 rounded-md border p-1">
        {isLoading && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Loading sources...
          </p>
        )}

        {!isLoading && filtered.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {sources?.length === 0
              ? "No content sources in this project yet."
              : "No sources match your search."}
          </p>
        )}

        {filtered.map((source) => (
          <button
            key={source.id}
            type="button"
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
              selectedId === source.id && "bg-accent"
            )}
            onClick={() =>
              setSelectedId(selectedId === source.id ? null : source.id)
            }
          >
            {selectedId === source.id ? (
              <CheckIcon className="size-3.5 shrink-0 text-primary" />
            ) : (
              <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{source.title}</span>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {source.rawText.length.toLocaleString()} chars
            </span>
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleAdd}
          disabled={!selectedId || createSource.isPending}
        >
          {createSource.isPending && (
            <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
          )}
          Add Source
        </Button>
      </div>
    </div>
  );
}
