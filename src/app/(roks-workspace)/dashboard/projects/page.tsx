"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { PlusIcon, FolderIcon } from "lucide-react";
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
import { ProjectCard } from "@/components/project-card";
import { EmptyState } from "@/components/empty-state";
import { useProjects, useCreateProject } from "@/hooks/use-projects";

export default function ProjectsPage() {
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setOpen(true);
    }
  }, [searchParams]);

  const handleCreate = () => {
    if (!name.trim()) return;
    createProject.mutate(
      { name: name.trim(), description: description.trim() || undefined },
      {
        onSuccess: () => {
          setOpen(false);
          setName("");
          setDescription("");
        },
      }
    );
  };

  return (
    <div className="@container/main flex flex-1 flex-col gap-6 py-4 md:py-6">
      <div className="flex items-center justify-between px-4 lg:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Manage your social media projects
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="mr-2 size-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Project</DialogTitle>
              <DialogDescription>
                A project groups campaigns, brand identities, and content together.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="project-name">Name</Label>
                <Input
                  id="project-name"
                  placeholder="e.g. Summer Campaign 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="project-description">Description</Label>
                <Textarea
                  id="project-description"
                  placeholder="What is this project about?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={!name.trim() || createProject.isPending}
              >
                {createProject.isPending ? "Creating..." : "Create Project"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @4xl/main:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-xl bg-muted"
            />
          ))}
        </div>
      ) : projects && projects.length > 0 ? (
        <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @4xl/main:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FolderIcon}
          title="No projects yet"
          description="Create your first project to start organizing campaigns and content."
          action={
            <Button onClick={() => setOpen(true)}>
              <PlusIcon className="mr-2 size-4" />
              Create Project
            </Button>
          }
        />
      )}
    </div>
  );
}
