import { generateText, Output, tool, stepCountIs } from "ai";
import { z } from "zod";
import { textModel } from "./config";
import { PROMPTS } from "./prompts";

export interface CaptionDeps {
  prisma: {
    labNode: {
      findUnique: (args: { where: { id: string } }) => Promise<{
        r2Key: string | null;
        mimeType: string | null;
      } | null>;
    };
    brandIdentity: {
      findFirst: (args: { where: { orgId: string }; include: { palettes: boolean } }) => Promise<{
        name: string | null;
        tagline: string | null;
        palettes: Array<{ accentColor: string; bgColor: string }>;
      } | null>;
    };
  };
  fetchFromR2: (key: string) => Promise<{ data: Buffer; contentType: string }>;
}

const captionSchema = z.object({
  caption: z.string().describe("The Instagram caption text"),
  hashtags: z.array(z.string()).describe("Relevant hashtags without # prefix"),
});

export type CaptionResult = z.infer<typeof captionSchema>;

/**
 * Generate an Instagram caption using tool calling for dynamic context.
 *
 * The model can use tools to:
 * - describeImage: Analyze the parent image via vision
 * - getBrandContext: Fetch brand identity for tone alignment
 */
export async function generateCaption(
  outlineContext: string,
  imageNodeId: string,
  orgId: string,
  deps: CaptionDeps,
  systemPrompt?: string,
): Promise<CaptionResult> {
  const { output } = await generateText({
    model: textModel,
    system: systemPrompt ?? PROMPTS.captions,
    prompt: outlineContext,
    tools: {
      describeImage: tool({
        description:
          "Analyze the parent image to write an accurate, visually-informed caption. Call this to understand what the image looks like.",
        inputSchema: z.object({
          nodeId: z.string().describe("The image node ID to analyze"),
        }),
        execute: async ({ nodeId }) => {
          try {
            const node = await deps.prisma.labNode.findUnique({
              where: { id: nodeId },
            });

            if (!node?.r2Key) {
              return { description: "Image not available for analysis." };
            }

            const { data: imageData, contentType } = await deps.fetchFromR2(
              node.r2Key,
            );

            // Use the same text model for vision (gemini-3.1-pro supports multimodal)
            const visionResult = await generateText({
              model: textModel,
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "image",
                      image: imageData,
                      mediaType: contentType,
                    },
                    {
                      type: "text",
                      text: "Describe this image in detail for a social media caption writer. Focus on visual elements, mood, colors, composition, and the message it conveys.",
                    },
                  ],
                },
              ],
            });

            return { description: visionResult.text };
          } catch {
            return {
              description:
                "Could not analyze the image. Write the caption based on the outline context only.",
            };
          }
        },
      }),

      getBrandContext: tool({
        description:
          "Get the brand identity (name, tagline, colors) to align caption tone and voice.",
        inputSchema: z.object({
          orgId: z.string().describe("The organization ID"),
        }),
        execute: async ({ orgId: oid }) => {
          try {
            const brand = await deps.prisma.brandIdentity.findFirst({
              where: { orgId: oid },
              include: { palettes: true },
            });

            if (!brand) {
              return { brand: null };
            }

            return {
              brand: {
                name: brand.name,
                tagline: brand.tagline,
                colors:
                  brand.palettes.length > 0
                    ? {
                        accent: brand.palettes[0].accentColor,
                        background: brand.palettes[0].bgColor,
                      }
                    : null,
              },
            };
          } catch {
            return { brand: null };
          }
        },
      }),
    },
    output: Output.object({ schema: captionSchema }),
    // Tool calls + structured output: need enough steps
    // 1: initial response (may call tools), 2: tool results, 3: structured output
    stopWhen: stepCountIs(5),
  });

  return output ?? { caption: "", hashtags: [] };
}
