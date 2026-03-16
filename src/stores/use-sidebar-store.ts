import { create } from "zustand";

interface SidebarState {
  expandedProjectIds: Set<string>;
  favoritesCollapsed: boolean;
  projectsCollapsed: boolean;
  toggleProject: (projectId: string) => void;
  toggleFavorites: () => void;
  toggleProjects: () => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  expandedProjectIds: new Set(),
  favoritesCollapsed: false,
  projectsCollapsed: false,

  toggleProject: (projectId) =>
    set((state) => {
      const next = new Set(state.expandedProjectIds);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return { expandedProjectIds: next };
    }),

  toggleFavorites: () =>
    set((state) => ({ favoritesCollapsed: !state.favoritesCollapsed })),

  toggleProjects: () =>
    set((state) => ({ projectsCollapsed: !state.projectsCollapsed })),
}));
