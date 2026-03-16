"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FavoriteStar } from "@/components/favorite-star";

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    description?: string | null;
    color?: string | null;
    createdAt: string | Date;
    _count: { campaigns: number; posts: number };
  };
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link href={`/dashboard/projects/${project.id}`}>
      <Card className="group relative transition-colors hover:bg-muted/50">
        <div
          className="absolute inset-x-0 top-0 h-1 rounded-t-xl"
          style={{ backgroundColor: project.color ?? "#737373" }}
        />
        <CardHeader className="pt-5">
          <div className="flex items-start justify-between">
            <CardTitle className="line-clamp-1 text-base">{project.name}</CardTitle>
            <FavoriteStar targetType="project" targetId={project.id} />
          </div>
          {project.description && (
            <CardDescription className="line-clamp-2">{project.description}</CardDescription>
          )}
        </CardHeader>
        <CardFooter className="gap-2">
          <Badge variant="outline" className="tabular-nums">
            {project._count.campaigns} campaigns
          </Badge>
          <Badge variant="outline" className="tabular-nums">
            {project._count.posts} generations
          </Badge>
        </CardFooter>
      </Card>
    </Link>
  );
}
