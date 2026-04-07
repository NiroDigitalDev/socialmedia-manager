import { NextResponse } from "next/server";
import { generateImage } from "@/lib/gemini";
import { putStoredImage } from "@/lib/image-storage";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { promptText } = body;

    if (!promptText) {
      return NextResponse.json(
        { error: "promptText is required" },
        { status: 400 }
      );
    }

    // Generate 2 sample images using Gemini
    const results = await Promise.all([
      generateImage(promptText, "nano-banana-2", "1:1"),
      generateImage(promptText, "nano-banana-2", "1:1"),
    ]);

    // Store in R2
    const stored = await Promise.all(
      results.map((img) =>
        putStoredImage(Buffer.from(img.base64, "base64"), img.mimeType)
      )
    );

    const sampleImageIds = stored.map((s) => s.id);

    return NextResponse.json({ sampleImageIds });
  } catch (error) {
    console.error("Error generating style images:", error);
    return NextResponse.json(
      { error: "Failed to generate style images" },
      { status: 500 }
    );
  }
}
