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
 * Optionally accepts reference images (e.g. brand logo) that are sent as
 * multimodal content parts alongside the text prompt.
 */
export async function generateImageFromPrompt(
  prompt: string,
  modelKey: ModelKey,
  aspectRatio: AspectRatio,
  referenceImages?: ReferenceImage[],
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
