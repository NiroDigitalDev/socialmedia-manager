import { generateText } from "ai";
import { textModel } from "./config";

interface OutlineContent {
  overallTheme: string;
  slides: Array<{ title: string; description: string; layoutNotes?: string }>;
}

export async function refineOutlinePrompt(
  currentPrompt: string,
  contentLearnings: { keepContent: string[]; avoidContent: string[] },
  positiveOutlines: OutlineContent[],
): Promise<string> {
  const positiveExamples =
    positiveOutlines.length > 0
      ? `\n\nPositive examples (outlines users approved):\n${positiveOutlines
          .map(
            (o) =>
              `- Theme: "${o.overallTheme}" | Slides: ${o.slides.map((s) => s.title).join(", ")}`,
          )
          .join("\n")}`
      : "";

  const { text } = await generateText({
    model: textModel,
    system: `You are a prompt engineer specializing in content design prompts. Your job is to conservatively evolve a system prompt based on user feedback.

Rules:
- Keep the structure and anything that's working
- Integrate the feedback naturally into the prompt — do NOT append it as a separate "learnings" section
- Remove or rephrase anything that contradicts the feedback
- If positive examples are provided, subtly steer the prompt toward those patterns
- Return ONLY the new prompt text, no explanation or commentary`,
    prompt: `Current outline system prompt:
"""
${currentPrompt}
"""

User feedback:
- Content that worked well: ${contentLearnings.keepContent.join(", ") || "none specified"}
- Content to avoid: ${contentLearnings.avoidContent.join(", ") || "none specified"}${positiveExamples}

Write an improved version of this system prompt.`,
  });

  return text.trim();
}
