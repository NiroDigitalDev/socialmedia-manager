import { create } from "zustand";

interface LabState {
  selectedRunId: string | null;
  activeTab: "configure" | "results" | "export";
  comparisonMode: boolean;
  comparisonRunIds: [string, string] | null;

  selectRun: (runId: string | null) => void;
  setActiveTab: (tab: LabState["activeTab"]) => void;
  toggleComparisonMode: () => void;
  setComparisonRuns: (ids: [string, string] | null) => void;
  reset: () => void;
}

export const useLabStore = create<LabState>((set) => ({
  selectedRunId: null,
  activeTab: "configure",
  comparisonMode: false,
  comparisonRunIds: null,

  selectRun: (runId) => set({ selectedRunId: runId }),
  setActiveTab: (activeTab) => set({ activeTab }),
  toggleComparisonMode: () =>
    set((s) => ({ comparisonMode: !s.comparisonMode, comparisonRunIds: null })),
  setComparisonRuns: (comparisonRunIds) => set({ comparisonRunIds }),
  reset: () =>
    set({
      selectedRunId: null,
      activeTab: "configure",
      comparisonMode: false,
      comparisonRunIds: null,
    }),
}));
