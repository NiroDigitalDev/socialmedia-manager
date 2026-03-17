"use client";

import Link from "next/link";
import { ArrowRightIcon, FolderIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/project-card";
import { EmptyState } from "@/components/empty-state";
import { ProjectCardSkeleton } from "@/components/skeletons";
import { useProjects } from "@/hooks/use-projects";

export default function DashboardPage() {
  const { data: projects, isLoading, isError } = useProjects();

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-sm text-muted-foreground">Failed to load data. Please try again.</p>
        <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-6 py-4 md:py-6">
      {/* Projects section */}
      <div className="px-4 lg:px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Projects</h2>
          {projects && projects.length > 0 && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/projects">
                View all
                <ArrowRightIcon className="ml-1 size-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @4xl/main:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : projects && projects.length > 0 ? (
        <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @4xl/main:grid-cols-3">
          {projects.slice(0, 6).map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FolderIcon}
          title="Welcome! Create your first project"
          description="Projects help you organize campaigns, brand identities, and generated content."
          action={
            <Button asChild>
              <Link href="/dashboard/projects?create=true">
                <PlusIcon className="mr-2 size-4" />
                Create Project
              </Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
