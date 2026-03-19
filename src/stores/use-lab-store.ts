import { create } from "zustand";

interface LabStore {
  selectedNodeId: string | null;
  panelOpen: boolean;
  showHidden: boolean; // show thumbs-downed nodes
  multiSelectIds: string[];

  selectNode: (id: string | null) => void;
  togglePanel: () => void;
  toggleShowHidden: () => void;
  toggleMultiSelect: (id: string) => void;
  clearMultiSelect: () => void;
  reset: () => void;
}

export const useLabStore = create<LabStore>((set) => ({
  selectedNodeId: null,
  panelOpen: false,
  showHidden: false,
  multiSelectIds: [],

  selectNode: (id) => set({ selectedNodeId: id }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  toggleShowHidden: () => set((s) => ({ showHidden: !s.showHidden })),
  toggleMultiSelect: (id) =>
    set((s) => ({
      multiSelectIds: s.multiSelectIds.includes(id)
        ? s.multiSelectIds.filter((x) => x !== id)
        : [...s.multiSelectIds, id],
    })),
  clearMultiSelect: () => set({ multiSelectIds: [] }),
  reset: () =>
    set({
      selectedNodeId: null,
      panelOpen: false,
      showHidden: false,
      multiSelectIds: [],
    }),
}));
