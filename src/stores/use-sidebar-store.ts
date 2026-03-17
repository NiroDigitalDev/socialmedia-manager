import { create } from "zustand";

interface SidebarState {
  favoritesCollapsed: boolean;
  projectsCollapsed: boolean;
  toggleFavorites: () => void;
  toggleProjects: () => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  favoritesCollapsed: false,
  projectsCollapsed: false,

  toggleFavorites: () =>
    set((state) => ({ favoritesCollapsed: !state.favoritesCollapsed })),

  toggleProjects: () =>
    set((state) => ({ projectsCollapsed: !state.projectsCollapsed })),
}));
