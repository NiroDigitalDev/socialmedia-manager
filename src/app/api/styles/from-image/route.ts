import { NextResponse } from "next/server";
import { fal } from "@/lib/fal";
import { geminiFlash } from "@/lib/gemini";
import { uploadImage, uploadImageBuffer } from "@/lib/cloudinary";

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

    // Upload the reference image to Cloudinary
    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const referenceUpload = await uploadImageBuffer(
      buffer,
      "socialmedia-manager/styles"
    );
    const referenceImageUrl = referenceUpload.url;

    // Use Gemini vision to analyze the image and extract a style description
    const base64Image = buffer.toString("base64");
    const mimeType = imageFile.type || "image/jpeg";

    const geminiResult = await geminiFlash.generateContent([
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

    const promptText =
      geminiResult.response.text().trim() ||
      "Modern design with clean composition";

    // Generate 2 sample images using fal.ai with the extracted style prompt
    const falResult = await fal.subscribe("fal-ai/nano-banana-2", {
      input: {
        prompt: promptText,
        image_size: { width: 1024, height: 1024 },
        num_images: 2,
      },
    });

    const images = falResult.data.images as Array<{ url: string }>;

    // Upload samples to Cloudinary
    const uploadPromises = images.map((img) =>
      uploadImage(img.url, "socialmedia-manager/styles")
    );
    const uploadedImages = await Promise.all(uploadPromises);
    const sampleImageUrls = uploadedImages.map((img) => img.url);

    return NextResponse.json({
      promptText,
      referenceImageUrl,
      sampleImageUrls,
    });
  } catch (error) {
    console.error("Error analyzing image style:", error);
    return NextResponse.json(
      { error: "Failed to analyze image and generate style" },
      { status: 500 }
    );
  }
}
