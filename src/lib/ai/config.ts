import { google } from "@ai-sdk/google";

// Text generation — intentional upgrade from gemini-2.5-flash to pro for better structured output
export const textModel = google("gemini-3.1-pro-preview");

// Image generation models
export const imageModels = {
  "nano-banana-2": google("gemini-3.1-flash-image-preview"),
  "nano-banana-pro": google("gemini-3-pro-image-preview"),
} as const;

export type ModelKey = keyof typeof imageModels;

// Instagram aspect ratios
export const ASPECT_RATIOS = ["1:1", "3:4", "4:5", "9:16"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];
