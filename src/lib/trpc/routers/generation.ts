import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, orgProtectedProcedure } from "../init";
import {
  generateImage,
  geminiText,
  GEMINI_IMAGE_MODELS,
  ASPECT_RATIOS,
  type ModelKey,
  type AspectRatioKey,
} from "@/lib/gemini";

const modelKeySchema = z.enum(
  Object.keys(GEMINI_IMAGE_MODELS) as [ModelKey, ...ModelKey[]]
);
const aspectRatioSchema = z.enum(
  Object.keys(ASPECT_RATIOS) as [AspectRatioKey, ...AspectRatioKey[]]
);

const platformSchema = z.enum([
  "instagram",
  "linkedin",
  "reddit",
  "x",
  "blog",
  "email",
]);

// Text-only platforms that produce textContent instead of images
const TEXT_ONLY_PLATFORMS = new Set(["blog", "email"]);

export const generationRouter = router({
  // ---------- Outline ----------
  generateOutline: orgProtectedProcedure
    .input(
      z.object({
        prompt: z.string().min(1),
        platforms: z.array(platformSchema).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const platformList = input.platforms.join(", ");

      const outlinePrompt = `You are a senior social media strategist. Given the user's brief below, produce a structured content outline for each requested platform.

USER BRIEF:
"""
${input.prompt}
"""

PLATFORMS: ${platformList}

For EACH platform, produce:
- platform: the platform name
- headline: a scroll-stopping hook headline (max 15 words)
- sections: an array of 2-5 section objects, each with:
  - title: section heading
  - bullet_points: array of 1-3 specific talking points
  - cta: optional call-to-action text for this section
- tone: recommended tone for this platform (e.g., "professional", "casual", "inspirational")
- format_recommendation: "static", "carousel", or "text" based on what works best for this platform and content

OUTPUT: Return a JSON array of platform outline objects. No markdown fencing.
Example: [{ "platform": "instagram", "headline": "...", "sections": [...], "tone": "...", "format_recommendation": "carousel" }]`;

      const text = await geminiText.generateContent(outlinePrompt);

      const cleaned = text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      try {
        const parsed = JSON.parse(cleaned);
        if (!Array.isArray(parsed)) {
          throw new Error("Expected array");
        }
        return parsed;
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to parse outline from AI. Please try again.",
        });
      }
    }),

  // ---------- Generate ----------
  generate: orgProtectedProcedure
    .input(
      z.object({
        prompt: z.string().min(1),
        platforms: z.array(platformSchema).min(1),
        styleIds: z.array(z.string()).default([]),
        brandIdentityId: z.string().optional(),
        colorOverride: z
          .object({ accent: z.string(), bg: z.string() })
          .optional(),
        formatPerPlatform: z
          .record(platformSchema, z.enum(["static", "carousel", "text"]))
          .optional(),
        aspectRatioPerPlatform: z
          .record(platformSchema, aspectRatioSchema)
          .optional(),
        model: modelKeySchema.default("nano-banana-2"),
        variations: z.number().min(1).max(6).default(1),
        includeLogo: z.boolean().default(false),
        outline: z.any().optional(), // The outline sections from generateOutline
        slideCount: z.number().min(1).max(10).default(1),
        slidePrompts: z.array(z.string()).optional(),
        styleGuide: z.string().optional(),
        contentIdeaId: z.string().optional(),
        projectId: z.string().optional(),
        campaignId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const numVariations = Math.min(Math.max(input.variations, 1), 6);

      // ---------- Brand context ----------
      let brandColorContext = "";
      let logoContext = "";
      let logoReferenceImages: { base64: string; mimeType: string }[] = [];

      if (input.brandIdentityId) {
        // New per-project brand identity
        const brandIdentity = await ctx.prisma.brandIdentity.findFirst({
          where: { id: input.brandIdentityId, orgId: ctx.orgId },
          include: { palettes: true },
        });

        if (brandIdentity) {
          const parts: string[] = [];
          if (brandIdentity.name) parts.push(`Brand name: ${brandIdentity.name}`);
          if (brandIdentity.tagline)
            parts.push(`Tagline: "${brandIdentity.tagline}"`);

          if (input.colorOverride) {
            parts.push(
              `You MUST use these exact colors: Accent/Primary color: ${input.colorOverride.accent}, Background color: ${input.colorOverride.bg}. The accent color should be used for headlines, buttons, icons, and highlights. The background color should be the primary background of the design. These two colors must dominate the image.`
            );
          } else if (brandIdentity.palettes.length > 0) {
            const palette = brandIdentity.palettes[0];
            parts.push(
              `You MUST use these exact brand colors: Accent: ${palette.accentColor}, Background: ${palette.bgColor}. These colors should dominate the image.`
            );
          }

          brandColorContext = parts.join(". ");

          // Logo from brand identity
          if (input.includeLogo && brandIdentity.logoAssetId) {
            const logoAsset = await ctx.prisma.asset.findUnique({
              where: { id: brandIdentity.logoAssetId },
            });
            // Note: Asset uses R2 — if needed, fetch from R2. For now, skip logo ref images
            // for BrandIdentity (R2 migration in progress). The prompt still mentions logo.
            if (logoAsset) {
              logoContext =
                "Include the brand logo prominently but tastefully in the design (e.g., corner, header, or watermark position).";
            }
          }
        }
      } else {
        // Fallback: legacy BrandSettings
        const brand = await ctx.prisma.brandSettings.findFirst();
        if (brand) {
          const parts: string[] = [];
          if (brand.brandName) parts.push(`Brand name: ${brand.brandName}`);
          if (brand.tagline) parts.push(`Tagline: "${brand.tagline}"`);

          if (input.colorOverride) {
            parts.push(
              `You MUST use these exact colors: Accent/Primary color: ${input.colorOverride.accent}, Background color: ${input.colorOverride.bg}. The accent color should be used for headlines, buttons, icons, and highlights. The background color should be the primary background of the design. These two colors must dominate the image.`
            );
          } else if (brand.colors.length > 0) {
            parts.push(
              `You MUST use these exact brand colors as the primary color palette for the design: ${brand.colors.join(", ")}. These colors should dominate the image — backgrounds, text, accents, and visual elements should all use these colors.`
            );
          }

          brandColorContext = parts.join(". ");

          if (input.includeLogo && brand.logoImageId) {
            logoContext =
              "The attached image is the brand logo. You MUST incorporate this exact logo into the generated image. Place it prominently but tastefully (e.g., corner, header, or watermark position).";
            const logoImage = await ctx.prisma.storedImage.findUnique({
              where: { id: brand.logoImageId },
            });
            if (logoImage) {
              logoReferenceImages.push({
                base64: Buffer.from(logoImage.data).toString("base64"),
                mimeType: logoImage.mimeType,
              });
            }
          }
        }
      }

      // ---------- Content idea (slide prompts) ----------
      let contentIdea: {
        slidePrompts: string[];
        styleGuide: string | null;
        format: string;
        slideCount: number;
      } | null = null;

      if (input.slidePrompts && input.slidePrompts.length > 0) {
        contentIdea = {
          slidePrompts: input.slidePrompts,
          styleGuide: input.styleGuide ?? null,
          format: "carousel",
          slideCount: input.slideCount,
        };
      } else if (input.contentIdeaId) {
        contentIdea = await ctx.prisma.contentIdea.findUnique({
          where: { id: input.contentIdeaId },
          select: {
            slidePrompts: true,
            styleGuide: true,
            format: true,
            slideCount: true,
          },
        });
      }

      // ---------- Fetch styles ----------
      const styles =
        input.styleIds.length > 0
          ? await ctx.prisma.style.findMany({
              where: { id: { in: input.styleIds } },
            })
          : [null]; // null = no style applied

      // ---------- Generate per platform x style x variation ----------
      const postIds: string[] = [];

      for (const platform of input.platforms) {
        const isTextOnly = TEXT_ONLY_PLATFORMS.has(platform);
        const format =
          input.formatPerPlatform?.[platform] ?? (isTextOnly ? "text" : "static");
        const aspectRatio =
          input.aspectRatioPerPlatform?.[platform] ?? "1:1";

        for (const style of styles) {
          const stylePrompt = style?.promptText ?? "";

          // Build context parts
          const contextParts = [
            stylePrompt && `VISUAL STYLE: ${stylePrompt}`,
            brandColorContext && `BRAND: ${brandColorContext}`,
            logoContext,
          ].filter(Boolean);
          const fullContext = contextParts.join("\n\n");

          const hasSlidePrompts =
            contentIdea?.slidePrompts && contentIdea.slidePrompts.length > 0;
          const numSlides =
            format === "carousel"
              ? Math.min(input.slideCount, 10)
              : 1;
          const refs =
            logoReferenceImages.length > 0 ? logoReferenceImages : undefined;

          for (let v = 0; v < numVariations; v++) {
            // Create the post record
            const post = await ctx.prisma.generatedPost.create({
              data: {
                prompt: input.prompt,
                styleId: style?.id ?? null,
                contentIdeaId: input.contentIdeaId ?? null,
                format,
                aspectRatio,
                model: input.model,
                includeLogo: input.includeLogo,
                status: "generating",
                platform,
                orgId: ctx.orgId,
                projectId: input.projectId ?? null,
                campaignId: input.campaignId ?? null,
              },
            });

            postIds.push(post.id);

            // ---------- Text-only generation ----------
            if (isTextOnly || format === "text") {
              try {
                const textPrompt = `${fullContext ? fullContext + "\n\n" : ""}Write a ${platform} post based on this brief:\n\n${input.prompt}${numVariations > 1 ? `\n\nVARIATION ${v + 1}: Make this distinct from other variations while keeping the same core message.` : ""}`;

                const textContent = await geminiText.generateContent(textPrompt);

                await ctx.prisma.generatedPost.update({
                  where: { id: post.id },
                  data: {
                    textContent,
                    status: "completed",
                  },
                });
              } catch {
                await ctx.prisma.generatedPost.update({
                  where: { id: post.id },
                  data: { status: "failed" },
                });
              }
              continue;
            }

            // ---------- Image generation ----------
            const generateSlide = async (slideNumber: number) => {
              const parts: string[] = [];

              if (fullContext) {
                parts.push(fullContext);
              }

              if (contentIdea?.styleGuide && format === "carousel") {
                parts.push(
                  `LAYOUT GUIDE (apply consistently to ALL slides): ${contentIdea.styleGuide}`
                );
              }

              if (
                hasSlidePrompts &&
                contentIdea!.slidePrompts[slideNumber - 1]
              ) {
                parts.push(
                  `SLIDE ${slideNumber} OF ${numSlides}:\n${contentIdea!.slidePrompts[slideNumber - 1]}`
                );
              } else {
                let manual = input.prompt;
                if (format === "carousel" && numSlides > 1) {
                  manual = `${manual}. This is slide ${slideNumber} of ${numSlides} in a carousel post. Make it visually consistent with other slides but with unique content for this slide.`;
                }
                parts.push(manual);
              }

              if (numVariations > 1) {
                parts.push(
                  `VARIATION ${v + 1}: Make this visually distinct from other variations while keeping the same core message.`
                );
              }

              const slidePrompt = parts.join("\n\n");
              const result = await generateImage(
                slidePrompt,
                input.model,
                aspectRatio as AspectRatioKey,
                refs
              );

              return ctx.prisma.generatedImage.create({
                data: {
                  postId: post.id,
                  slideNumber,
                  data: Buffer.from(result.base64, "base64"),
                  mimeType: result.mimeType,
                },
              });
            };

            try {
              await Promise.all(
                Array.from({ length: numSlides }, (_, i) =>
                  generateSlide(i + 1)
                )
              );

              await ctx.prisma.generatedPost.update({
                where: { id: post.id },
                data: { status: "completed" },
              });
            } catch {
              await ctx.prisma.generatedPost.update({
                where: { id: post.id },
                data: { status: "failed" },
              });
            }
          }
        }
      }

      return { postIds };
    }),

  // ---------- Get Results (for polling) ----------
  getResults: orgProtectedProcedure
    .input(z.object({ postIds: z.array(z.string()).min(1) }))
    .query(async ({ ctx, input }) => {
      const posts = await ctx.prisma.generatedPost.findMany({
        where: {
          id: { in: input.postIds },
          orgId: ctx.orgId,
        },
        include: {
          images: {
            orderBy: { slideNumber: "asc" },
            select: { id: true, slideNumber: true, mimeType: true },
          },
          style: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return posts.map((post) => ({
        ...post,
        images: post.images.map((img) => ({
          ...img,
          url: `/api/images/${img.id}?type=generated`,
        })),
      }));
    }),

  // ---------- List (gallery, paginated) ----------
  list: orgProtectedProcedure
    .input(
      z.object({
        projectId: z.string().optional(),
        campaignId: z.string().optional(),
        platform: platformSchema.optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { orgId: ctx.orgId };
      if (input.projectId) where.projectId = input.projectId;
      if (input.campaignId) where.campaignId = input.campaignId;
      if (input.platform) where.platform = input.platform;

      const [posts, total] = await Promise.all([
        ctx.prisma.generatedPost.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: input.limit,
          skip: input.offset,
          include: {
            images: {
              orderBy: { slideNumber: "asc" },
              take: 1,
              select: { id: true, mimeType: true },
            },
            style: { select: { name: true } },
          },
        }),
        ctx.prisma.generatedPost.count({ where }),
      ]);

      return {
        posts: posts.map((post) => ({
          ...post,
          thumbnailUrl: post.images[0]
            ? `/api/images/${post.images[0].id}?type=generated`
            : null,
          images: undefined, // Strip raw images array from list view
        })),
        total,
        hasMore: input.offset + input.limit < total,
      };
    }),

  // ---------- By Campaign ----------
  byCampaign: orgProtectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ ctx, input }) => {
      const posts = await ctx.prisma.generatedPost.findMany({
        where: { campaignId: input.campaignId, orgId: ctx.orgId },
        orderBy: { createdAt: "desc" },
        include: {
          images: {
            orderBy: { slideNumber: "asc" },
            take: 1,
            select: { id: true, mimeType: true },
          },
          style: { select: { name: true } },
        },
      });

      return posts.map((post) => ({
        ...post,
        thumbnailUrl: post.images[0]
          ? `/api/images/${post.images[0].id}?type=generated`
          : null,
      }));
    }),

  // ---------- Recent (existing, improved) ----------
  recent: orgProtectedProcedure.query(async ({ ctx }) => {
    const posts = await ctx.prisma.generatedPost.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        images: {
          orderBy: { slideNumber: "asc" },
          take: 1,
          select: { id: true, mimeType: true },
        },
        style: { select: { name: true } },
      },
    });

    return posts.map((post) => ({
      ...post,
      thumbnailUrl: post.images[0]
        ? `/api/images/${post.images[0].id}?type=generated`
        : null,
    }));
  }),

  // ---------- Generate Description ----------
  generateDescription: orgProtectedProcedure
    .input(z.object({ postId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const post = await ctx.prisma.generatedPost.findFirst({
        where: { id: input.postId, orgId: ctx.orgId },
        include: { style: { select: { name: true } } },
      });

      if (!post) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
      }

      const descPrompt = `Write a social media caption for a ${post.platform ?? "general"} post.

Post details:
- Prompt used: "${post.prompt}"
- Format: ${post.format}
- Style: ${post.style?.name ?? "none"}
${post.platform ? `- Platform: ${post.platform}` : ""}

Write a compelling, platform-appropriate caption. Include relevant hashtags if appropriate for the platform. Keep it concise but engaging. Return ONLY the caption text.`;

      const description = await geminiText.generateContent(descPrompt);

      const updated = await ctx.prisma.generatedPost.update({
        where: { id: input.postId },
        data: { description: description.trim() },
      });

      return { description: updated.description };
    }),

  // ---------- Update Description ----------
  updateDescription: orgProtectedProcedure
    .input(
      z.object({
        postId: z.string(),
        description: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const post = await ctx.prisma.generatedPost.findFirst({
        where: { id: input.postId, orgId: ctx.orgId },
      });

      if (!post) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
      }

      const updated = await ctx.prisma.generatedPost.update({
        where: { id: input.postId },
        data: { description: input.description },
      });

      return { description: updated.description };
    }),

  // ---------- Delete Post ----------
  deletePost: orgProtectedProcedure
    .input(z.object({ postId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const post = await ctx.prisma.generatedPost.findFirst({
        where: { id: input.postId, orgId: ctx.orgId },
      });

      if (!post) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });
      }

      // Cascade delete handles images via onDelete: Cascade in schema
      await ctx.prisma.generatedPost.delete({
        where: { id: input.postId },
      });

      return { success: true };
    }),
});
