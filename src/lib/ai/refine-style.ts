import { generateText } from "ai";
import { textModel } from "./config";

/**
 * Conservatively rewrite an image generation system prompt based on style learnings.
 * Used between arena rounds to evolve the prompt rather than appending.
 */
export async function refineImagePrompt(
  currentPrompt: string,
  styleLearnings: {
    keepStyle: string[];
    avoidStyle: string[];
    styleDirectives?: string[];
  },
  positivePrompts: string[],
  originalBasePrompt?: string,
): Promise<string> {
  const positiveExamples =
    positivePrompts.length > 0
      ? `\n\nPositive examples (image prompts users approved — extract patterns, don't copy verbatim):\n${positivePrompts
          .slice(0, 5)
          .map((p) => `- ${p.slice(0, 300)}`)
          .join("\n")}`
      : "";

  const directivesSection =
    styleLearnings.styleDirectives && styleLearnings.styleDirectives.length > 0
      ? `\n\nSpecific directives to integrate into the prompt (these are ready-to-use instructions):\n${styleLearnings.styleDirectives.map((d) => `- ${d}`).join("\n")}`
      : "";

  const anchorSection = originalBasePrompt
    ? `\n\nOriginal base prompt (for reference — the CRITICAL RULES section must always be preserved):\n"""\n${originalBasePrompt}\n"""`
    : "";

  const { text } = await generateText({
    model: textModel,
    system: `You are a prompt engineer specializing in Instagram image generation prompts. Your job is to evolve a system prompt based on user feedback to produce better Instagram post visuals.

Rules:
- Keep the structure and anything that's working — especially CRITICAL RULES and DESIGN PRINCIPLES sections
- Integrate the feedback naturally into the prompt — do NOT append it as a separate "learnings" section
- When directives are provided, weave them directly into the relevant sections as concrete instructions
- Remove or rephrase anything that contradicts the feedback
- If positive examples show patterns, extract and reinforce those patterns
- If an original base prompt is provided, ensure all its CRITICAL RULES are preserved verbatim
- Keep the output prompt concise — no longer than ~500 words
- Return ONLY the new prompt text, no explanation or commentary`,
    prompt: `Current image generation system prompt:
"""
${currentPrompt}
"""

User feedback:
- Style elements that worked well: ${styleLearnings.keepStyle.join(", ") || "none specified"}
- Style elements to avoid: ${styleLearnings.avoidStyle.join(", ") || "none specified"}${directivesSection}${positiveExamples}${anchorSection}

Write an improved version of this system prompt.`,
  });

  return text.trim();
}
