import { generateText, Output, tool, stepCountIs } from "ai";
import { z } from "zod";
import { textModel } from "./config";
import { PROMPTS } from "./prompts";

export interface ArenaCaptionDeps {
  prisma: {
    brandIdentity: {
      findFirst: (args: {
        where: { orgId: string };
        include: { palettes: boolean };
      }) => Promise<{
        name: string | null;
        tagline: string | null;
        palettes: Array<{ accentColor: string; bgColor: string }>;
      } | null>;
    };
    style: {
      findUnique: (args: {
        where: { id: string };
        select: { promptText: boolean };
      }) => Promise<{ promptText: string } | null>;
    };
  };
  fetchFromR2: (key: string) => Promise<{ data: Buffer; contentType: string }>;
}

const captionSchema = z.object({
  caption: z.string().describe("The Instagram caption text"),
  hashtags: z.array(z.string()).describe("Relevant hashtags without # prefix"),
});

export type ArenaCaptionResult = z.infer<typeof captionSchema>;

/**
 * Generate an Instagram caption for an arena entry using tool calling.
 *
 * Unlike `generateCaption`, this version works with arena entries directly
 * via an `r2Key` parameter instead of looking up a LabNode.
 */
export async function generateArenaCaption(
  outlineContext: string,
  r2Key: string,
  orgId: string,
  captionStyleId: string | null,
  deps: ArenaCaptionDeps,
  systemPrompt?: string,
): Promise<ArenaCaptionResult> {
  // Fetch caption style prompt if provided
  let captionSystemPrompt = systemPrompt ?? PROMPTS.captions;
  if (captionStyleId) {
    const captionStyle = await deps.prisma.style.findUnique({
      where: { id: captionStyleId },
      select: { promptText: true },
    });
    if (captionStyle?.promptText) {
      captionSystemPrompt += `\n\nCaption style direction:\n${captionStyle.promptText}`;
    }
  }

  const { output } = await generateText({
    model: textModel,
    system: captionSystemPrompt,
    prompt: outlineContext,
    tools: {
      describeImage: tool({
        description:
          "Analyze the image to write an accurate, visually-informed caption. Call this to understand what the image looks like.",
        inputSchema: z.object({
          reason: z
            .string()
            .describe("Why you want to analyze the image"),
        }),
        execute: async () => {
          try {
            const { data: imageData, contentType } =
              await deps.fetchFromR2(r2Key);

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
    stopWhen: stepCountIs(5),
  });

  return output ?? { caption: "", hashtags: [] };
}
