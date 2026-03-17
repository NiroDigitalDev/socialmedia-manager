"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontalIcon, PencilIcon, TrashIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { FavoriteStar } from "@/components/favorite-star";
import { useUpdateProject, useDeleteProject } from "@/hooks/use-projects";
import { toast } from "sonner";

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
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [editDescription, setEditDescription] = useState(project.description ?? "");
  const [editColor, setEditColor] = useState(project.color ?? "#737373");

  const handleEdit = () => {
    if (!editName.trim()) return;
    updateProject.mutate(
      {
        id: project.id,
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        color: editColor,
      },
      {
        onSuccess: () => {
          setShowEditDialog(false);
          toast.success("Project updated");
        },
        onError: (err) => toast.error(err.message ?? "Failed to update project"),
      }
    );
  };

  const handleDelete = () => {
    deleteProject.mutate(
      { id: project.id },
      {
        onSuccess: () => {
          setShowDeleteDialog(false);
          toast.success("Project deleted");
        },
        onError: (err) => toast.error(err.message ?? "Failed to delete project"),
      }
    );
  };

  return (
    <>
      <Link href={`/dashboard/projects/${project.id}`}>
        <Card className="group relative transition-colors hover:bg-muted/50">
          <div
            className="absolute inset-x-0 top-0 h-1 rounded-t-xl"
            style={{ backgroundColor: project.color ?? "#737373" }}
          />
          <CardHeader className="pt-5">
            <div className="flex items-start justify-between">
              <CardTitle className="line-clamp-1 text-base">{project.name}</CardTitle>
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-8 p-0"
                      onClick={(e) => e.preventDefault()}
                    >
                      <MoreHorizontalIcon className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault();
                        setEditName(project.name);
                        setEditDescription(project.description ?? "");
                        setEditColor(project.color ?? "#737373");
                        setShowEditDialog(true);
                      }}
                    >
                      <PencilIcon className="mr-2 size-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowDeleteDialog(true);
                      }}
                    >
                      <TrashIcon className="mr-2 size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <FavoriteStar targetType="project" targetId={project.id} />
              </div>
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

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update the project name, description, and color.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-project-name">Name</Label>
              <Input
                id="edit-project-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleEdit();
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-project-description">Description</Label>
              <Textarea
                id="edit-project-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-project-color">Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="edit-project-color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border bg-transparent"
                />
                <span className="text-sm text-muted-foreground">{editColor}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleEdit}
              disabled={!editName.trim() || updateProject.isPending}
            >
              {updateProject.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{project.name}&rdquo; and all its campaigns,
              brand identities, and content. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
