import { generateText } from "ai";
import { textModel } from "./config";

interface OutlineContent {
  overallTheme: string;
  headline?: string;
  format?: string;
  slides: Array<{ title: string; description: string; layoutNotes?: string }>;
}

export async function refineOutlinePrompt(
  currentPrompt: string,
  contentLearnings: {
    keepContent: string[];
    avoidContent: string[];
    contentDirectives?: string[];
  },
  positiveOutlines: OutlineContent[],
  originalBasePrompt?: string,
): Promise<string> {
  const positiveExamples =
    positiveOutlines.length > 0
      ? `\n\nPositive examples (outlines users approved):\n${positiveOutlines
          .map((o) => {
            const parts: string[] = [];
            if (o.format) parts.push(`Format: ${o.format}`);
            parts.push(`Theme: "${o.overallTheme}"`);
            if (o.headline) parts.push(`Headline: "${o.headline}"`);
            else if (o.slides?.[0]?.title) parts.push(`Title: "${o.slides[0].title}"`);
            return `- ${parts.join(" | ")}`;
          })
          .join("\n")}`
      : "";

  const directivesSection =
    contentLearnings.contentDirectives && contentLearnings.contentDirectives.length > 0
      ? `\n\nSpecific directives to integrate into the prompt (these are ready-to-use instructions):\n${contentLearnings.contentDirectives.map((d) => `- ${d}`).join("\n")}`
      : "";

  const anchorSection = originalBasePrompt
    ? `\n\nOriginal base prompt (for reference — do not drift too far from its core intent):\n"""\n${originalBasePrompt}\n"""`
    : "";

  const { text } = await generateText({
    model: textModel,
    system: `You are a prompt engineer specializing in Instagram content design prompts. Your job is to evolve a system prompt based on user feedback to produce better Instagram post outlines.

Rules:
- Keep the structure and anything that's working
- Integrate the feedback naturally into the prompt — do NOT append it as a separate "learnings" section
- When directives are provided, weave them directly into the relevant sections of the prompt as concrete instructions
- Remove or rephrase anything that contradicts the feedback
- If positive examples show a pattern (e.g., certain formats or headline styles work well), emphasize those patterns
- If an original base prompt is provided, stay anchored to its core intent — refine, don't replace
- Keep the output prompt concise — no longer than ~500 words
- Return ONLY the new prompt text, no explanation or commentary`,
    prompt: `Current outline system prompt:
"""
${currentPrompt}
"""

User feedback:
- Content that worked well: ${contentLearnings.keepContent.join(", ") || "none specified"}
- Content to avoid: ${contentLearnings.avoidContent.join(", ") || "none specified"}${directivesSection}${positiveExamples}${anchorSection}

Write an improved version of this system prompt.`,
  });

  return text.trim();
}
