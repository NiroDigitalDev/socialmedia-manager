import { fal } from "@fal-ai/client";

fal.config({
  credentials: process.env.FAL_KEY,
});

export const FAL_MODELS = {
  "nano-banana-2": "fal-ai/nano-banana-2",
  "nano-banana-pro": "fal-ai/nano-banana-pro",
} as const;

export type ModelKey = keyof typeof FAL_MODELS;

export const ASPECT_RATIOS = {
  "3:4": { width: 768, height: 1024 },
  "1:1": { width: 1024, height: 1024 },
  "4:5": { width: 819, height: 1024 },
  "9:16": { width: 576, height: 1024 },
} as const;

export type AspectRatioKey = keyof typeof ASPECT_RATIOS;

export { fal };
