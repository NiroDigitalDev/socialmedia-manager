import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { geminiText, generateImage } from "@/lib/gemini";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile) {
      return NextResponse.json(
        { error: "Image file is required" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const mimeType = imageFile.type || "image/jpeg";

    // Store the reference image in DB
    const refImage = await prisma.storedImage.create({
      data: {
        data: buffer,
        mimeType,
      },
    });

    // Use Gemini vision to analyze the image and extract a style description
    const base64Image = buffer.toString("base64");

    const promptText = await geminiText.generateContent([
      {
        inlineData: {
          data: base64Image,
          mimeType,
        },
      },
      {
        text: "Analyze this image and describe its visual style in detail. Focus on colors, typography, composition, textures, mood, and design elements. Write a concise style prompt (1-2 sentences) that could be used to generate images with a similar aesthetic. Return ONLY the style prompt, nothing else.",
      },
    ]);

    const cleanedPrompt = promptText.trim() || "Modern design with clean composition";

    // Generate 2 sample images using Gemini with the extracted style prompt
    const results = await Promise.all([
      generateImage(cleanedPrompt, "nano-banana-2", "1:1"),
      generateImage(cleanedPrompt, "nano-banana-2", "1:1"),
    ]);

    // Store samples in DB
    const stored = await Promise.all(
      results.map((img) =>
        prisma.storedImage.create({
          data: {
            data: Buffer.from(img.base64, "base64"),
            mimeType: img.mimeType,
          },
        })
      )
    );

    const sampleImageIds = stored.map((s) => s.id);

    return NextResponse.json({
      promptText: cleanedPrompt,
      referenceImageId: refImage.id,
      sampleImageIds,
    });
  } catch (error) {
    console.error("Error analyzing image style:", error);
    return NextResponse.json(
      { error: "Failed to analyze image and generate style" },
      { status: 500 }
    );
  }
}
