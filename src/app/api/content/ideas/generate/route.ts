import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { geminiText } from "@/lib/gemini";

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

    const prompt = `You are an elite social media strategist who has grown multiple brands to millions of followers. Your job is to extract the most compelling, scroll-stopping content ideas from the source material below.

CRITICAL RULES:
- NEVER be generic or salesy. No "Check out our amazing product!" energy.
- Every idea must provide genuine VALUE to the audience — teach them something, make them think, surprise them, or make them feel understood.
- Write like a human, not a brand. Use conversational language. Be specific, not vague.
- The ideaText must be a DETAILED visual description of what the social media post image should look like — describe the layout, text overlays, visual elements, colors, and mood so an AI image generator can create it.
- Think about what makes people STOP scrolling: curiosity gaps, bold claims backed by data, relatable pain points, counterintuitive insights, "I never knew that" moments.

CONTENT TYPE GUIDELINES (use the right type for the right purpose):
- educational: Teach a specific concept, framework, or insight. "Most people don't know..." or "The difference between X and Y"
- tips_and_tricks: Actionable, immediately useful advice. Specific steps, not vague suggestions.
- how_to: Step-by-step breakdowns. Great for carousels.
- statistics: Lead with a surprising number or data point that challenges assumptions.
- comparison: Side-by-side breakdowns (before/after, this vs that, myth vs reality).
- story_based: Mini narratives — a transformation, a lesson learned, a case study.
- behind_the_scenes: Show the process, the work, the real side. Authenticity wins.
- faq: Answer real questions people actually ask. Address objections and misconceptions.
- social_proof: Results, testimonials, case studies — but framed as stories, not brags.
- motivational: Insight-driven motivation, not empty platitudes. Pair with a real lesson.
- ugc_prompt: Questions or prompts that spark genuine conversation and comments.
- promotional: Use SPARINGLY (max 2-3 out of 20). Only when there's a genuinely compelling offer or unique angle.
- announcement: News, launches, updates — but frame them around what the AUDIENCE gets.
- seasonal: Tie content to current events, trends, or cultural moments naturally.

FORMAT GUIDANCE:
- Use "carousel" for ideas that have a natural sequence (steps, lists, comparisons, stories with multiple beats). Carousels get higher engagement.
- Use "static" for single punchy statements, bold data points, quotes, or simple visuals.
- Aim for roughly 50-60% carousels, 40-50% static.
- Carousel slideCount should match the natural structure of the content (don't pad it).

${contentTypes && contentTypes.length > 0 ? `The user specifically wants these content types: ${contentTypes.join(", ")}. Generate ideas ONLY in these categories, but ensure each idea is high quality and genuinely valuable.` : "Distribute ideas across at least 8 different content types. No more than 3 ideas of the same type. Avoid over-indexing on promotional content."}

Generate exactly 20 ideas.

For each idea, return:
- ideaText: A detailed visual description for the post image (what it looks like, text on the image, layout, visual style, mood)
- contentType: one of [promotional, educational, social_proof, tips_and_tricks, behind_the_scenes, motivational, how_to, faq, comparison, announcement, ugc_prompt, seasonal, story_based, statistics]
- format: "static" or "carousel"
- slideCount: number of slides (1 for static, 2-10 for carousel)

SOURCE CONTENT:
"""
${sourceText}
"""

Return ONLY a valid JSON array of objects. No markdown, no explanation, no wrapping.`;

    const text = await geminiText.generateContent(prompt);

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
