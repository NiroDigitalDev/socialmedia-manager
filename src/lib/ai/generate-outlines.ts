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
  overallTheme: z.string(),
  slides: z.array(slideSchema).length(1).describe("Exactly 1 slide for a static post"),
});

const outlinesResultSchema = z.object({
  outlines: z.array(outlineSchema).describe("Array of structured post outlines"),
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
