"use client";

import { useCallback, useRef, useState } from "react";
import { UploadIcon, LoaderIcon, CheckCircleIcon, AlertCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUploadAsset } from "@/hooks/use-assets";

interface AssetUploadProps {
  category: "reference" | "asset";
  projectId?: string;
  className?: string;
}

const ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
  "image/avif",
  "application/pdf",
  "text/markdown",
];

const ACCEPT_STRING = ACCEPTED_TYPES.join(",");

export function AssetUpload({ category, projectId, className }: AssetUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadAsset();

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      for (const file of Array.from(files)) {
        upload.mutate({ file, category, projectId });
      }
    },
    [upload, category, projectId]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
        isDragOver
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50",
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_STRING}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {upload.isPending ? (
        <>
          <LoaderIcon className="size-8 animate-spin text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Uploading...</p>
          </div>
        </>
      ) : upload.isSuccess ? (
        <>
          <CheckCircleIcon className="size-8 text-green-500" />
          <div>
            <p className="text-sm font-medium">Upload complete</p>
            <p className="text-xs text-muted-foreground">Drop or click to upload more</p>
          </div>
        </>
      ) : upload.isError ? (
        <>
          <AlertCircleIcon className="size-8 text-destructive" />
          <div>
            <p className="text-sm font-medium text-destructive">
              {upload.error?.message || "Upload failed"}
            </p>
            <p className="text-xs text-muted-foreground">Try again</p>
          </div>
        </>
      ) : (
        <>
          <UploadIcon className="size-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Drop files here or click to browse</p>
            <p className="text-xs text-muted-foreground">
              PNG, JPEG, SVG, WebP, AVIF, PDF, Markdown (max 20 MB)
            </p>
          </div>
        </>
      )}
    </div>
  );
}
