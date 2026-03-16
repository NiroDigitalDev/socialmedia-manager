import { create } from "zustand";

export type Platform = "instagram" | "linkedin" | "reddit" | "x" | "blog" | "email";

export interface ContentInput {
  prompt: string;
  contentIdeaId?: string;
  contentSourceId?: string;
  assetIds?: string[];
}

export interface OutlineSection {
  id: string;
  platform: Platform;
  label: string;
  content: string;
  order: number;
}

export interface GenerateState {
  step: number;
  maxCompletedStep: number;
  platforms: Platform[];
  content: ContentInput;
  outline: OutlineSection[] | null;
  styleIds: string[];
  brandIdentityId: string | null;
  colorOverride: { accent: string; bg: string } | null;
  settings: {
    formatPerPlatform: Record<string, string>;
    aspectRatioPerPlatform: Record<string, string>;
    model: "flash" | "pro";
    variations: number;
    includeLogo: boolean;
  };
  generationId: string | null;
  projectId: string | null;
  campaignId: string | null;

  setStep: (step: number) => void;
  setPlatforms: (platforms: Platform[]) => void;
  setContent: (content: Partial<ContentInput>) => void;
  setOutline: (outline: OutlineSection[]) => void;
  updateOutlineSection: (id: string, content: string) => void;
  setStyleIds: (ids: string[]) => void;
  setBrandIdentityId: (id: string | null) => void;
  setColorOverride: (override: { accent: string; bg: string } | null) => void;
  updateSettings: (settings: Partial<GenerateState["settings"]>) => void;
  setGenerationId: (id: string | null) => void;
  setContext: (projectId: string | null, campaignId: string | null) => void;
  reset: () => void;
}

const initialSettings = {
  formatPerPlatform: {},
  aspectRatioPerPlatform: {},
  model: "flash" as const,
  variations: 1,
  includeLogo: false,
};

export const useGenerateStore = create<GenerateState>((set) => ({
  step: 1,
  maxCompletedStep: 0,
  platforms: [],
  content: { prompt: "" },
  outline: null,
  styleIds: [],
  brandIdentityId: null,
  colorOverride: null,
  settings: { ...initialSettings },
  generationId: null,
  projectId: null,
  campaignId: null,

  setStep: (step) =>
    set((state) => ({
      step,
      maxCompletedStep: Math.max(state.maxCompletedStep, step - 1),
    })),
  setPlatforms: (platforms) => set({ platforms }),
  setContent: (content) =>
    set((state) => ({ content: { ...state.content, ...content } })),
  setOutline: (outline) => set({ outline }),
  updateOutlineSection: (id, content) =>
    set((state) => ({
      outline: state.outline?.map((s) => (s.id === id ? { ...s, content } : s)) ?? null,
    })),
  setStyleIds: (styleIds) => set({ styleIds }),
  setBrandIdentityId: (brandIdentityId) => set({ brandIdentityId }),
  setColorOverride: (colorOverride) => set({ colorOverride }),
  updateSettings: (settings) =>
    set((state) => ({ settings: { ...state.settings, ...settings } })),
  setGenerationId: (generationId) => set({ generationId }),
  setContext: (projectId, campaignId) => set({ projectId, campaignId }),
  reset: () =>
    set({
      step: 1,
      maxCompletedStep: 0,
      platforms: [],
      content: { prompt: "" },
      outline: null,
      styleIds: [],
      brandIdentityId: null,
      colorOverride: null,
      settings: { ...initialSettings },
      generationId: null,
      projectId: null,
      campaignId: null,
    }),
}));
