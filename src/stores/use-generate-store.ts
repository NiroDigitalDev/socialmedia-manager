import { create } from "zustand";

export type Platform = "instagram" | "linkedin" | "reddit" | "x" | "blog" | "email";

export interface ContentInput {
  prompt: string;
  contentIdeaId?: string;
  contentSourceId?: string;
  assetIds?: string[];
  // From the idea
  format?: "static" | "carousel";
  slideCount?: number;
  slidePrompts?: string[];
  styleGuide?: string;
}

export interface OutlineSlide {
  id: string;
  slideNumber: number;
  imagePrompt: string;
  layoutNotes: string;
}

export interface GenerateOutline {
  slides: OutlineSlide[];
  caption: string;
}

export interface GenerateState {
  step: number;
  maxCompletedStep: number;
  content: ContentInput;
  imageStyleId: string | null;
  captionStyleId: string | null;
  outline: GenerateOutline | null;
  settings: {
    model: "flash" | "pro";
    variations: number;
    aspectRatio: "3:4" | "1:1" | "4:5" | "9:16";
    colorOverride: { accent: string; bg: string } | null;
  };
  generationId: string | null;
  projectId: string | null;
  campaignId: string | null;

  setStep: (step: number) => void;
  setContent: (content: Partial<ContentInput>) => void;
  setImageStyleId: (id: string | null) => void;
  setCaptionStyleId: (id: string | null) => void;
  setOutline: (outline: GenerateOutline | null) => void;
  updateOutlineSlide: (id: string, data: Partial<OutlineSlide>) => void;
  updateOutlineCaption: (caption: string) => void;
  updateSettings: (settings: Partial<GenerateState["settings"]>) => void;
  setGenerationId: (id: string | null) => void;
  setContext: (projectId: string | null, campaignId: string | null) => void;
  reset: () => void;
}

const initialSettings = {
  model: "flash" as const,
  variations: 1,
  aspectRatio: "1:1" as const,
  colorOverride: null as { accent: string; bg: string } | null,
};

export const useGenerateStore = create<GenerateState>((set) => ({
  step: 1,
  maxCompletedStep: 0,
  content: { prompt: "" },
  imageStyleId: null,
  captionStyleId: null,
  outline: null,
  settings: { ...initialSettings },
  generationId: null,
  projectId: null,
  campaignId: null,

  setStep: (step) =>
    set((state) => ({
      step,
      maxCompletedStep: Math.max(state.maxCompletedStep, step - 1),
    })),
  setContent: (content) =>
    set((state) => ({ content: { ...state.content, ...content } })),
  setImageStyleId: (imageStyleId) => set({ imageStyleId }),
  setCaptionStyleId: (captionStyleId) => set({ captionStyleId }),
  setOutline: (outline) => set({ outline }),
  updateOutlineSlide: (id, data) =>
    set((state) => ({
      outline: state.outline
        ? {
            ...state.outline,
            slides: state.outline.slides.map((s) =>
              s.id === id ? { ...s, ...data } : s
            ),
          }
        : null,
    })),
  updateOutlineCaption: (caption) =>
    set((state) => ({
      outline: state.outline ? { ...state.outline, caption } : null,
    })),
  updateSettings: (settings) =>
    set((state) => ({ settings: { ...state.settings, ...settings } })),
  setGenerationId: (generationId) => set({ generationId }),
  setContext: (projectId, campaignId) => set({ projectId, campaignId }),
  reset: () =>
    set({
      step: 1,
      maxCompletedStep: 0,
      content: { prompt: "" },
      imageStyleId: null,
      captionStyleId: null,
      outline: null,
      settings: { ...initialSettings },
      generationId: null,
      projectId: null,
      campaignId: null,
    }),
}));
