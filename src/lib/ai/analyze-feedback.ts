import { generateText, Output } from "ai";
import { z } from "zod";
import { textModel } from "./config";

const learningsSchema = z.object({
  keepContent: z.array(z.string()),
  keepStyle: z.array(z.string()),
  avoidContent: z.array(z.string()),
  avoidStyle: z.array(z.string()),
  contentDirectives: z
    .array(z.string())
    .describe(
      "Specific, actionable prompt instructions for content/outline generation",
    ),
  styleDirectives: z
    .array(z.string())
    .describe(
      "Specific, actionable prompt instructions for image style/visual generation",
    ),
  summary: z.string(),
});

export type StyleLearnings = z.infer<typeof learningsSchema>;

export interface FeedbackEntry {
  rating: "up" | "down";
  ratingTags: string[];
  ratingComment?: string | null;
  contentPrompt?: string | null;
  outlineContent?: unknown;
}

export async function analyzeFeedback(
  styleName: string,
  stylePrompt: string,
  entries: FeedbackEntry[],
): Promise<StyleLearnings> {
  const upEntries = entries.filter((e) => e.rating === "up");
  const downEntries = entries.filter((e) => e.rating === "down");

  const feedbackSummary = [
    `Style: "${styleName}" — ${stylePrompt}`,
    `Total entries: ${entries.length}`,
    `Approved (good to post): ${upEntries.length}`,
    upEntries.length > 0 &&
      `Approved entries:\n${upEntries
        .map((e) => {
          const outline = e.outlineContent as {
            format?: string;
            overallTheme?: string;
            headline?: string;
            supportingText?: string;
            textPlacement?: string;
            visualDirection?: string;
            slides?: Array<{ title?: string; description?: string }>;
          } | null;
          const parts: string[] = [];
          if (outline?.format) parts.push(`Format: ${outline.format}`);
          if (outline?.overallTheme)
            parts.push(`Theme: "${outline.overallTheme}"`);
          if (outline?.headline) parts.push(`Headline: "${outline.headline}"`);
          if (outline?.textPlacement)
            parts.push(`Placement: ${outline.textPlacement}`);
          if (outline?.visualDirection)
            parts.push(`Visual: ${outline.visualDirection}`);
          // Legacy fallback
          if (!outline?.headline && outline?.slides?.[0]?.title)
            parts.push(`Title: "${outline.slides[0].title}"`);
          return `- ${parts.join(" | ") || "no outline"}`;
        })
        .join("\n")}`,
    `Rejected: ${downEntries.length}`,
    downEntries.length > 0 &&
      `Rejection details:\n${downEntries
        .map(
          (e) =>
            `- Tags: [${e.ratingTags.join(", ")}]${e.ratingComment ? ` Comment: ${e.ratingComment}` : ""}`,
        )
        .join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { output } = await generateText({
    model: textModel,
    system: `You are an AI design feedback analyst for Instagram post generation. Given user ratings for AI-generated images, extract learnings AND produce actionable prompt directives.

Your output has two layers:

LAYER 1 — LEARNINGS (what worked / what didn't):
- keepContent / avoidContent: observations about content, layout, messaging
- keepStyle / avoidStyle: observations about visual style, colors, typography

LAYER 2 — DIRECTIVES (specific prompt instructions):
- contentDirectives: concrete instructions that should be inserted into the OUTLINE generation prompt. These should read like prompt instructions, not observations.
  Example observations → directives:
  - "Users liked product-focused layouts" → "Center the main subject as the visual anchor with minimal surrounding elements"
  - "Users disliked too much text" → "Limit headline to 5 words maximum. Omit supporting text unless essential"
  - "Users liked clean layouts" → "Use at least 40% whitespace. Never fill the entire image with content"

- styleDirectives: concrete instructions that should be inserted into the IMAGE generation prompt.
  Example observations → directives:
  - "Users liked warm earth tones" → "Use a warm color palette: terracotta, sage green, warm cream. Avoid cool blues and grays"
  - "Users disliked serif fonts" → "Use clean, modern sans-serif typography only"
  - "Users liked minimalist aesthetic" → "Keep visual elements to a maximum of 3. Use generous negative space"

Directives should be SPECIFIC and ACTIONABLE — they will be directly integrated into AI generation prompts. Write them as instructions, not observations.

Thumbs-down entries have rejection tags grouped into categories:
- Content tags (bad composition, cluttered / too much text, confusing layout, wrong message / off-topic, boring / generic, text too small to read, missing key information, awkward text placement) → extract CONTENT learnings + contentDirectives
- Style tags (wrong style / doesn't match, ugly colors, off-brand, bad typography, low quality / blurry, too dark / too bright, colors clash, feels outdated, too generic / stock-photo feel) → extract STYLE learnings + styleDirectives
- Both tags (too busy, doesn't feel Instagram-ready, would never post this) → extract both

Be specific and actionable. Each directive should be 1 sentence that a prompt engineer can paste directly into a system prompt.`,
    prompt: feedbackSummary,
    output: Output.object({ schema: learningsSchema }),
  });

  return (
    output ?? {
      keepContent: [],
      keepStyle: [],
      avoidContent: [],
      avoidStyle: [],
      contentDirectives: [],
      styleDirectives: [],
      summary: "No learnings generated.",
    }
  );
}
