"use client";

import { useState } from "react";
import {
  ImageIcon,
  FileTextIcon,
  FileIcon,
  Trash2Icon,
  ExternalLinkIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

interface Asset {
  id: string;
  r2Key: string;
  mimeType: string;
  fileName: string;
  category: string;
  projectId: string | null;
  orgId: string;
  createdAt: string | Date;
  project?: { id: string; name: string } | null;
}

interface AssetGridProps {
  assets: Asset[];
  publicUrlBase: string;
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
  className?: string;
}

function getMimeLabel(mime: string): string {
  const map: Record<string, string> = {
    "image/png": "PNG",
    "image/jpeg": "JPEG",
    "image/svg+xml": "SVG",
    "image/webp": "WebP",
    "image/avif": "AVIF",
    "application/pdf": "PDF",
    "text/markdown": "Markdown",
  };
  return map[mime] || mime.split("/")[1]?.toUpperCase() || "File";
}

function isImageMime(mime: string): boolean {
  return mime.startsWith("image/");
}

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === "application/pdf") {
    return <FileTextIcon className="size-10 text-red-500/70" />;
  }
  if (mimeType === "text/markdown") {
    return <FileTextIcon className="size-10 text-blue-500/70" />;
  }
  return <FileIcon className="size-10 text-muted-foreground" />;
}

export function AssetGrid({
  assets,
  publicUrlBase,
  onDelete,
  isDeleting,
  className,
}: AssetGridProps) {
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [deletingAssetName, setDeletingAssetName] = useState("");

  const getUrl = (r2Key: string) =>
    `${publicUrlBase.replace(/\/$/, "")}/${r2Key}`;

  return (
    <>
      <div
        className={cn(
          "grid gap-4 @xs/main:grid-cols-2 @lg/main:grid-cols-3 @3xl/main:grid-cols-4 @5xl/main:grid-cols-5",
          className
        )}
      >
        {assets.map((asset) => {
          const url = getUrl(asset.r2Key);
          const isImage = isImageMime(asset.mimeType);

          return (
            <div
              key={asset.id}
              className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:bg-muted/50"
            >
              {/* Thumbnail / icon area */}
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative flex aspect-square items-center justify-center overflow-hidden bg-muted/30"
              >
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={asset.fileName}
                    className="size-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <FileTypeIcon mimeType={asset.mimeType} />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/20 group-hover:opacity-100">
                  <ExternalLinkIcon className="size-5 text-white drop-shadow" />
                </div>
              </a>

              {/* Info */}
              <div className="flex flex-1 flex-col gap-1.5 p-3">
                <p className="truncate text-sm font-medium" title={asset.fileName}>
                  {asset.fileName}
                </p>
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-xs">
                    {getMimeLabel(asset.mimeType)}
                  </Badge>
                  {asset.project && (
                    <Badge variant="outline" className="truncate text-xs">
                      {asset.project.name}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Delete button */}
              {onDelete && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute right-2 top-2 size-7 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingAssetId(asset.id);
                    setDeletingAssetName(asset.fileName);
                  }}
                  disabled={isDeleting}
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Delete Asset Confirmation */}
      {onDelete && (
        <AlertDialog open={!!deletingAssetId} onOpenChange={(open) => { if (!open) setDeletingAssetId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete asset?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete &ldquo;{deletingAssetName}&rdquo;.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  if (deletingAssetId) {
                    onDelete(deletingAssetId);
                    setDeletingAssetId(null);
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
