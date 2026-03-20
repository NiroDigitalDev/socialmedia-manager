import { generateText, Output } from "ai";
import { z } from "zod";
import { textModel } from "./config";
import { PROMPTS } from "./prompts";

const ideasSchema = z.object({
  ideas: z.array(z.string()).describe("Array of distinct content ideas"),
});

export type IdeasResult = z.infer<typeof ideasSchema>;

/**
 * Generate content ideas from source text using structured output.
 *
 * No chunking — Gemini 3.1 Pro handles 1M tokens natively.
 * Full source sent as user message, task instructions as system prompt.
 */
export async function generateIdeas(
  sourceText: string,
  count: number,
  systemPrompt?: string,
): Promise<string[]> {
  const { output } = await generateText({
    model: textModel,
    system: systemPrompt ?? PROMPTS.ideas(count),
    prompt: sourceText,
    output: Output.object({ schema: ideasSchema }),
  });

  return output?.ideas ?? [];
}
