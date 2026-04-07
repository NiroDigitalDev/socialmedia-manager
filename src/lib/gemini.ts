import { generateText } from "ai";
import { createGateway } from "@ai-sdk/gateway";

const gateway = createGateway();

type ContentPart = { text?: string; inlineData?: { data: string; mimeType: string } };

// Text-only model for content ideas, descriptions, style analysis
export const geminiText = {
  async generateContent(prompt: string | ContentPart[]) {
    if (typeof prompt === "string") {
      const { text } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        prompt,
      });
      return text ?? "";
    }

    // Mixed content (text + images)
    const content = prompt.map((part) => {
      if (part.inlineData) {
        return {
          type: "image" as const,
          image: part.inlineData.data,
          mimeType: part.inlineData.mimeType as string,
        };
      }
      return { type: "text" as const, text: part.text ?? "" };
    });

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      messages: [{ role: "user", content }],
    });
    return text ?? "";
  },
};

// Image generation models
export const GEMINI_IMAGE_MODELS = {
  "nano-banana-2": "google/gemini-3.1-flash-image-preview",
  "nano-banana-pro": "google/gemini-3-pro-image-preview",
} as const;

export type ModelKey = keyof typeof GEMINI_IMAGE_MODELS;

export const ASPECT_RATIOS = {
  "3:4": "3:4",
  "1:1": "1:1",
  "4:5": "4:5",
  "9:16": "9:16",
} as const;

export type AspectRatioKey = keyof typeof ASPECT_RATIOS;

// Generate an image using Gemini's native image generation
export async function generateImage(
  prompt: string,
  modelKey: ModelKey,
  aspectRatio: AspectRatioKey,
  referenceImages?: { base64: string; mimeType: string }[]
): Promise<{ base64: string; mimeType: string }> {
  const modelId = GEMINI_IMAGE_MODELS[modelKey];

  const content: Array<
    | { type: "image"; image: string; mimeType: string }
    | { type: "text"; text: string }
  > = [];

  if (referenceImages && referenceImages.length > 0) {
    for (const img of referenceImages) {
      content.push({ type: "image", image: img.base64, mimeType: img.mimeType });
    }
  }
  content.push({ type: "text", text: prompt });

  const result = await generateText({
    model: gateway(modelId),
    messages: [{ role: "user", content }],
    providerOptions: {
      google: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: ASPECT_RATIOS[aspectRatio],
        },
      },
    },
  });

  const files = result.files ?? [];
  for (const file of files) {
    if (file.mediaType.startsWith("image/")) {
      return {
        base64: file.base64,
        mimeType: file.mediaType,
      };
    }
  }

  throw new Error("No image data in response");
}
