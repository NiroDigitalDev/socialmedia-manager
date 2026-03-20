import { generateText } from "ai";
import { textModel } from "./config";
import type { StyleLearnings } from "./analyze-feedback";

export async function refineStylePrompt(
  originalPrompt: string,
  learnings: StyleLearnings,
): Promise<string> {
  const { text } = await generateText({
    model: textModel,
    prompt: `Given this original image style prompt:
"""
${originalPrompt}
"""

And these learnings from user feedback:
- Keep (style): ${learnings.keepStyle.join(", ") || "none"}
- Avoid (style): ${learnings.avoidStyle.join(", ") || "none"}
- Summary: ${learnings.summary}

Write an improved style prompt that incorporates the learnings. Keep the core aesthetic but refine it based on what users liked and disliked. Return only the new prompt text, no explanation.`,
  });

  return text.trim();
}
