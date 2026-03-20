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

interface FeedbackEntry {
  rating: "up" | "down" | "super";
  contentScore?: number | null;
  styleScore?: number | null;
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
  const superEntries = entries.filter(e => e.rating === "super");
  const upEntries = entries.filter(e => e.rating === "up");
  const downEntries = entries.filter(e => e.rating === "down");

  const feedbackSummary = [
    `Style: "${styleName}" — ${stylePrompt}`,
    `Total entries: ${entries.length}`,
    `Super (gallery adds, gold standard): ${superEntries.length}`,
    superEntries.length > 0 && `Gold standard prompts:\n${superEntries.map(e => `- ${e.contentPrompt?.slice(0, 200)}`).join("\n")}`,
    `Liked: ${upEntries.length}`,
    upEntries.length > 0 && `Liked entries (content/style scores):\n${upEntries.map(e => `- Content: ${e.contentScore}/5, Style: ${e.styleScore}/5 | Prompt: ${e.contentPrompt?.slice(0, 100)}`).join("\n")}`,
    `Rejected: ${downEntries.length}`,
    downEntries.length > 0 && `Rejection reasons:\n${downEntries.map(e => `- Tags: [${e.ratingTags.join(", ")}]${e.ratingComment ? ` Comment: ${e.ratingComment}` : ""}`).join("\n")}`,
  ].filter(Boolean).join("\n\n");

  const { output } = await generateText({
    model: textModel,
    system: `You are an AI design feedback analyst. Given user ratings for AI-generated images in a specific style, extract two-dimensional learnings:
- CONTENT learnings: what layouts, concepts, compositions, and messaging approaches worked or didn't
- STYLE learnings: what visual treatments, colors, textures, and aesthetic choices worked or didn't

Super-rated entries (gallery adds) are the gold standard — weight them highest.
Thumbs-up entries with high content + low style scores mean the concept was good but visual execution needs work.
Thumbs-up entries with low content + high style scores mean the visuals were great but the concept needs rethinking.
Thumbs-down tags indicate specific problems: content tags (bad composition, cluttered, confusing layout, wrong message) vs style tags (wrong style, ugly colors, off-brand, bad text/typography, low quality).

Be specific and actionable in your learnings.`,
    prompt: feedbackSummary,
    output: Output.object({ schema: learningsSchema }),
  });

  return output ?? { keepContent: [], keepStyle: [], avoidContent: [], avoidStyle: [], summary: "No learnings generated." };
}
