# Generation Data Layer Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Create a comprehensive Generation tRPC router with all procedures needed for the generate flow, gallery, and campaign views, plus custom hooks with polling and optimistic updates.
**Depends on:** Plan 01 (Style Data Layer) — the `styleRouter` must be registered, but generation router can be built in parallel since it only references the `Style` Prisma model (not the tRPC router).
**Architecture:** The generation router replaces the existing REST `POST /api/generate` endpoint and the stub `generationRouter`. It orchestrates Gemini image/text generation, stores results in `GeneratedPost` + `GeneratedImage` models, and supports both the legacy `BrandSettings` and the new per-project `BrandIdentity` system. Hooks use TanStack Query with polling for in-progress generations and optimistic updates for description edits.
**Tech Stack:** tRPC v11, `@trpc/tanstack-react-query`, TanStack Query, Prisma, Gemini (`@google/genai`), Zod, Sonner (toast)

---

## Task 1: Replace the Generation tRPC Router

**File:** `src/lib/trpc/routers/generation.ts` — replace entire file

```typescript
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
```

---

## Task 2: Create Generation Hooks

**File:** `src/hooks/use-generations.ts` (new file)

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";

export function useGenerateOutline() {
  const trpc = useTRPC();
  return useMutation({
    ...trpc.generation.generateOutline.mutationOptions(),
    onError: () => {
      toast.error("Failed to generate outline");
    },
  });
}

export function useGenerate() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.generation.generate.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.generation.recent.queryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.generation.list.queryKey(),
      });
    },
    onError: () => {
      toast.error("Failed to generate content");
    },
  });
}

export function useGenerationResults(postIds: string[] | undefined) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.generation.getResults.queryOptions({ postIds: postIds ?? [] }),
    enabled: !!postIds && postIds.length > 0,
    // Poll every 2s while any post is still generating
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const hasGenerating = data.some(
        (post: any) => post.status === "generating"
      );
      return hasGenerating ? 2000 : false;
    },
  });
}

export function useGenerationList(filters?: {
  projectId?: string;
  campaignId?: string;
  platform?: "instagram" | "linkedin" | "reddit" | "x" | "blog" | "email";
  limit?: number;
  offset?: number;
}) {
  const trpc = useTRPC();
  return useQuery(
    trpc.generation.list.queryOptions({
      projectId: filters?.projectId,
      campaignId: filters?.campaignId,
      platform: filters?.platform,
      limit: filters?.limit ?? 20,
      offset: filters?.offset ?? 0,
    })
  );
}

export function useCampaignGenerations(campaignId: string | undefined) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.generation.byCampaign.queryOptions({ campaignId: campaignId! }),
    enabled: !!campaignId,
  });
}

export function useRecentGenerations() {
  const trpc = useTRPC();
  return useQuery(trpc.generation.recent.queryOptions());
}

export function useGenerateDescription() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.generation.generateDescription.mutationOptions(),
    onMutate: async (variables) => {
      // Optimistic: show "Generating..." placeholder
      const resultsKey = trpc.generation.getResults.queryKey();
      await queryClient.cancelQueries({ queryKey: resultsKey });

      // We can't precisely target the right cache key without postIds,
      // so we just invalidate after success
      return {};
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.generation.getResults.queryKey(),
      });
    },
    onError: () => {
      toast.error("Failed to generate description");
    },
  });
}

export function useUpdateDescription() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.generation.updateDescription.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.generation.getResults.queryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.generation.list.queryKey(),
      });
    },
    onError: () => {
      toast.error("Failed to update description");
    },
  });
}

export function useDeletePost() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.generation.deletePost.mutationOptions(),
    onMutate: async (variables) => {
      // Optimistic removal from list
      const listKey = trpc.generation.list.queryKey();
      await queryClient.cancelQueries({ queryKey: listKey });
      const previousList = queryClient.getQueryData(listKey);

      // Remove from all matching list queries
      queryClient.setQueriesData({ queryKey: listKey }, (old: any) => {
        if (!old?.posts) return old;
        return {
          ...old,
          posts: old.posts.filter((p: any) => p.id !== variables.postId),
          total: old.total - 1,
        };
      });

      // Also remove from recent
      const recentKey = trpc.generation.recent.queryKey();
      const previousRecent = queryClient.getQueryData(recentKey);
      queryClient.setQueryData(recentKey, (old: any) =>
        old ? old.filter((p: any) => p.id !== variables.postId) : old
      );

      return { previousList, previousRecent };
    },
    onError: (_err, _vars, context) => {
      // Rollback
      if (context?.previousList) {
        queryClient.setQueriesData(
          { queryKey: trpc.generation.list.queryKey() },
          context.previousList
        );
      }
      if (context?.previousRecent) {
        queryClient.setQueryData(
          trpc.generation.recent.queryKey(),
          context.previousRecent
        );
      }
      toast.error("Failed to delete post");
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.generation.list.queryKey(),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.generation.recent.queryKey(),
      });
    },
  });
}
```

---

## Task 3: Type-check

Run from project root:

```bash
bunx tsc --noEmit
```

Pre-existing errors in `(main)` route group can be ignored. Only verify zero new errors from:
- `src/lib/trpc/routers/generation.ts`
- `src/hooks/use-generations.ts`

---

## Task 4: Commit

```bash
git add src/lib/trpc/routers/generation.ts src/hooks/use-generations.ts
git commit -m "feat: add comprehensive generation tRPC router with multi-platform support and custom hooks"
```

---

## Key Implementation Notes

1. **BrandIdentity vs BrandSettings:** The `generate` mutation checks for `brandIdentityId` first (new system). If provided, it loads `BrandIdentity` with palettes. If not, it falls back to the legacy `BrandSettings` table. This provides backward compatibility while enabling per-project brands.

2. **Text-only platforms:** `blog` and `email` platforms use `geminiText.generateContent()` instead of `generateImage()`. The result is stored in `GeneratedPost.textContent` rather than creating `GeneratedImage` records.

3. **Polling pattern:** `useGenerationResults` uses TanStack Query's `refetchInterval` callback. It returns `2000` (ms) when any post has `status === "generating"`, and `false` to stop polling once all posts are complete or failed.

4. **Image URL pattern:** Generated images use `/api/images/{id}?type=generated`, stored images use `?type=stored`. The existing image serving endpoint at `src/app/api/images/[id]/route.ts` handles both types.

5. **Platform enum in Zod:** The `platformSchema` matches the Prisma `Platform` enum exactly: `instagram`, `linkedin`, `reddit`, `x`, `blog`, `email`.

6. **Cascade delete:** `GeneratedImage` has `onDelete: Cascade` in the Prisma schema, so deleting a `GeneratedPost` automatically removes all its images. No manual image cleanup needed.

7. **Logo for BrandIdentity:** The `BrandIdentity` model stores `logoAssetId` which references an `Asset` stored in R2 (not `StoredImage`). Since R2 migration is in progress, the logo reference image injection for BrandIdentity is simplified to a text prompt hint rather than inline image data. The legacy `BrandSettings` path still works with `StoredImage` binary data.
