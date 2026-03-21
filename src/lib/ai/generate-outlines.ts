import { generateText, Output } from "ai";
import { z } from "zod";
import { textModel } from "./config";
import { PROMPTS } from "./prompts";

const slideSchema = z.object({
  title: z.string(),
  description: z.string(),
  layoutNotes: z.string().optional(),
});

const outlineSchema = z.object({
  format: z
    .enum([
      "headline",
      "statistic",
      "quote",
      "tip-list",
      "how-to",
      "before-after",
      "question",
      "visual-first",
    ])
    .optional()
    .describe("Content format type"),
  overallTheme: z.string(),
  headline: z
    .string()
    .optional()
    .describe("Primary text on the image — punchy, 3-8 words ideal"),
  supportingText: z
    .string()
    .optional()
    .describe("Optional secondary text — 1 short sentence max"),
  textPlacement: z
    .enum([
      "center",
      "top",
      "bottom",
      "left-third",
      "right-third",
      "overlay-on-image",
    ])
    .optional()
    .describe("Where text should sit on the image"),
  visualDirection: z
    .string()
    .optional()
    .describe(
      "What the visual/graphic elements should show (imagery, not text)",
    ),
  // Backward-compatible slides array
  slides: z
    .array(slideSchema)
    .length(1)
    .describe("Exactly 1 slide for a static post"),
});

const outlinesResultSchema = z.object({
  outlines: z
    .array(outlineSchema)
    .describe("Array of structured post outlines"),
});

export type OutlineResult = z.infer<typeof outlineSchema>;
export type OutlinesResult = z.infer<typeof outlinesResultSchema>;

/**
 * Generate structured post outlines from an idea.
 */
export async function generateOutlines(
  ideaText: string,
  count: number,
  systemPrompt?: string,
): Promise<OutlineResult[]> {
  const { output } = await generateText({
    model: textModel,
    system: systemPrompt ?? PROMPTS.outlines(count),
    prompt: ideaText,
    output: Output.object({ schema: outlinesResultSchema }),
  });

  return output?.outlines ?? [];
}
