import { generateText, Output } from "ai";
import { z } from "zod";
import { textModel } from "./config";

const learningsSchema = z.object({
  keepContent: z.array(z.string()),
  keepStyle: z.array(z.string()),
  avoidContent: z.array(z.string()),
  avoidStyle: z.array(z.string()),
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
      `Approved entries:\n${upEntries.map((e) => {
        const outline = e.outlineContent as { overallTheme?: string; slides?: Array<{ title?: string }> } | null;
        const theme = outline?.overallTheme ? `Theme: "${outline.overallTheme}"` : "";
        const slides = outline?.slides?.map((s) => s.title).filter(Boolean).join(", ");
        const outlineInfo = theme || slides ? `${theme}${slides ? ` | Slides: ${slides}` : ""}` : "";
        return `- ${outlineInfo || "no outline"}${e.contentPrompt ? ` | Prompt: ${e.contentPrompt.slice(0, 150)}` : ""}`;
      }).join("\n")}`,
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
    system: `You are an AI design feedback analyst. Given user ratings for AI-generated images in a specific style, extract two-dimensional learnings:
- CONTENT learnings: what layouts, concepts, compositions, and messaging approaches worked or didn't
- STYLE learnings: what visual treatments, colors, textures, and aesthetic choices worked or didn't

Thumbs-up entries are positive examples — learn from what made them publishable.

Thumbs-down entries have rejection tags grouped into categories:
- Content tags (bad composition, cluttered / too much text, confusing layout, wrong message / off-topic, boring / generic, text too small to read, missing key information, awkward text placement) → extract CONTENT learnings
- Style tags (wrong style / doesn't match, ugly colors, off-brand, bad typography, low quality / blurry, too dark / too bright, colors clash, feels outdated, too generic / stock-photo feel) → extract STYLE learnings
- Both tags (too busy, doesn't feel Instagram-ready, would never post this) → extract both CONTENT and STYLE learnings

Comments may contain additional context for either dimension.
Be specific and actionable in your learnings.`,
    prompt: feedbackSummary,
    output: Output.object({ schema: learningsSchema }),
  });

  return (
    output ?? {
      keepContent: [],
      keepStyle: [],
      avoidContent: [],
      avoidStyle: [],
      summary: "No learnings generated.",
    }
  );
}
