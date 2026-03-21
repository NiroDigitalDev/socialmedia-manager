import { generateText } from "ai";
import { textModel } from "./config";

/**
 * Conservatively rewrite an image generation system prompt based on style learnings.
 * Used between arena rounds to evolve the prompt rather than appending.
 */
export async function refineImagePrompt(
  currentPrompt: string,
  styleLearnings: { keepStyle: string[]; avoidStyle: string[] },
  positivePrompts: string[],
): Promise<string> {
  const positiveExamples =
    positivePrompts.length > 0
      ? `\n\nPositive examples (image prompts users approved — extract patterns, don't copy verbatim):\n${positivePrompts
          .slice(0, 5)
          .map((p) => `- ${p.slice(0, 300)}`)
          .join("\n")}`
      : "";

  const { text } = await generateText({
    model: textModel,
    system: `You are a prompt engineer specializing in image generation prompts. Your job is to conservatively evolve a system prompt based on user feedback.

Rules:
- Keep the structure and anything that's working — especially CRITICAL RULES sections
- Integrate the feedback naturally into the prompt — do NOT append it as a separate "learnings" section
- Remove or rephrase anything that contradicts the feedback
- If positive examples are provided, extract patterns that made them successful and weave those into the prompt
- Return ONLY the new prompt text, no explanation or commentary`,
    prompt: `Current image generation system prompt:
"""
${currentPrompt}
"""

User feedback:
- Style elements that worked well: ${styleLearnings.keepStyle.join(", ") || "none specified"}
- Style elements to avoid: ${styleLearnings.avoidStyle.join(", ") || "none specified"}${positiveExamples}

Write an improved version of this system prompt.`,
  });

  return text.trim();
}
