import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { geminiFlash } from "@/lib/gemini";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const post = await prisma.generatedPost.findUnique({
      where: { id },
      include: {
        style: true,
        contentIdea: true,
        images: true,
      },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Fetch brand settings for context
    const brand = await prisma.brandSettings.findFirst();

    // Build context for Gemini
    const contextParts: string[] = [];

    if (brand) {
      contextParts.push(`Brand: ${brand.brandName}`);
      if (brand.tagline) contextParts.push(`Tagline: ${brand.tagline}`);
    }

    if (post.style) {
      contextParts.push(`Visual style: ${post.style.name}`);
    }

    if (post.contentIdea) {
      contextParts.push(`Content type: ${post.contentIdea.contentType}`);
      contextParts.push(`Content idea: ${post.contentIdea.ideaText}`);
    }

    contextParts.push(`Image prompt used: ${post.prompt}`);
    contextParts.push(`Format: ${post.format}${post.format === "carousel" ? ` (${post.images?.length || 1} slides)` : ""}`);

    const geminiPrompt = `You are a social media expert. Generate an engaging Instagram/Facebook post caption for the following post.

${contextParts.join("\n")}

Requirements:
- Write an attention-grabbing caption that matches the content and brand voice
- Include relevant hashtags (5-10)
- Keep it concise but engaging
- If it's a carousel, mention what viewers can expect by swiping
- Use line breaks for readability
- Do NOT include any markdown formatting
- Return ONLY the caption text, nothing else`;

    const result = await geminiFlash.generateContent(geminiPrompt);
    const description = result.response.text().trim();

    // Save the description to the post
    const updated = await prisma.generatedPost.update({
      where: { id },
      data: { description },
    });

    return NextResponse.json({ description: updated.description });
  } catch (error) {
    console.error("Generate description error:", error);
    return NextResponse.json(
      { error: "Failed to generate description" },
      { status: 500 }
    );
  }
}
