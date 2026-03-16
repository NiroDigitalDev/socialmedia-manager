"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";

export function useProjects() {
  const trpc = useTRPC();
  return useQuery(trpc.project.list.queryOptions());
}

export function useProject(id: string) {
  const trpc = useTRPC();
  return useQuery(trpc.project.get.queryOptions({ id }));
}

export function useCreateProject() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.project.create.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.project.list.queryKey() });
    },
  });
}

export function useUpdateProject() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.project.update.mutationOptions(),
    onSuccess: (_data, variables) => {
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
  return useMutation({
    ...trpc.project.delete.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.project.list.queryKey() });
    },
  });
}
