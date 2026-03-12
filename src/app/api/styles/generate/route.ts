import { NextResponse } from "next/server";
import { fal } from "@/lib/fal";
import { uploadImage } from "@/lib/cloudinary";

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

    // Generate 2 sample images using fal.ai
    const result = await fal.subscribe("fal-ai/nano-banana-2", {
      input: {
        prompt: promptText,
        image_size: { width: 1024, height: 1024 },
        num_images: 2,
      },
    });

    const images = result.data.images as Array<{ url: string }>;

    if (!images || images.length === 0) {
      return NextResponse.json(
        { error: "No images generated" },
        { status: 500 }
      );
    }

    // Upload generated images to Cloudinary
    const uploadPromises = images.map((img) =>
      uploadImage(img.url, "socialmedia-manager/styles")
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
