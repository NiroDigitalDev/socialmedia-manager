import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fal, FAL_MODELS, ASPECT_RATIOS, type ModelKey, type AspectRatioKey } from "@/lib/fal";
import { uploadImage } from "@/lib/cloudinary";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      prompt,
      styleId,
      contentIdeaId,
      aspectRatio,
      format,
      model,
      includeLogo,
      slideCount = 1,
    } = body as {
      prompt: string;
      styleId?: string;
      contentIdeaId?: string;
      aspectRatio: AspectRatioKey;
      format: string;
      model: ModelKey;
      includeLogo: boolean;
      slideCount: number;
    };

    if (!prompt || !aspectRatio || !format || !model) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Build the full prompt
    let fullPrompt = prompt;

    // Add style context if selected
    if (styleId) {
      const style = await prisma.style.findUnique({ where: { id: styleId } });
      if (style) {
        fullPrompt = `Style: ${style.promptText}. Content: ${fullPrompt}`;
      }
    }

    // Add brand context if logo is included
    if (includeLogo) {
      const brand = await prisma.brandSettings.findFirst();
      if (brand) {
        const brandContext = [
          brand.brandName && `Brand: ${brand.brandName}`,
          brand.tagline && `Tagline: "${brand.tagline}"`,
          brand.colors.length > 0 && `Brand colors: ${brand.colors.join(", ")}`,
          "Include the brand logo and branding elements in the design.",
        ]
          .filter(Boolean)
          .join(". ");
        fullPrompt = `${fullPrompt}. ${brandContext}`;
      }
    }

    // Create the post record
    const post = await prisma.generatedPost.create({
      data: {
        prompt: fullPrompt,
        styleId: styleId || null,
        contentIdeaId: contentIdeaId || null,
        format,
        aspectRatio,
        model,
        includeLogo,
        status: "generating",
      },
    });

    const imageSize = ASPECT_RATIOS[aspectRatio];
    const modelId = FAL_MODELS[model];
    const numSlides = format === "carousel" ? Math.min(slideCount, 10) : 1;

    // Generate images in parallel
    const generateSlide = async (slideNumber: number) => {
      let slidePrompt = fullPrompt;
      if (format === "carousel" && numSlides > 1) {
        slidePrompt = `${fullPrompt}. This is slide ${slideNumber} of ${numSlides} in a carousel post. Make it visually consistent with other slides but with unique content for this slide.`;
      }

      const result = await fal.subscribe(modelId, {
        input: {
          prompt: slidePrompt,
          image_size: { width: imageSize.width, height: imageSize.height },
          num_images: 1,
        },
      });

      const images = (result.data as { images: { url: string }[] }).images;
      if (!images || images.length === 0) {
        throw new Error(`No image generated for slide ${slideNumber}`);
      }

      // Upload to Cloudinary
      const uploaded = await uploadImage(
        images[0].url,
        `socialmedia-manager/posts/${post.id}`
      );

      // Save to DB
      await prisma.generatedImage.create({
        data: {
          postId: post.id,
          slideNumber,
          cloudinaryUrl: uploaded.url,
          cloudinaryPublicId: uploaded.publicId,
        },
      });

      return uploaded;
    };

    // Generate all slides in parallel
    try {
      await Promise.all(
        Array.from({ length: numSlides }, (_, i) => generateSlide(i + 1))
      );

      await prisma.generatedPost.update({
        where: { id: post.id },
        data: { status: "completed" },
      });
    } catch (genError) {
      await prisma.generatedPost.update({
        where: { id: post.id },
        data: { status: "failed" },
      });
      throw genError;
    }

    // Return the completed post with images
    const completedPost = await prisma.generatedPost.findUnique({
      where: { id: post.id },
      include: {
        images: { orderBy: { slideNumber: "asc" } },
        style: true,
      },
    });

    return NextResponse.json(completedPost);
  } catch (error) {
    console.error("Generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate images" },
      { status: 500 }
    );
  }
}
