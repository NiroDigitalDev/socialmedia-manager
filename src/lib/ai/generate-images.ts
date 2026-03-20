import { generateText } from "ai";
import type { GoogleLanguageModelOptions } from "@ai-sdk/google";
import { imageModels, type ModelKey, type AspectRatio } from "./config";

export interface ImageResult {
  base64: string;
  mimeType: string;
}

/**
 * Generate an image using Gemini image models via AI SDK.
 *
 * Uses generateText with responseModalities: ['IMAGE'] to get image output.
 * Images are returned in result.files as base64 + Uint8Array.
 */
export async function generateImageFromPrompt(
  prompt: string,
  modelKey: ModelKey,
  aspectRatio: AspectRatio,
): Promise<ImageResult> {
  const result = await generateText({
    model: imageModels[modelKey],
    prompt,
    providerOptions: {
      google: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio },
      } satisfies GoogleLanguageModelOptions,
    },
  });

  const imageFile = result.files.find((f) =>
    f.mediaType.startsWith("image/"),
  );

  if (!imageFile) {
    throw new Error("No image data in AI response");
  }

  return {
    base64: imageFile.base64,
    mimeType: imageFile.mediaType,
  };
}
