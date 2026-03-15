import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateImage } from "@/lib/gemini";

export const maxDuration = 300;

export async function POST() {
  try {
    // Find predefined styles missing sample images
    const styles = await prisma.style.findMany({
      where: {
        isPredefined: true,
        sampleImageIds: { isEmpty: true },
      },
    });

    if (styles.length === 0) {
      return NextResponse.json({
        message: "All predefined styles already have sample images",
        generated: 0,
      });
    }

    let generated = 0;

    // Process sequentially to avoid rate limits
    for (const style of styles) {
      try {
        const samplePrompt = `${style.promptText}. Create a visually striking sample social media post that showcases this visual style. The post should feature an inspirational quote or lifestyle concept. Focus on demonstrating the visual style clearly with strong composition.`;

        const result = await generateImage(
          samplePrompt,
          "nano-banana-2",
          "1:1"
        );

        // Store the generated image
        const storedImage = await prisma.storedImage.create({
          data: {
            data: Buffer.from(result.base64, "base64"),
            mimeType: result.mimeType,
          },
        });

        // Update the style with the sample image
        await prisma.style.update({
          where: { id: style.id },
          data: { sampleImageIds: [storedImage.id] },
        });

        generated++;
      } catch (error) {
        console.error(
          `Failed to generate sample for style "${style.name}":`,
          error
        );
        // Continue with other styles even if one fails
      }
    }

    return NextResponse.json({
      message: `Generated ${generated} sample images for ${styles.length} styles`,
      generated,
      total: styles.length,
    });
  } catch (error) {
    console.error("Error generating style samples:", error);
    return NextResponse.json(
      { error: "Failed to generate style samples" },
      { status: 500 }
    );
  }
}
