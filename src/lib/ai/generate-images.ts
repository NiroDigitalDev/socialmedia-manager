import { generateText } from "ai";
import type { GoogleLanguageModelOptions } from "@ai-sdk/google";
import { imageModels, type ModelKey, type AspectRatio } from "./config";

export interface ImageResult {
  base64: string;
  mimeType: string;
}

export interface ReferenceImage {
  data: Buffer;
  mimeType: string;
}

/**
 * Generate an image using Gemini image models via AI SDK.
 *
 * Uses generateText with responseModalities: ['IMAGE'] to get image output.
 * Images are returned in result.files as base64 + Uint8Array.
 *
 * @param prompt - The user prompt describing what to generate (content, style, outline)
 * @param modelKey - Which image model to use
 * @param aspectRatio - Instagram aspect ratio
 * @param referenceImages - Optional reference images (e.g. brand logo)
 * @param systemPrompt - Optional system prompt with design principles and rules
 */
export async function generateImageFromPrompt(
  prompt: string,
  modelKey: ModelKey,
  aspectRatio: AspectRatio,
  referenceImages?: ReferenceImage[],
  systemPrompt?: string,
): Promise<ImageResult> {
  const providerOptions = {
    google: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio },
    } satisfies GoogleLanguageModelOptions,
  };

  let result;

  if (referenceImages && referenceImages.length > 0) {
    // Multimodal: send reference images + text prompt as message parts
    result = await generateText({
      model: imageModels[modelKey],
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            ...referenceImages.map((img) => ({
              type: "image" as const,
              image: img.data,
              mediaType: img.mimeType,
            })),
            {
              type: "text" as const,
              text: prompt,
            },
          ],
        },
      ],
      providerOptions,
    });
  } else {
    // Text-only prompt
    result = await generateText({
      model: imageModels[modelKey],
      system: systemPrompt,
      prompt,
      providerOptions,
    });
  }

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
