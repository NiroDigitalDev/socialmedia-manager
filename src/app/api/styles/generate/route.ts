import { NextResponse } from "next/server";
import { generateImage } from "@/lib/gemini";
import { uploadImageBase64 } from "@/lib/cloudinary";

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

    // Upload generated images to Cloudinary
    const uploadPromises = results.map((img) =>
      uploadImageBase64(img.base64, img.mimeType, "socialmedia-manager/styles")
    );
    const uploadedImages = await Promise.all(uploadPromises);
    const sampleImageUrls = uploadedImages.map((img) => img.url);

    return NextResponse.json({ sampleImageUrls });
  } catch (error) {
    console.error("Error generating style images:", error);
    return NextResponse.json(
      { error: "Failed to generate style images" },
      { status: 500 }
    );
  }
}
