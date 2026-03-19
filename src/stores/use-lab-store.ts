import { create } from "zustand";

interface LabStore {
  selectedNodeId: string | null;
  showHidden: boolean; // show thumbs-downed nodes
  multiSelectIds: string[];

  selectNode: (id: string | null) => void;
  toggleShowHidden: () => void;
  toggleMultiSelect: (id: string) => void;
  clearMultiSelect: () => void;
  reset: () => void;
}

export const useLabStore = create<LabStore>((set) => ({
  selectedNodeId: null,
  showHidden: false,
  multiSelectIds: [],

  selectNode: (id) => set({ selectedNodeId: id }),
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
      showHidden: false,
      multiSelectIds: [],
    }),
}));
