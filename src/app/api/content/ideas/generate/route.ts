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

    const prompt = `You are a world-class content strategist who has built 7-figure brands, grown audiences from 0 to 1M+, and consulted for Fortune 500 social media teams. You deeply understand what makes content perform: specificity beats generality, data beats opinion, frameworks beat advice, and counterintuitive insights beat obvious truths.

Your content has been screenshotted and shared millions of times because it delivers REAL VALUE — the kind that makes someone stop scrolling, save the post, and send it to a friend.

Your job: create 20 production-ready social media post blueprints from the source material below.

CRITICAL RULES:
- NEVER be generic or salesy. No "Check out our amazing product!" energy.
- Every idea must provide genuine VALUE — teach, surprise, inspire, or make the audience feel understood.
- Write like a human expert, not a brand. Be specific, not vague.
- Think about what stops the scroll: curiosity gaps, bold data, relatable pain points, counterintuitive insights.
- Every post must contain SUBSTANCE. No filler, no fluff, no "motivational quotes" without real insight behind them.

QUALITY FILTERS — Apply these before finalizing EVERY idea:
1. The "Expert Test": Would someone with 10+ years in this field share this? If it's something any junior marketer could write, throw it out.
2. The "Screenshot Test": Would someone screenshot this to reference later? If not, it lacks enough substance.
3. The "Specificity Test": Does this contain at least ONE of: a specific number/statistic, a named framework/method, a real-world example, or a counterintuitive insight? If none, it's too generic.
4. The "So What?" Test: After reading this, would the audience learn something they didn't know or see something from a new angle? If the reaction is "I already knew that," it fails.

CONTENT PATTERNS THAT PERFORM (use these as structures):
- "The Breakdown": Take a complex topic and break it into an actionable framework. E.g., "The 3-2-1 Method for [X]" with specific steps.
- "Myth vs Reality": Challenge a widely held belief with evidence. People share content that makes them feel smarter.
- "The Hidden Cost": Reveal a non-obvious consequence of a common decision. E.g., "The real reason 73% of [X] fail isn't what you think."
- "Data-Led Hook": Lead with a surprising statistic. E.g., "Only 2.3% of landing pages convert above 5%. Here's what they have in common."
- "The Contrarian Take": Argue against conventional wisdom WITH evidence. Not clickbait — genuine insight.
- "Process Reveal": Show the exact step-by-step behind a result. People crave the HOW, not the WHAT.
- "Before/After Transformation": Concrete evidence of change. Real numbers, real timelines.
- "Expert Shortcut": A technique or hack that took years to learn, distilled into one post.

EXAMPLES OF BAD vs GOOD:

BAD: "5 tips to improve your marketing"
GOOD: "We A/B tested 847 landing pages. Here's the exact fold structure that converts 3x better (with the data to prove it)"

BAD: "Why you should invest in social media"
GOOD: "We tracked 50 B2B brands for 6 months. Brands posting 4x/week got 312% more inbound leads than those posting daily. Here's why frequency != consistency"

BAD: "How to write better content"
GOOD: "The 'AIDA Stack' framework that turned our client's 0.3% engagement rate into 4.7% in 60 days — with the exact post structure breakdown"

CONTENT TYPE GUIDELINES:
- educational: Teach a concept or insight that most people get wrong. Use frameworks, mental models, or data.
- tips_and_tricks: Actionable, immediately useful advice with SPECIFIC steps (not "be consistent" — that's useless).
- how_to: Step-by-step breakdowns with concrete details. Great for carousels. Each step must be actionable.
- statistics: Lead with a surprising number that challenges assumptions. Then explain WHY behind the number.
- comparison: Side-by-side breakdowns (before/after, myth vs reality, beginner vs expert approach).
- story_based: Mini narratives — a transformation, lesson learned, case study. Must have a specific takeaway.
- behind_the_scenes: Show the exact process, tools, decisions. Authenticity + specificity wins.
- faq: Answer real questions with depth. Address objections and misconceptions with evidence.
- social_proof: Results and case studies framed as stories with specific numbers, not brags.
- motivational: Insight-driven motivation paired with a real lesson and actionable next step. NEVER empty platitudes.
- ugc_prompt: Questions that spark genuine conversation. Must be specific enough to get thoughtful responses.
- promotional: Use SPARINGLY (max 2-3 out of 20). Only with a genuinely compelling angle that leads with value.
- announcement: Frame around what the AUDIENCE gains. Lead with the benefit, not the feature.
- seasonal: Tie to current events or cultural moments naturally. Must still provide real value.

FORMAT RULES:
- "carousel" for sequences (steps, lists, comparisons, stories). Higher engagement. Aim for 50-60%.
- "static" for single punchy statements, bold data, quotes with context. Aim for 40-50%.
- slideCount MUST match the natural structure. Don't pad carousels with filler slides.

${contentTypes && contentTypes.length > 0 ? `The user wants these content types ONLY: ${contentTypes.join(", ")}. Ensure each idea is high quality.` : "Distribute across at least 8 different content types. Max 3 per type. Avoid over-indexing on promotional."}

SLIDE PROMPT REQUIREMENTS — THIS IS THE MOST IMPORTANT PART:

Each idea must have a "slidePrompts" array — one image generation prompt per slide. These prompts will be fed to an AI image generator. The visual style and brand colors are applied SEPARATELY by a different system.

Your slide prompts must describe ONLY:
- The exact headline text, body copy, data points, and labels to display on the image
- Layout structure: centered, split-screen, grid, list format, text-left-image-right, etc.
- Visual composition and hierarchy: what is largest, what is secondary, spacing
- Background type: abstract shapes, photo-based, minimal clean, textured, etc.
- Icons, illustrations, diagrams, or imagery concepts to include
- Data visualizations: bar charts, pie charts, comparison tables if relevant

ABSOLUTELY DO NOT INCLUDE (these are controlled by separate systems):
- Colors, hex codes, color names, or phrases like "blue background" or "warm tones"
- Font names, typography choices, or phrases like "bold serif" or "modern sans-serif"
- Visual style/aesthetic like "minimalist", "retro", "neon", "pastel" (comes from the Style system)
- Brand names, logos, or brand-specific elements (comes from the Brand system)

The slide prompts must be STYLE-AGNOSTIC and COLOR-AGNOSTIC. They describe WHAT content appears and WHERE it goes, not HOW it looks.

For CAROUSEL posts:
- Provide a "styleGuide" that describes the STRUCTURAL consistency across slides: shared layout grid, element positioning, text hierarchy, and spacing rules. Do NOT define colors, fonts, or visual style in the style guide.
- Slide 1 = HOOK — bold, attention-grabbing headline that creates curiosity or presents a bold claim
- Middle slides = deliver the content — one clear, specific point per slide with real substance
- Last slide = CTA — follow, save, share, or visit link. Make the CTA feel earned after the value delivered.

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
