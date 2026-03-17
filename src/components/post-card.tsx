"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { cn } from "@/lib/utils";
import {
  InstagramIcon,
  LinkedinIcon,
  MessageSquareIcon,
  TwitterIcon,
  BookOpenIcon,
  MailIcon,
  ImageIcon,
} from "lucide-react";

const platformIcons: Record<string, React.ElementType> = {
  instagram: InstagramIcon,
  linkedin: LinkedinIcon,
  reddit: MessageSquareIcon,
  x: TwitterIcon,
  blog: BookOpenIcon,
  email: MailIcon,
};

function imgUrl(id: string) {
  return `/api/images/${id}?type=generated`;
}

export interface PostCardData {
  id: string;
  prompt: string;
  format: string;
  aspectRatio: string;
  model: string;
  status: string;
  description: string | null;
  platform: string | null;
  createdAt: string | Date;
  images: { id: string; slideNumber: number }[];
  style?: { name: string } | null;
  textContent?: string | null;
}

interface PostCardProps {
  post: PostCardData;
  onClick?: () => void;
  className?: string;
}

export function PostCard({ post, onClick, className }: PostCardProps) {
  const PlatformIcon = post.platform ? platformIcons[post.platform] : null;
  const firstImage = post.images[0];
  const isTextOnly = !firstImage && !!post.textContent;

  return (
    <Card
      className={cn(
        "group cursor-pointer overflow-hidden transition-all hover:shadow-md hover:scale-[1.02]",
        className
      )}
      onClick={onClick}
    >
      <div className="relative">
        <AspectRatio ratio={4 / 5}>
          {firstImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgUrl(firstImage.id)}
              alt={post.prompt.slice(0, 60)}
              className="size-full object-cover"
              loading="lazy"
            />
          ) : isTextOnly ? (
            <div className="flex size-full items-center justify-center bg-muted p-4">
              <p className="line-clamp-6 text-xs text-muted-foreground">
                {post.textContent}
              </p>
            </div>
          ) : (
            <div className="flex size-full items-center justify-center bg-muted">
              <ImageIcon className="size-8 text-muted-foreground/40" />
            </div>
          )}
        </AspectRatio>

        {/* Status badge overlay */}
        {post.status === "generating" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {/* Platform icon badge (top-left) */}
        {PlatformIcon && (
          <div className="absolute left-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white">
            <PlatformIcon className="size-3.5" />
          </div>
        )}

        {/* Style name badge (top-right) */}
        {post.style && (
          <Badge
            variant="secondary"
            className="absolute right-2 top-2 max-w-[120px] truncate bg-black/60 text-white hover:bg-black/60"
          >
            {post.style.name}
          </Badge>
        )}

        {/* Carousel slide count */}
        {post.images.length > 1 && (
          <Badge
            variant="secondary"
            className="absolute bottom-2 right-2 bg-black/60 text-white hover:bg-black/60"
          >
            {post.images.length} slides
          </Badge>
        )}
      </div>

      <CardContent className="space-y-1.5 p-3">
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {post.prompt}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-[10px]">
              {post.aspectRatio}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {post.model}
            </Badge>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {new Date(post.createdAt).toLocaleDateString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
