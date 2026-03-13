import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateImage, GEMINI_IMAGE_MODELS, ASPECT_RATIOS, type ModelKey, type AspectRatioKey } from "@/lib/gemini";

export const maxDuration = 300;

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
      variations = 1,
      slidePrompts: bodySlidePrompts,
      styleGuide: bodyStyleGuide,
    } = body as {
      prompt: string;
      styleId?: string;
      contentIdeaId?: string;
      aspectRatio: AspectRatioKey;
      format: string;
      model: ModelKey;
      includeLogo: boolean;
      slideCount: number;
      variations: number;
      slidePrompts?: string[];
      styleGuide?: string | null;
    };

    const numVariations = Math.min(Math.max(variations, 1), 6);

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

    // Use slide prompts from request body (edited by user) or fetch from DB
    let contentIdea: {
      slidePrompts: string[];
      styleGuide: string | null;
      format: string;
      slideCount: number;
    } | null = null;

    if (bodySlidePrompts && bodySlidePrompts.length > 0) {
      // Use the edited slide prompts from the request body
      contentIdea = {
        slidePrompts: bodySlidePrompts,
        styleGuide: bodyStyleGuide ?? null,
        format,
        slideCount,
      };
    } else if (contentIdeaId) {
      contentIdea = await prisma.contentIdea.findUnique({
        where: { id: contentIdeaId },
        select: { slidePrompts: true, styleGuide: true, format: true, slideCount: true },
      });
    }

    // Always fetch brand settings for colors and name
    const brand = await prisma.brandSettings.findFirst();
    let brandColorContext = "";
    let logoContext = "";
    let logoReferenceImages: { base64: string; mimeType: string }[] = [];

    if (brand) {
      // Brand colors are ALWAYS applied
      const brandParts = [
        brand.brandName && `Brand name: ${brand.brandName}`,
        brand.tagline && `Tagline: "${brand.tagline}"`,
        brand.colors.length > 0 && `You MUST use these exact brand colors as the primary color palette for the design: ${brand.colors.join(", ")}. These colors should dominate the image — backgrounds, text, accents, and visual elements should all use these colors.`,
      ].filter(Boolean);
      brandColorContext = brandParts.join(". ");

      // Logo is only included if the checkbox is checked
      if (includeLogo && brand.logoImageId) {
        logoContext = "The attached image is the brand logo. You MUST incorporate this exact logo into the generated image. Place it prominently but tastefully (e.g., corner, header, or watermark position).";
        const logoImage = await prisma.storedImage.findUnique({
          where: { id: brand.logoImageId },
        });
        if (logoImage) {
          logoReferenceImages.push({
            base64: Buffer.from(logoImage.data).toString("base64"),
            mimeType: logoImage.mimeType,
          });
        }
      }
    }

    // Build the base prompt
    let basePrompt = prompt;

    // Fetch the selected style
    let stylePrompt = "";
    if (styleId) {
      const style = await prisma.style.findUnique({ where: { id: styleId } });
      if (style) {
        stylePrompt = style.promptText;
      }
    }

    // Determine if we have per-slide prompts from a content idea
    const hasSlidePrompts = contentIdea?.slidePrompts && contentIdea.slidePrompts.length > 0;
    const numSlides = format === "carousel" ? Math.min(slideCount, 10) : 1;
    const refs = logoReferenceImages.length > 0 ? logoReferenceImages : undefined;

    // Build the full context that gets prepended to every slide
    const contextParts = [
      stylePrompt && `VISUAL STYLE: ${stylePrompt}`,
      brandColorContext && `BRAND: ${brandColorContext}`,
      logoContext,
    ].filter(Boolean);
    const fullContext = contextParts.join("\n\n");

    const generateOnePost = async (variationIndex: number) => {
      const post = await prisma.generatedPost.create({
        data: {
          prompt: basePrompt,
          styleId: styleId || null,
          contentIdeaId: contentIdeaId || null,
          format,
          aspectRatio,
          model,
          includeLogo,
          status: "generating",
        },
      });

      const generateSlide = async (slideNumber: number) => {
        const parts: string[] = [];

        // 1. Always add brand + style context first
        if (fullContext) {
          parts.push(fullContext);
        }

        // 2. Add structural style guide for carousels
        if (contentIdea?.styleGuide && format === "carousel") {
          parts.push(`LAYOUT GUIDE (apply consistently to ALL slides): ${contentIdea.styleGuide}`);
        }

        // 3. Add the slide content prompt
        if (hasSlidePrompts && contentIdea!.slidePrompts[slideNumber - 1]) {
          parts.push(`SLIDE ${slideNumber} OF ${numSlides}:\n${contentIdea!.slidePrompts[slideNumber - 1]}`);
        } else {
          // Fallback: manual prompt
          let manual = basePrompt;
          if (format === "carousel" && numSlides > 1) {
            manual = `${manual}. This is slide ${slideNumber} of ${numSlides} in a carousel post. Make it visually consistent with other slides but with unique content for this slide.`;
          }
          parts.push(manual);
        }

        // 4. Add variation instruction
        if (numVariations > 1) {
          parts.push(`VARIATION ${variationIndex + 1}: Make this visually distinct from other variations while keeping the same core message.`);
        }

        const slidePrompt = parts.join("\n\n");
        const result = await generateImage(slidePrompt, model, aspectRatio, refs);

        return prisma.generatedImage.create({
          data: {
            postId: post.id,
            slideNumber,
            data: Buffer.from(result.base64, "base64"),
            mimeType: result.mimeType,
          },
        });
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

      return prisma.generatedPost.findUnique({
        where: { id: post.id },
        include: {
          images: {
            orderBy: { slideNumber: "asc" },
            select: { id: true, slideNumber: true, mimeType: true },
          },
          style: true,
        },
      });
    };

    const completedPosts = await Promise.all(
      Array.from({ length: numVariations }, (_, i) => generateOnePost(i))
    );

    return NextResponse.json(
      numVariations === 1 ? completedPosts[0] : completedPosts
    );
  } catch (error) {
    console.error("Generation error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate images";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
