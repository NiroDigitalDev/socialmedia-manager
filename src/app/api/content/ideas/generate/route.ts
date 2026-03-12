import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { geminiFlash } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceId, contentTypes } = body as {
      sourceId: string;
      contentTypes?: string[];
    };

    if (!sourceId) {
      return NextResponse.json(
        { error: "sourceId is required" },
        { status: 400 }
      );
    }

    const source = await prisma.contentSource.findUnique({
      where: { id: sourceId },
    });

    if (!source) {
      return NextResponse.json(
        { error: "Content source not found" },
        { status: 404 }
      );
    }

    const sourceText = source.rawText;

    const prompt = `You are a social media content strategist. Based on the following content, generate 20+ unique social media post ideas.

For each idea, provide:
- ideaText: The actual post idea/caption text (detailed enough to use as an image generation prompt)
- contentType: one of [promotional, educational, social_proof, tips_and_tricks, behind_the_scenes, motivational, how_to, faq, comparison, announcement, ugc_prompt, seasonal, story_based, statistics]
- format: either "static" or "carousel"
- slideCount: if carousel, how many slides (2-10), if static then 1

${contentTypes && contentTypes.length > 0 ? `Focus on these content types: ${contentTypes.join(", ")}` : "Mix different content types for variety."}

Content to analyze:
"""
${sourceText}
"""

Return ONLY a valid JSON array of objects. No markdown, no explanation.`;

    const result = await geminiFlash.generateContent(prompt);
    const text = result.response.text();

    // Parse the JSON response, stripping any markdown fencing
    const cleanedText = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let ideas: Array<{
      ideaText: string;
      contentType: string;
      format: string;
      slideCount: number;
    }>;

    try {
      ideas = JSON.parse(cleanedText);
    } catch {
      console.error("Failed to parse Gemini response:", cleanedText);
      return NextResponse.json(
        { error: "Failed to parse AI response. Please try again." },
        { status: 500 }
      );
    }

    if (!Array.isArray(ideas) || ideas.length === 0) {
      return NextResponse.json(
        { error: "AI returned no ideas. Please try again." },
        { status: 500 }
      );
    }

    // Save all ideas to DB
    const savedIdeas = await prisma.$transaction(
      ideas.map((idea) =>
        prisma.contentIdea.create({
          data: {
            sourceId,
            ideaText: idea.ideaText,
            contentType: idea.contentType,
            format: idea.format,
            slideCount: idea.format === "carousel" ? Math.min(Math.max(idea.slideCount || 2, 2), 10) : 1,
          },
        })
      )
    );

    return NextResponse.json(savedIdeas);
  } catch (error) {
    console.error("Error generating ideas:", error);
    return NextResponse.json(
      { error: "Failed to generate content ideas" },
      { status: 500 }
    );
  }
}
