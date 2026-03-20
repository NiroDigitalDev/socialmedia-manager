# AI SDK v6 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `@google/genai` with Vercel AI SDK v6 (`ai` + `@ai-sdk/google`) in the Lab tree generation pipeline, gaining structured output, tool calling, and eliminating chunking/JSON-parsing hacks.

**Architecture:** New `src/lib/ai/` module with config, prompts, and 4 generation functions. `lab.ts` becomes a pure orchestrator that calls AI functions and manages DB state. `generateBatch` is refactored to use the same shared functions instead of duplicating generation logic inline.

**Tech Stack:** `ai` (AI SDK v6), `@ai-sdk/google` (Google provider), `zod` (schemas), `p-limit` (concurrency)

**Spec:** `docs/superpowers/specs/2026-03-20-ai-sdk-migration-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/ai/config.ts` | Model instances, aspect ratios, model key types |
| Create | `src/lib/ai/prompts.ts` | System prompts for all 4 generation layers |
| Create | `src/lib/ai/generate-ideas.ts` | Ideas generation with structured output |
| Create | `src/lib/ai/generate-outlines.ts` | Outlines generation with structured output |
| Create | `src/lib/ai/generate-images.ts` | Image generation via generateText + responseModalities |
| Create | `src/lib/ai/generate-captions.ts` | Caption generation with tool calling |
| Create | `src/lib/ai/index.ts` | Re-exports |
| Modify | `src/lib/trpc/routers/lab.ts` | Replace all `geminiText`/`generateImage` calls with AI module functions. Remove `cleanJsonResponse`, `parseJsonResponse`, chunking logic, `DEFAULT_PROMPTS`. Refactor `generateBatch` to use shared functions. Add stale generation cleanup. |
| Keep | `src/lib/gemini.ts` | Unchanged — still used by `generation.ts`, `content.ts`, `style.ts`, REST routes |

---

### Task 1: Install AI SDK dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

```bash
bun add ai @ai-sdk/google
```

- [ ] **Step 2: Verify installation**

```bash
bun run tsc --noEmit 2>&1 | head -20
```

Expected: No new type errors from ai or @ai-sdk/google.

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add ai sdk v6 and google provider dependencies"
```

---

### Task 2: Create `src/lib/ai/config.ts`

**Files:**
- Create: `src/lib/ai/config.ts`

- [ ] **Step 1: Create the config file**

```typescript
import { google } from "@ai-sdk/google";

// Text generation — intentional upgrade from gemini-2.5-flash to pro for better structured output
export const textModel = google("gemini-3.1-pro-preview");

// Image generation models
export const imageModels = {
  "nano-banana-2": google("gemini-3.1-flash-image-preview"),
  "nano-banana-pro": google("gemini-3-pro-image-preview"),
} as const;

export type ModelKey = keyof typeof imageModels;

// Instagram aspect ratios
export const ASPECT_RATIOS = ["1:1", "3:4", "4:5", "9:16"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];
```

- [ ] **Step 2: Verify types compile**

```bash
bunx tsc --noEmit src/lib/ai/config.ts 2>&1
```

Expected: No errors. If it complains about isolated modules, that's fine — we'll verify with the full build later.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/config.ts
git commit -m "feat(ai): add AI SDK config with model instances and types"
```

---

### Task 3: Create `src/lib/ai/prompts.ts`

**Files:**
- Create: `src/lib/ai/prompts.ts`

These are the system prompts extracted from `lab.ts` `DEFAULT_PROMPTS` (lines 156-165). They move from being inline constants to a dedicated file. The prompts themselves are improved to work with `Output.object()` — they no longer need to ask for JSON since structured output handles that.

- [ ] **Step 1: Create the prompts file**

```typescript
/**
 * System prompts for each lab generation layer.
 *
 * These are used as the `system` parameter in generateText calls.
 * They do NOT need to ask for JSON format — Output.object() handles that.
 */

export const PROMPTS = {
  ideas: (count: number) =>
    `You are a senior content strategist specializing in Instagram content. Given source material, extract ${count} distinct content ideas for Instagram posts.

Each idea should be:
- A single, focused concept that can stand alone as a post
- Specific enough to guide visual and copy creation
- Diverse — cover different angles, themes, or audiences from the source

Return exactly ${count} ideas as short, descriptive strings (1-3 sentences each).`,

  outlines: (count: number) =>
    `You are a content designer specializing in Instagram carousel and single-image posts. Given a content idea, create ${count} structured post outline${count > 1 ? "s" : ""}.

Each outline should include:
- An overallTheme summarizing the visual and messaging direction
- A slides array with 1-10 slides, each having:
  - title: A short headline for the slide
  - description: What content/message goes on this slide
  - layoutNotes (optional): Visual layout suggestions

Make each outline a distinct creative interpretation of the same idea.`,

  images:
    `You are an expert visual designer creating Instagram post images. Create a visually striking, professional image based on the outline provided. The image should be scroll-stopping, on-brand, and suitable for Instagram.`,

  captions:
    `You are a social media copywriter specializing in Instagram. Write an engaging caption based on the provided context. The caption should:
- Hook the reader in the first line
- Deliver value or tell a story
- End with a call-to-action when appropriate
- Include relevant hashtags (5-15)

Use the available tools to gather context about the image and brand before writing.`,
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/ai/prompts.ts
git commit -m "feat(ai): add system prompts for all generation layers"
```

---

### Task 4: Create `src/lib/ai/generate-ideas.ts`

**Files:**
- Create: `src/lib/ai/generate-ideas.ts`

This replaces the chunking logic in `lab.ts` lines 537-576. Full source text is sent directly (no chunking), and `Output.object()` replaces manual JSON parsing.

- [ ] **Step 1: Create the generation function**

```typescript
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
 *
 * @param sourceText - Full source text (no length limit)
 * @param count - Number of ideas to generate
 * @param systemPrompt - Optional custom system prompt override
 * @returns Array of idea strings
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
```

- [ ] **Step 2: Verify types compile**

```bash
bun run tsc --noEmit 2>&1 | grep -i "generate-ideas" || echo "No errors"
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/generate-ideas.ts
git commit -m "feat(ai): add idea generation with structured output — no chunking"
```

---

### Task 5: Create `src/lib/ai/generate-outlines.ts`

**Files:**
- Create: `src/lib/ai/generate-outlines.ts`

Replaces outline generation in `lab.ts` lines 636-640. Uses `Output.object()` with a typed Zod schema.

- [ ] **Step 1: Create the generation function**

```typescript
import { generateText, Output } from "ai";
import { z } from "zod";
import { textModel } from "./config";
import { PROMPTS } from "./prompts";

const slideSchema = z.object({
  title: z.string(),
  description: z.string(),
  layoutNotes: z.string().optional(),
});

const outlineSchema = z.object({
  overallTheme: z.string(),
  slides: z.array(slideSchema),
});

const outlinesResultSchema = z.object({
  outlines: z.array(outlineSchema).describe("Array of structured post outlines"),
});

export type OutlineResult = z.infer<typeof outlineSchema>;
export type OutlinesResult = z.infer<typeof outlinesResultSchema>;

/**
 * Generate structured post outlines from an idea.
 *
 * @param ideaText - The idea to create outlines for
 * @param count - Number of outlines to generate
 * @param systemPrompt - Optional custom system prompt override
 * @returns Array of outline objects with slides and overallTheme
 */
export async function generateOutlines(
  ideaText: string,
  count: number,
  systemPrompt?: string,
): Promise<OutlineResult[]> {
  const { output } = await generateText({
    model: textModel,
    system: systemPrompt ?? PROMPTS.outlines(count),
    prompt: ideaText,
    output: Output.object({ schema: outlinesResultSchema }),
  });

  return output?.outlines ?? [];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/ai/generate-outlines.ts
git commit -m "feat(ai): add outline generation with structured output"
```

---

### Task 6: Create `src/lib/ai/generate-images.ts`

**Files:**
- Create: `src/lib/ai/generate-images.ts`

Replaces `generateImage()` from `src/lib/gemini.ts` (lines 49-96) for the lab pipeline. Uses `generateText` with `responseModalities: ['IMAGE']` and reads from `result.files`.

- [ ] **Step 1: Create the generation function**

Read the `@ai-sdk/google` provider options type. The docs at `vercel-ai-sdk-google.md` (lines 196-221) show `imageConfig` accepts `aspectRatio` and `imageSize`. The `responseModalities` accepts `['IMAGE']` or `['TEXT', 'IMAGE']`.

```typescript
import { generateText } from "ai";
import { type GoogleLanguageModelOptions } from "@ai-sdk/google";
import { imageModels, type ModelKey, type AspectRatio } from "./config";

export interface ImageResult {
  base64: string;
  mimeType: string;
}

/**
 * Generate an image using Gemini image models via AI SDK.
 *
 * Uses generateText with responseModalities: ['IMAGE'] to get image output.
 * Images are returned in result.files as base64 + Uint8Array.
 *
 * @param prompt - Image generation prompt
 * @param modelKey - Which image model to use
 * @param aspectRatio - Aspect ratio for the generated image
 * @returns Base64-encoded image data and MIME type
 */
export async function generateImageFromPrompt(
  prompt: string,
  modelKey: ModelKey,
  aspectRatio: AspectRatio,
): Promise<ImageResult> {
  const result = await generateText({
    model: imageModels[modelKey],
    prompt,
    providerOptions: {
      google: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio },
      } satisfies GoogleLanguageModelOptions,
    },
  });

  const imageFile = result.files.find((f) =>
    f.mediaType.startsWith("image/"),
  );

  if (!imageFile) {
    throw new Error("No image data in AI response");
  }

  return {
    base64: imageFile.base64,
    mimeType: imageFile.mediaType,
  };
}
```

- [ ] **Step 2: Verify the `GoogleLanguageModelOptions` type exists**

```bash
bun run tsc --noEmit 2>&1 | grep -i "generate-images\|GoogleLanguageModelOptions" || echo "No errors"
```

If `GoogleLanguageModelOptions` doesn't exist in this version, check the actual export:
```bash
grep -r "GoogleLanguageModelOptions\|GoogleGenerativeAILanguageModelOptions" node_modules/@ai-sdk/google/dist/ 2>/dev/null | head -5
```

Adjust the import accordingly if the type name differs.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/generate-images.ts
git commit -m "feat(ai): add image generation via AI SDK generateText + responseModalities"
```

---

### Task 7: Create `src/lib/ai/generate-captions.ts`

**Files:**
- Create: `src/lib/ai/generate-captions.ts`

Replaces caption generation in `lab.ts` lines 836-903. Uses tool calling so the model can dynamically fetch image descriptions and brand context instead of pre-fetching everything.

- [ ] **Step 1: Create the generation function**

The function receives DB/R2 dependencies via a `deps` parameter so it stays testable. Tools use these deps to fetch data on demand.

```typescript
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
 *
 * @param outlineContext - Formatted outline content (slides text)
 * @param imageNodeId - ID of the parent image node
 * @param orgId - Organization ID for brand context lookup
 * @param deps - Database and R2 dependencies
 * @param systemPrompt - Optional custom system prompt override
 * @returns Caption text and hashtags array
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
                      mimeType: contentType,
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
```

- [ ] **Step 2: Verify types compile**

```bash
bun run tsc --noEmit 2>&1 | grep -i "generate-captions" || echo "No errors"
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/generate-captions.ts
git commit -m "feat(ai): add caption generation with tool calling for image analysis and brand context"
```

---

### Task 8: Create `src/lib/ai/index.ts`

**Files:**
- Create: `src/lib/ai/index.ts`

- [ ] **Step 1: Create the barrel export**

```typescript
export { textModel, imageModels, ASPECT_RATIOS } from "./config";
export type { ModelKey, AspectRatio } from "./config";

export { PROMPTS } from "./prompts";

export { generateIdeas } from "./generate-ideas";
export type { IdeasResult } from "./generate-ideas";

export { generateOutlines } from "./generate-outlines";
export type { OutlineResult, OutlinesResult } from "./generate-outlines";

export { generateImageFromPrompt } from "./generate-images";
export type { ImageResult } from "./generate-images";

export { generateCaption } from "./generate-captions";
export type { CaptionResult, CaptionDeps } from "./generate-captions";
```

- [ ] **Step 2: Verify full module compiles**

```bash
bun run tsc --noEmit 2>&1 | grep -i "src/lib/ai" || echo "No errors in ai module"
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/index.ts
git commit -m "feat(ai): add barrel exports for AI module"
```

---

### Task 9: Migrate `lab.ts` — Replace idea generation

**Files:**
- Modify: `src/lib/trpc/routers/lab.ts` (lines 5, 537-596)

Replace the chunking-based idea generation with the new AI module. This is the biggest improvement — eliminating ~40 lines of chunk/dedup logic.

- [ ] **Step 1: Update imports at top of lab.ts**

Add the new AI module import. Keep the `gemini.ts` import for now (other procedures may still use it until the full migration is done in this plan).

Replace line 5:
```typescript
import { geminiText, generateImage, type ModelKey, type AspectRatioKey } from "@/lib/gemini";
```
With:
```typescript
import {
  generateIdeas as aiGenerateIdeas,
  generateOutlines as aiGenerateOutlines,
  generateImageFromPrompt,
  generateCaption as aiGenerateCaption,
  type ModelKey,
  type AspectRatio,
} from "@/lib/ai";
import { generateText } from "ai";
import { textModel } from "@/lib/ai/config";
```

Remove the `gemini.ts` import entirely — after this plan, no lab.ts procedure uses it.

- [ ] **Step 2: Remove old helper functions**

Delete `cleanJsonResponse` (lines 54-60) and `parseJsonResponse` (lines 63-73) — no longer needed with structured output.

Delete `DEFAULT_PROMPTS` (lines 156-165) — moved to `src/lib/ai/prompts.ts`.

- [ ] **Step 3: Replace `generateIdeas` mutation body**

Replace the mutation body (lines 537-596) — everything after the `sourceText` validation check (line 535) through the return (line 598).

The new version:
```typescript
      const sysPrompt = input.systemPrompt ?? undefined;

      // Generate ideas — full source, no chunking
      const allIdeas = await withRetry(() =>
        aiGenerateIdeas(sourceText, input.count, sysPrompt),
      );

      // Create one node per idea returned
      const contentPrompt = `SOURCE TEXT:\n"""\n${sourceText.slice(0, 2000)}${sourceText.length > 2000 ? "... [truncated]" : ""}\n"""`;
      const nodeIds: string[] = [];
      for (const ideaText of allIdeas) {
        const node = await ctx.prisma.labNode.create({
          data: {
            treeId: sourceNode.treeId,
            parentId: input.sourceNodeId,
            orgId: ctx.orgId,
            layer: "idea",
            status: "completed",
            systemPrompt: sysPrompt ?? null,
            ancestorContext: { sourceText: sourceText.slice(0, 5000) },
            output: { text: ideaText },
            contentPrompt,
          },
        });
        nodeIds.push(node.id);
      }

      return { nodeIds };
```

- [ ] **Step 4: Verify the file compiles**

```bash
bun run tsc --noEmit 2>&1 | grep -i "lab.ts" || echo "No errors"
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/trpc/routers/lab.ts
git commit -m "feat(lab): migrate idea generation to AI SDK — no more chunking or JSON parsing"
```

---

### Task 10: Migrate `lab.ts` — Replace outline generation

**Files:**
- Modify: `src/lib/trpc/routers/lab.ts` (lines 636-659)

- [ ] **Step 1: Replace outline generation body**

Replace lines 636-659 (after the `buildAncestorContext` call and before `return { nodeIds }`) with:

```typescript
      const sysPrompt = input.systemPrompt ?? undefined;

      // Generate outlines with structured output
      const outlines = await withRetry(() =>
        aiGenerateOutlines(ideaText, input.count, sysPrompt),
      );

      const contentPrompt = `IDEA:\n"""\n${ideaText}\n"""`;

      // Create one node per outline returned
      const nodeIds: string[] = [];
      for (const outline of outlines) {
        const node = await ctx.prisma.labNode.create({
          data: {
            treeId: ideaNode.treeId,
            parentId: input.ideaNodeId,
            orgId: ctx.orgId,
            layer: "outline",
            status: "completed",
            systemPrompt: sysPrompt ?? null,
            ancestorContext: fullAncestorContext,
            output: {
              slides: outline.slides as Prisma.InputJsonValue[],
              overallTheme: outline.overallTheme,
              text: outline.overallTheme,
            } satisfies Record<string, Prisma.InputJsonValue>,
            contentPrompt,
          },
        });
        nodeIds.push(node.id);
      }

      return { nodeIds };
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/trpc/routers/lab.ts
git commit -m "feat(lab): migrate outline generation to AI SDK structured output"
```

---

### Task 11: Migrate `lab.ts` — Replace image generation

**Files:**
- Modify: `src/lib/trpc/routers/lab.ts` (lines 670-671, 770-774)

- [ ] **Step 1: Update input schema**

Update the `model` and `aspectRatio` fields in the `generateImages` input to use AI module types. Replace:
```typescript
        model: z.enum(["nano-banana-2", "nano-banana-pro"]).default("nano-banana-2"),
        aspectRatio: z.enum(["3:4", "1:1", "4:5", "9:16"]).default("1:1"),
```
With:
```typescript
        model: z.enum(["nano-banana-2", "nano-banana-pro"]).default("nano-banana-2"),
        aspectRatio: z.enum(["1:1", "3:4", "4:5", "9:16"]).default("1:1"),
```

(Aspect ratio order now matches `ASPECT_RATIOS` from config. Values are the same.)

- [ ] **Step 2: Replace the image generation call inside fire-and-forget**

Replace the `generateImage` call (around line 770-774):
```typescript
              const imgResult = await withRetry(() => generateImage(
                imagePrompt,
                input.model as ModelKey,
                input.aspectRatio as AspectRatioKey,
              ));
```
With:
```typescript
              const imgResult = await withRetry(() =>
                generateImageFromPrompt(
                  imagePrompt,
                  input.model as ModelKey,
                  input.aspectRatio as AspectRatio,
                ),
              );
```

The rest of the R2 upload logic stays the same — `imgResult.base64` and `imgResult.mimeType` have the same shape.

- [ ] **Step 3: Commit**

```bash
git add src/lib/trpc/routers/lab.ts
git commit -m "feat(lab): migrate image generation to AI SDK generateText + responseModalities"
```

---

### Task 12: Migrate `lab.ts` — Replace caption generation

**Files:**
- Modify: `src/lib/trpc/routers/lab.ts` (lines 836-927)

This is the biggest change — the manual vision API call and pre-fetched context are replaced by tool calling.

- [ ] **Step 1: Replace caption generation body**

Replace the entire caption generation logic (from after input validation through the fire-and-forget block). The key change: no more pre-fetching image description — the `generateCaption` function uses tools to fetch it dynamically.

```typescript
      // Build ancestor context (for outline slides text)
      const ancestorContext = await buildAncestorContext(ctx.prisma, imageNode);

      // Build outline context string for the caption prompt
      const outlineSlides = (ancestorContext.outlineSlides as unknown[]) ?? [];
      const slidesText = outlineSlides
        .map((s, idx) => {
          const slide = s as { title?: string; description?: string };
          return `Slide ${idx + 1}: ${slide.title ?? ""} — ${slide.description ?? ""}`;
        })
        .join("\n");

      const outlineContext = [
        slidesText && `Outline:\n${slidesText}`,
        `Image node ID: ${input.imageNodeId}`,
        `Organization ID: ${ctx.orgId}`,
      ]
        .filter(Boolean)
        .join("\n\n");

      // Create N caption nodes with status "generating"
      const nodeIds: string[] = [];
      for (let i = 0; i < input.count; i++) {
        const node = await ctx.prisma.labNode.create({
          data: {
            treeId: imageNode.treeId,
            parentId: input.imageNodeId,
            orgId: ctx.orgId,
            layer: "caption",
            status: "generating",
            systemPrompt: input.systemPrompt ?? null,
            ancestorContext,
          },
        });
        nodeIds.push(node.id);
      }

      // Return IDs immediately
      const result = { nodeIds };

      // Fire-and-forget background generation with p-limit(10)
      const limit = pLimit(10);

      // Build deps for caption generation tools
      const captionDeps = {
        prisma: ctx.prisma,
        fetchFromR2,
      };

      void (async () => {
        const jobs = nodeIds.map((nodeId, i) =>
          limit(async () => {
            try {
              // Cancellation check
              const current = await ctx.prisma.labNode.findUnique({
                where: { id: nodeId },
              });
              if (current?.status !== "generating") return;

              const variationContext =
                input.count > 1
                  ? `\n\nVariation ${i + 1} of ${input.count}: Write a distinct caption variation.`
                  : "";

              const captionResult = await withRetry(() =>
                aiGenerateCaption(
                  outlineContext + variationContext,
                  input.imageNodeId,
                  ctx.orgId,
                  captionDeps,
                  input.systemPrompt ?? undefined,
                ),
              );

              const captionText = captionResult.caption +
                (captionResult.hashtags.length > 0
                  ? "\n\n" + captionResult.hashtags.map((h) => `#${h}`).join(" ")
                  : "");

              await ctx.prisma.labNode.update({
                where: { id: nodeId },
                data: {
                  status: "completed",
                  output: { text: captionText.trim() },
                  contentPrompt: outlineContext,
                },
              });
            } catch {
              try {
                await ctx.prisma.labNode.update({
                  where: { id: nodeId },
                  data: { status: "failed" },
                });
              } catch {
                // Ignore
              }
            }
          }),
        );

        await Promise.allSettled(jobs);
      })();

      return result;
```

- [ ] **Step 2: Add the `fetchFromR2` import if not already present**

Check that `fetchFromR2` is imported at the top of `lab.ts`. It should already be there (line 4):
```typescript
import { deleteFromR2, uploadToR2, fetchFromR2, publicUrl } from "@/lib/r2";
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/trpc/routers/lab.ts
git commit -m "feat(lab): migrate caption generation to AI SDK with tool calling"
```

---

### Task 13: Migrate `lab.ts` — Replace `tweakPrompt`

**Files:**
- Modify: `src/lib/trpc/routers/lab.ts` (lines 1247-1252)

Simple migration — just use `generateText` with `textModel` instead of `geminiText.generateContent`.

- [ ] **Step 1: Replace tweakPrompt body**

Replace lines 1247-1252:
```typescript
    .mutation(async ({ input }) => {
      const prompt = `Here is a prompt:\n"""\n${input.currentPrompt}\n"""\n\nThe user wants to: ${input.instruction}\n\nReturn only the updated prompt text. Do not include any explanation or formatting — just the new prompt.`;

      const result = await withRetry(async () => {
        const { text } = await generateText({
          model: textModel,
          prompt,
        });
        return text;
      });

      return { prompt: result.trim() };
    }),
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/trpc/routers/lab.ts
git commit -m "feat(lab): migrate tweakPrompt to AI SDK"
```

---

### Task 14: Migrate `lab.ts` — Refactor `generateBatch`

**Files:**
- Modify: `src/lib/trpc/routers/lab.ts` (lines 978-1236)

This is the biggest refactor — `generateBatch` currently duplicates all 4 generation logics inline (~260 lines). Replace with calls to the shared AI functions.

- [ ] **Step 1: Replace the batch generation switch-case**

The batch generation creates child nodes, then fire-and-forgets per parent. Replace the inline switch-case (lines 1062-1232) with calls to AI module functions.

Replace the entire `void (async () => { ... })()` block per node with:

```typescript
        void (async () => {
          try {
            switch (layer) {
              case "source": {
                // Generate ideas
                const sourceText = (nodeOutput?.text as string) ?? "";
                const sysPrompt = input.systemPrompt ?? undefined;
                const ideas = await withRetry(() =>
                  aiGenerateIdeas(sourceText, input.count, sysPrompt),
                );
                const contentPrompt = `SOURCE TEXT:\n"""\n${sourceText.slice(0, 2000)}...\n"""`;

                for (let i = 0; i < childIds.length; i++) {
                  try {
                    const current = await ctx.prisma.labNode.findUnique({ where: { id: childIds[i] } });
                    if (current?.status !== "generating") continue;
                    if (i < ideas.length) {
                      await ctx.prisma.labNode.update({
                        where: { id: childIds[i] },
                        data: { status: "completed", output: { text: ideas[i] }, contentPrompt },
                      });
                    } else {
                      await ctx.prisma.labNode.delete({ where: { id: childIds[i] } });
                    }
                  } catch {
                    await ctx.prisma.labNode.update({ where: { id: childIds[i] }, data: { status: "failed" } }).catch(() => {});
                  }
                }
                break;
              }
              case "idea": {
                // Generate outlines
                const ideaText = (nodeOutput?.text as string) ?? "";
                const sysPrompt = input.systemPrompt ?? undefined;
                const outlines = await withRetry(() =>
                  aiGenerateOutlines(ideaText, input.count, sysPrompt),
                );
                const contentPrompt = `IDEA:\n"""\n${ideaText}\n"""`;

                for (let i = 0; i < childIds.length; i++) {
                  try {
                    const current = await ctx.prisma.labNode.findUnique({ where: { id: childIds[i] } });
                    if (current?.status !== "generating") continue;
                    if (i < outlines.length) {
                      const outline = outlines[i];
                      await ctx.prisma.labNode.update({
                        where: { id: childIds[i] },
                        data: {
                          status: "completed",
                          output: { slides: outline.slides as Prisma.InputJsonValue[], overallTheme: outline.overallTheme, text: outline.overallTheme } satisfies Record<string, Prisma.InputJsonValue>,
                          contentPrompt,
                        },
                      });
                    } else {
                      await ctx.prisma.labNode.delete({ where: { id: childIds[i] } });
                    }
                  } catch {
                    await ctx.prisma.labNode.update({ where: { id: childIds[i] }, data: { status: "failed" } }).catch(() => {});
                  }
                }
                break;
              }
              case "outline": {
                // Generate images
                const outlineSlides = (nodeOutput?.slides as unknown[]) ?? [];
                const overallTheme = (nodeOutput?.overallTheme as string) ?? "";
                const sysPrompt = input.systemPrompt ?? PROMPTS.images;

                const slidesText = outlineSlides
                  .map((s, idx) => {
                    const slide = s as { title?: string; description?: string; layoutNotes?: string };
                    return `Slide ${idx + 1}: ${slide.title ?? ""} — ${slide.description ?? ""}${slide.layoutNotes ? ` (Layout: ${slide.layoutNotes})` : ""}`;
                  })
                  .join("\n");

                const jobs = childIds.map((childId, i) =>
                  limit(async () => {
                    try {
                      const current = await ctx.prisma.labNode.findUnique({ where: { id: childId } });
                      if (current?.status !== "generating") return;

                      const promptParts = [
                        sysPrompt,
                        overallTheme && `Theme: ${overallTheme}`,
                        slidesText && `Outline slides:\n${slidesText}`,
                        input.count > 1 && `Variation ${i + 1} of ${input.count}: Make this visually distinct.`,
                      ].filter(Boolean);
                      const imagePrompt = promptParts.join("\n\n");

                      const imgResult = await withRetry(() =>
                        generateImageFromPrompt(imagePrompt, input.model as ModelKey, input.aspectRatio as AspectRatio),
                      );
                      const ext = imgResult.mimeType.split("/")[1] || "png";
                      const r2Key = `lab/${childId}/original.${ext}`;
                      const imageBuffer = Buffer.from(imgResult.base64, "base64");
                      await uploadToR2(r2Key, imageBuffer, imgResult.mimeType);

                      await ctx.prisma.labNode.update({
                        where: { id: childId },
                        data: { status: "completed", output: { url: publicUrl(r2Key) }, r2Key, mimeType: imgResult.mimeType, contentPrompt: imagePrompt },
                      });
                    } catch {
                      await ctx.prisma.labNode.update({ where: { id: childId }, data: { status: "failed" } }).catch(() => {});
                    }
                  }),
                );
                await Promise.allSettled(jobs);
                break;
              }
              case "image": {
                // Generate captions
                const ancestorCtx = await buildAncestorContext(ctx.prisma, node);
                const outlineSlidesCap = (ancestorCtx.outlineSlides as unknown[]) ?? [];
                const slidesTextCap = outlineSlidesCap
                  .map((s, idx) => {
                    const slide = s as { title?: string; description?: string };
                    return `Slide ${idx + 1}: ${slide.title ?? ""} — ${slide.description ?? ""}`;
                  })
                  .join("\n");

                const outlineContext = [
                  slidesTextCap && `Outline:\n${slidesTextCap}`,
                  `Image node ID: ${node.id}`,
                  `Organization ID: ${ctx.orgId}`,
                ].filter(Boolean).join("\n\n");

                const captionDeps = { prisma: ctx.prisma, fetchFromR2 };

                const captionJobs = childIds.map((childId, i) =>
                  limit(async () => {
                    try {
                      const current = await ctx.prisma.labNode.findUnique({ where: { id: childId } });
                      if (current?.status !== "generating") return;

                      const variationCtx = input.count > 1
                        ? `\n\nVariation ${i + 1} of ${input.count}: Write a distinct caption variation.`
                        : "";

                      const captionResult = await withRetry(() =>
                        aiGenerateCaption(outlineContext + variationCtx, node.id, ctx.orgId, captionDeps, input.systemPrompt ?? undefined),
                      );

                      const captionText = captionResult.caption +
                        (captionResult.hashtags.length > 0
                          ? "\n\n" + captionResult.hashtags.map((h) => `#${h}`).join(" ")
                          : "");

                      await ctx.prisma.labNode.update({
                        where: { id: childId },
                        data: { status: "completed", output: { text: captionText.trim() }, contentPrompt: outlineContext },
                      });
                    } catch {
                      await ctx.prisma.labNode.update({ where: { id: childId }, data: { status: "failed" } }).catch(() => {});
                    }
                  }),
                );
                await Promise.allSettled(captionJobs);
                break;
              }
            }
          } catch {
            for (const childId of childIds) {
              await ctx.prisma.labNode.update({ where: { id: childId }, data: { status: "failed" } }).catch(() => {});
            }
          }
        })();
```

Also add the `PROMPTS` import at the top:
```typescript
import { PROMPTS } from "@/lib/ai/prompts";
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/trpc/routers/lab.ts
git commit -m "feat(lab): refactor generateBatch to use shared AI module functions"
```

---

### Task 15: Add stale generation cleanup to `treeProgress`

**Files:**
- Modify: `src/lib/trpc/routers/lab.ts` (lines 471-503)

Add a cleanup check: any node stuck in `"generating"` for >5 minutes gets marked `"failed"`.

- [ ] **Step 1: Add cleanup before returning progress**

After the tree ownership check, before the query, add:

```typescript
      // Stale generation cleanup: mark nodes stuck generating >5min as failed
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      await ctx.prisma.labNode.updateMany({
        where: {
          treeId: input.treeId,
          status: "generating",
          updatedAt: { lt: fiveMinutesAgo },
        },
        data: { status: "failed" },
      });
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/trpc/routers/lab.ts
git commit -m "feat(lab): add stale generation cleanup — mark stuck nodes as failed after 5min"
```

---

### Task 16: Clean up and verify

**Files:**
- Modify: `src/lib/trpc/routers/lab.ts`

- [ ] **Step 1: Remove the old gemini.ts import**

Verify that no remaining code in `lab.ts` references `geminiText`, `generateImage` (from gemini), `ModelKey` (from gemini), or `AspectRatioKey`. These should all be replaced by AI module imports now.

```bash
grep -n "from.*gemini" src/lib/trpc/routers/lab.ts
```

Expected: No results. If any remain, update them.

- [ ] **Step 2: Remove `cleanJsonResponse` and `parseJsonResponse` if still present**

```bash
grep -n "cleanJsonResponse\|parseJsonResponse\|DEFAULT_PROMPTS" src/lib/trpc/routers/lab.ts
```

Expected: No results. Delete any remaining references.

- [ ] **Step 3: Full type check**

```bash
bun run tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Start dev server and verify it loads**

```bash
bun run dev
```

Expected: Server starts without errors. Navigate to a lab tree page and verify the UI loads.

- [ ] **Step 5: Commit any cleanup**

```bash
git add src/lib/trpc/routers/lab.ts
git commit -m "chore(lab): remove old gemini imports and dead helper functions"
```

---

### Task 17: End-to-end smoke test

**Files:** None (testing only)

- [ ] **Step 1: Test idea generation**

Open a lab tree with an existing source node. Right-click → Generate Ideas (count: 3). Verify ideas appear as child nodes.

- [ ] **Step 2: Test outline generation**

Right-click an idea node → Generate Outlines (count: 2). Verify outlines appear with slides data.

- [ ] **Step 3: Test image generation**

Right-click an outline node → Generate Images (count: 1). Verify image node appears with a thumbnail.

- [ ] **Step 4: Test caption generation**

Right-click an image node → Generate Captions (count: 2). Verify captions appear with hashtags.

- [ ] **Step 5: Test batch generation**

Select multiple nodes of the same layer, trigger batch generation. Verify children are created.

- [ ] **Step 6: Test prompt tweaking**

Open detail panel, edit a system prompt, click "Save & Regenerate". Verify it works.

- [ ] **Step 7: Test stale cleanup**

Open a tree. Verify `treeProgress` polling doesn't error. Any stuck "generating" nodes from prior runs should auto-fail after 5 minutes.
