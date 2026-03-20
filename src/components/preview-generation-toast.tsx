"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";

/**
 * Polls the server for background preview generation progress.
 * Shows a persistent toast when generation is running.
 * Only polls fast (2s) when active. Idle polling is 30s to check for
 * background jobs started elsewhere (e.g., another tab).
 * Mount once in the dashboard layout.
 */
export function PreviewGenerationToast() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const toastIdRef = useRef<string | number | null>(null);
  const wasRunningRef = useRef(false);
  const lastCompletedRef = useRef(0);

  const { data } = useQuery({
    ...trpc.style.previewProgress.queryOptions(),
    refetchInterval: (query) => {
      const d = query.state.data as { isRunning: boolean } | undefined;
      return d?.isRunning ? 2000 : 30000;
    },
  });

  useEffect(() => {
    if (!data) return;

    if (data.isRunning) {
      wasRunningRef.current = true;

      const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
      const message = `Generating style previews — ${data.completed}/${data.total} (${pct}%)`;
      const description = data.currentStyle || undefined;

      if (toastIdRef.current) {
        toast.loading(message, { id: toastIdRef.current, description, duration: Infinity });
      } else {
        toastIdRef.current = toast.loading(message, { description, duration: Infinity });
      }

      // Invalidate style list as new images arrive
      if (data.completed > lastCompletedRef.current) {
        queryClient.invalidateQueries({ queryKey: trpc.style.list.queryKey() });
        lastCompletedRef.current = data.completed;
      }
    } else if (wasRunningRef.current) {
      // Generation just finished (was running, now stopped)
      if (toastIdRef.current) {
        toast.success("All style previews generated!", { id: toastIdRef.current, duration: 4000 });
        toastIdRef.current = null;
      }
      queryClient.invalidateQueries({ queryKey: trpc.style.list.queryKey() });
      wasRunningRef.current = false;
      lastCompletedRef.current = 0;
    }
  }, [data, queryClient, trpc]);

  return null;
}
