import { create } from "zustand";

interface LabStore {
  selectedNodeId: string | null;
  showHidden: boolean; // show thumbs-downed nodes
  multiSelectIds: string[];
  collapsedIds: Set<string>; // nodes whose children are hidden

  selectNode: (id: string | null) => void;
  toggleShowHidden: () => void;
  toggleMultiSelect: (id: string) => void;
  clearMultiSelect: () => void;
  toggleCollapsed: (id: string) => void;
  reset: () => void;
}

export const useLabStore = create<LabStore>((set) => ({
  selectedNodeId: null,
  showHidden: false,
  multiSelectIds: [],
  collapsedIds: new Set(),

  selectNode: (id) => set({ selectedNodeId: id }),
  toggleShowHidden: () => set((s) => ({ showHidden: !s.showHidden })),
  toggleMultiSelect: (id) =>
    set((s) => ({
      multiSelectIds: s.multiSelectIds.includes(id)
        ? s.multiSelectIds.filter((x) => x !== id)
        : [...s.multiSelectIds, id],
    })),
  clearMultiSelect: () => set({ multiSelectIds: [] }),
  toggleCollapsed: (id) =>
    set((s) => {
      const next = new Set(s.collapsedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { collapsedIds: next };
    }),
  reset: () =>
    set({
      selectedNodeId: null,
      showHidden: false,
      multiSelectIds: [],
      collapsedIds: new Set(),
    }),
}));
