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

    const prompt = `You are an elite social media content strategist. Your job is to create production-ready social media post blueprints from the source material below.

CRITICAL RULES:
- NEVER be generic or salesy. No "Check out our amazing product!" energy.
- Every idea must provide genuine VALUE — teach, surprise, inspire, or make the audience feel understood.
- Write like a human, not a brand. Be specific, not vague.
- Think about what stops the scroll: curiosity gaps, bold data, relatable pain points, counterintuitive insights.

CONTENT TYPE GUIDELINES:
- educational: Teach a concept or insight. "Most people don't know..." or "The difference between X and Y"
- tips_and_tricks: Actionable, immediately useful advice with specific steps.
- how_to: Step-by-step breakdowns. Great for carousels.
- statistics: Lead with a surprising number that challenges assumptions.
- comparison: Side-by-side breakdowns (before/after, myth vs reality).
- story_based: Mini narratives — a transformation, lesson learned, case study.
- behind_the_scenes: Show the process, the real side. Authenticity wins.
- faq: Answer real questions. Address objections and misconceptions.
- social_proof: Results and case studies framed as stories, not brags.
- motivational: Insight-driven motivation paired with a real lesson. Not empty platitudes.
- ugc_prompt: Questions that spark genuine conversation and comments.
- promotional: Use SPARINGLY (max 2-3 out of 20). Only with a compelling angle.
- announcement: Frame around what the AUDIENCE gets.
- seasonal: Tie to current events or cultural moments naturally.

FORMAT RULES:
- "carousel" for sequences (steps, lists, comparisons, stories). Higher engagement. Aim for 50-60%.
- "static" for single punchy statements, bold data, quotes. Aim for 40-50%.
- slideCount MUST match the natural structure. Don't pad carousels with filler slides.

${contentTypes && contentTypes.length > 0 ? `The user wants these content types ONLY: ${contentTypes.join(", ")}. Ensure each idea is high quality.` : "Distribute across at least 8 different content types. Max 3 per type. Avoid over-indexing on promotional."}

SLIDE PROMPT REQUIREMENTS — THIS IS THE MOST IMPORTANT PART:

Each idea must have a "slidePrompts" array — one image generation prompt per slide.

Each slide prompt must focus ONLY on CONTENT and LAYOUT:
- The exact text/copy that appears on the image (headlines, body text, labels, data points)
- The layout structure (centered, split screen, grid, list, etc.)
- Visual composition (what goes where, hierarchy of elements)
- The type of background (abstract, photo-based, minimal, textured) — but NOT specific colors
- Icons, illustrations, or imagery concepts to include

DO NOT include in slide prompts:
- Specific colors, hex codes, or color palettes (these come from brand settings)
- Typography choices or font names (these come from the selected style)
- Overall visual style or aesthetic direction (this comes from the style system)
- Brand names, logos, or brand-specific elements (these are added at generation time)

The prompts should be STYLE-AGNOSTIC so they work with ANY visual style applied on top.

For CAROUSEL posts:
- Provide a "styleGuide" that describes the STRUCTURAL consistency across slides: shared layout grid, element positioning, text hierarchy, and spacing rules. Do NOT define colors or fonts in the style guide.
- Slide 1 = HOOK — bold, attention-grabbing, creates curiosity
- Middle slides = deliver the content — one clear point per slide
- Last slide = CTA — follow, save, share, or visit link

For STATIC posts:
- slidePrompts has exactly 1 entry
- styleGuide should be null

Generate exactly 20 ideas.

OUTPUT FORMAT — return a JSON array where each object has:
{
  "ideaText": "Brief human-readable summary of the post concept (1-2 sentences)",
  "contentType": "one of the content types listed above",
  "format": "static" or "carousel",
  "slideCount": number (1 for static, 2-10 for carousel),
  "styleGuide": "Structural layout consistency rules for carousel slides (null for static)",
  "slidePrompts": ["Content and layout prompt for slide 1", "Content and layout prompt for slide 2", ...]
}

SOURCE CONTENT:
"""
${sourceText}
"""

Return ONLY a valid JSON array. No markdown fencing, no explanation, no wrapping text.`;

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
      styleGuide: string | null;
      slidePrompts: string[];
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

    // Validate and normalize each idea
    const validIdeas = ideas.filter((idea) => {
      if (!idea.ideaText || !idea.contentType || !idea.format) return false;
      if (!Array.isArray(idea.slidePrompts) || idea.slidePrompts.length === 0) return false;
      return true;
    });

    if (validIdeas.length === 0) {
      return NextResponse.json(
        { error: "AI returned no valid ideas. Please try again." },
        { status: 500 }
      );
    }

    // Save all ideas to DB
    const savedIdeas = await prisma.$transaction(
      validIdeas.map((idea) => {
        const sc = idea.format === "carousel"
          ? Math.min(Math.max(idea.slideCount || 2, 2), 10)
          : 1;
        // Ensure slidePrompts length matches slideCount
        const prompts = idea.slidePrompts.slice(0, sc);
        // If AI returned fewer prompts than slides, pad with the last prompt
        while (prompts.length < sc) {
          prompts.push(prompts[prompts.length - 1]);
        }

        return prisma.contentIdea.create({
          data: {
            sourceId,
            ideaText: idea.ideaText,
            contentType: idea.contentType,
            format: idea.format,
            slideCount: sc,
            slidePrompts: prompts,
            styleGuide: idea.styleGuide || null,
          },
        });
      })
    );

    return NextResponse.json(savedIdeas);
  } catch (error) {
    console.error("Error generating ideas:", error);
    const message = error instanceof Error ? error.message : "Failed to generate content ideas";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
