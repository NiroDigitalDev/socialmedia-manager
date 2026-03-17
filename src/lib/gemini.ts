import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
});

// Text-only model for content ideas, descriptions, style analysis
export const geminiText = {
  async generateContent(prompt: string | Array<{ text?: string; inlineData?: { data: string; mimeType: string } }>) {
    const contents = typeof prompt === "string" ? prompt : prompt;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
    });
    return response.text ?? "";
  },
};

// Pro model for high-quality text generation (captions, descriptions)
export const geminiPro = {
  async generateContent(prompt: string | Array<{ text?: string; inlineData?: { data: string; mimeType: string } }>) {
    const contents = typeof prompt === "string" ? prompt : prompt;
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents,
    });
    return response.text ?? "";
  },
};

// Image generation models
export const GEMINI_IMAGE_MODELS = {
  "nano-banana-2": "gemini-3.1-flash-image-preview",
  "nano-banana-pro": "gemini-3-pro-image-preview",
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

  // Build contents: reference images first, then the text prompt
  const contents: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [];

  if (referenceImages && referenceImages.length > 0) {
    for (const img of referenceImages) {
      contents.push({
        inlineData: { data: img.base64, mimeType: img.mimeType },
      });
    }
  }

  contents.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: modelId,
    contents,
    config: {
      responseModalities: ["IMAGE"],
      imageConfig: {
        aspectRatio: ASPECT_RATIOS[aspectRatio],
      },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) {
    throw new Error("No response parts from Gemini image generation");
  }

  for (const part of parts) {
    if (part.inlineData) {
      return {
        base64: part.inlineData.data!,
        mimeType: part.inlineData.mimeType || "image/png",
      };
    }
  }

  throw new Error("No image data in Gemini response");
}

export { ai };
