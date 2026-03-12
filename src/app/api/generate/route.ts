import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateImage, GEMINI_IMAGE_MODELS, ASPECT_RATIOS, type ModelKey, type AspectRatioKey } from "@/lib/gemini";

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

    if (!(model in GEMINI_IMAGE_MODELS)) {
      return NextResponse.json({ error: "Invalid model" }, { status: 400 });
    }

    if (!(aspectRatio in ASPECT_RATIOS)) {
      return NextResponse.json({ error: "Invalid aspect ratio" }, { status: 400 });
    }

    // Build the full prompt
    let fullPrompt = prompt;

    if (styleId) {
      const style = await prisma.style.findUnique({ where: { id: styleId } });
      if (style) {
        fullPrompt = `Style: ${style.promptText}. Content: ${fullPrompt}`;
      }
    }

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

    const numSlides = format === "carousel" ? Math.min(slideCount, 10) : 1;

    const generateSlide = async (slideNumber: number) => {
      let slidePrompt = fullPrompt;
      if (format === "carousel" && numSlides > 1) {
        slidePrompt = `${fullPrompt}. This is slide ${slideNumber} of ${numSlides} in a carousel post. Make it visually consistent with other slides but with unique content for this slide.`;
      }

      const result = await generateImage(slidePrompt, model, aspectRatio);

      const image = await prisma.generatedImage.create({
        data: {
          postId: post.id,
          slideNumber,
          data: Buffer.from(result.base64, "base64"),
          mimeType: result.mimeType,
        },
      });

      return image;
    };

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

    // Return post with image IDs (not data) for the UI
    const completedPost = await prisma.generatedPost.findUnique({
      where: { id: post.id },
      include: {
        images: {
          orderBy: { slideNumber: "asc" },
          select: { id: true, slideNumber: true, mimeType: true },
        },
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
