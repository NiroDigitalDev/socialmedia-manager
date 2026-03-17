"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";

export function useProjects() {
  const trpc = useTRPC();
  return useQuery(trpc.project.list.queryOptions());
}

export function useProject(id: string | undefined) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.project.get.queryOptions({ id: id! }),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.project.create.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (newProject) => {
      await queryClient.cancelQueries({ queryKey: trpc.project.list.queryKey() });
      const previous = queryClient.getQueryData(trpc.project.list.queryKey());
      queryClient.setQueryData(trpc.project.list.queryKey(), (old: any[] | undefined) => [
        {
          ...newProject,
          id: `temp-${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          orgId: "",
          _count: { campaigns: 0, posts: 0 },
        },
        ...(old ?? []),
      ]);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(trpc.project.list.queryKey(), context.previous);
      }
      toast.error("Failed to create project");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.project.list.queryKey() });
    },
  });
}

export function useUpdateProject() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.project.update.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (updatedProject) => {
      await queryClient.cancelQueries({ queryKey: trpc.project.list.queryKey() });
      await queryClient.cancelQueries({
        queryKey: trpc.project.get.queryKey({ id: updatedProject.id }),
      });
      const previousList = queryClient.getQueryData(trpc.project.list.queryKey());
      const previousDetail = queryClient.getQueryData(
        trpc.project.get.queryKey({ id: updatedProject.id })
      );
      // Optimistic update in list
      queryClient.setQueryData(trpc.project.list.queryKey(), (old: any[] | undefined) =>
        (old ?? []).map((p: any) =>
          p.id === updatedProject.id ? { ...p, ...updatedProject } : p
        )
      );
      // Optimistic update in detail
      queryClient.setQueryData(
        trpc.project.get.queryKey({ id: updatedProject.id }),
        (old: any) => (old ? { ...old, ...updatedProject } : old)
      );
      return { previousList, previousDetail };
    },
    onError: (_err, variables, context) => {
      if (context?.previousList !== undefined) {
        queryClient.setQueryData(trpc.project.list.queryKey(), context.previousList);
      }
      if (context?.previousDetail !== undefined) {
        queryClient.setQueryData(
          trpc.project.get.queryKey({ id: variables.id }),
          context.previousDetail
        );
      }
      toast.error("Failed to update project");
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: trpc.project.list.queryKey() });
      queryClient.invalidateQueries({
        queryKey: trpc.project.get.queryKey({ id: variables.id }),
      });
    },
  });
}

export function useDeleteProject() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutationFn } = trpc.project.delete.mutationOptions();
  return useMutation({
    mutationFn,
    onMutate: async (deletedProject) => {
      await queryClient.cancelQueries({ queryKey: trpc.project.list.queryKey() });
      const previous = queryClient.getQueryData(trpc.project.list.queryKey());
      queryClient.setQueryData(trpc.project.list.queryKey(), (old: any[] | undefined) =>
        (old ?? []).filter((p: any) => p.id !== deletedProject.id)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(trpc.project.list.queryKey(), context.previous);
      }
      toast.error("Failed to delete project");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: trpc.project.list.queryKey() });
    },
  });
}
