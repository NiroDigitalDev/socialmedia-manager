# AI SDK v6 Migration — Design Spec

**Date**: 2026-03-20
**Scope**: Lab + shared foundation (option c). Other routers migrate later.

## Problem

Current AI generation uses `@google/genai` directly with:
- Manual JSON parsing (`cleanJsonResponse` / `parseJsonResponse`) — fragile
- Chunking approach for long sources — rejected, loses detail
- No structured output — hopes for valid JSON
- No tool calling — caption generation does a separate vision API call manually
- Prompts are inline template strings in tRPC procedures

## Solution

Migrate to **Vercel AI SDK v6** (`ai` + `@ai-sdk/google`):
- `generateText` + `Output.object()` for type-safe structured output
- Full source text sent directly (Gemini 3.1 Pro has 1M token context)
- Tool calling for caption and image generation context gathering
- Modular AI module with separated concerns
- Image generation via `generateText` + `responseModalities: ['IMAGE']` + `result.files`

## Models

**Intentional upgrade**: The current codebase uses `gemini-2.5-flash` for text generation. This migration intentionally upgrades to `gemini-3.1-pro-preview` for higher quality structured output. This is a deliberate cost/quality tradeoff — Pro produces better ideas, outlines, and captions.

| Purpose | Model | Package | Notes |
|---------|-------|---------|-------|
| Text generation (ideas, outlines, captions) | `gemini-3.1-pro-preview` | `@ai-sdk/google` | Upgrade from `gemini-2.5-flash` |
| Image generation (flash) | `gemini-3.1-flash-image-preview` | `@ai-sdk/google` | Renamed from `nano-banana-2` |
| Image generation (pro) | `gemini-3-pro-image-preview` | `@ai-sdk/google` | Renamed from `nano-banana-pro` |

**Out of scope**: `geminiPro` (used by `style.ts`) and `geminiText` (used by `generation.ts`, `content.ts`, REST routes) remain on `@google/genai` until those routers are migrated.

## Aspect Ratios (Instagram)

`1:1`, `3:4`, `4:5`, `9:16`

## Module Structure

```
src/lib/ai/
├── config.ts              # Model instances, provider setup, aspect ratios
├── prompts.ts             # System prompts per generation layer (ideas, outlines, images, captions)
├── generate-ideas.ts      # generateText + Output.object → string[]
├── generate-outlines.ts   # generateText + Output.object → OutlineSchema[]
├── generate-images.ts     # generateText + responseModalities:IMAGE → result.files
├── generate-captions.ts   # generateText + tools (describeImage, getBrandContext) + Output.object
└── index.ts               # Re-exports
```

## Detailed Design

### `config.ts`

Model instances and shared configuration.

```typescript
import { google } from '@ai-sdk/google';

export const textModel = google('gemini-3.1-pro-preview');

export const imageModels = {
  'nano-banana-2': google('gemini-3.1-flash-image-preview'),
  'nano-banana-pro': google('gemini-3-pro-image-preview'),
} as const;

export type ModelKey = keyof typeof imageModels;

export const ASPECT_RATIOS = ['1:1', '3:4', '4:5', '9:16'] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];
```

### `prompts.ts`

System prompts for each generation layer. Separated from logic for easy tuning.

- `ideas(count)` — Content strategist extracting N distinct ideas from source material
- `outlines(count)` — Content designer creating N structured post outlines from an idea
- `images` — Visual designer creating Instagram post images from outline context
- `captions` — Social media copywriter crafting captions with hashtags

Each prompt is a function returning a string, parameterized by count or context as needed.

### `generate-ideas.ts`

**Input**: source text (full, no chunking), count
**Output**: `string[]` (typed via `Output.object`)

```typescript
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { textModel } from './config';
import { PROMPTS } from './prompts';

export async function generateIdeas(sourceText: string, count: number) {
  const { output } = await generateText({
    model: textModel,
    system: PROMPTS.ideas(count),
    prompt: sourceText,
    output: Output.object({
      schema: z.object({ ideas: z.array(z.string()) }),
    }),
  });
  return output?.ideas ?? [];
}
```

No chunking. Gemini 3.1 Pro handles 1M tokens natively. The full source text is sent as the user message, task instructions as system prompt.

### `generate-outlines.ts`

**Input**: idea text, count, ancestor context (source summary)
**Output**: `OutlineResult[]` (typed via `Output.object`)

```typescript
const outlineSchema = z.object({
  outlines: z.array(z.object({
    overallTheme: z.string(),
    slides: z.array(z.object({
      title: z.string(),
      description: z.string(),
      layoutNotes: z.string().optional(),
    })),
  })),
});
```

Uses `generateText` + `Output.object()` with the idea text as user message and outline system prompt.

### `generate-images.ts`

**Input**: prompt string, model key, aspect ratio, optional reference images
**Output**: `{ base64: string; mimeType: string }`

Uses `generateText` with image model and `providerOptions`:

```typescript
import { generateText } from 'ai';
import { imageModels, type ModelKey, type AspectRatio } from './config';
import type { GoogleLanguageModelOptions } from '@ai-sdk/google';

export async function generateImageFromPrompt(
  prompt: string,
  modelKey: ModelKey,
  aspectRatio: AspectRatio,
) {
  const result = await generateText({
    model: imageModels[modelKey],
    prompt,
    providerOptions: {
      google: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio },
      } satisfies GoogleLanguageModelOptions,
    },
  });

  const imageFile = result.files.find(f => f.mediaType.startsWith('image/'));
  if (!imageFile) throw new Error('No image in response');
  return { base64: imageFile.base64, mimeType: imageFile.mediaType };
}
```

For reference images (brand logos, style references), these are passed as message content parts.

**Tool calling for image generation**: A `fetchStyleReference` tool can let the model pull reference images from the style library when generating, and a `getBrandContext` tool fetches brand colors/logo.

### `generate-captions.ts`

**Input**: outline context, image node ID, org ID
**Output**: `{ caption: string; hashtags: string[] }`

Uses tool calling so the model can dynamically gather context:

```typescript
import { generateText, Output, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { textModel } from './config';
import { PROMPTS } from './prompts';

export async function generateCaption(
  outlineContext: string,
  imageNodeId: string,
  orgId: string,
  deps: { prisma: PrismaClient },
) {
  const { output } = await generateText({
    model: textModel,
    system: PROMPTS.captions,
    prompt: outlineContext,
    tools: {
      describeImage: tool({
        description: 'Analyze the parent image to write an accurate caption',
        inputSchema: z.object({ nodeId: z.string() }),
        execute: async ({ nodeId }) => {
          // 1. Fetch image from R2 via r2Key on the LabNode
          // 2. Call generateText with textModel (gemini-3.1-pro-preview supports vision)
          //    passing the image as a message content part:
          //    messages: [{ role: 'user', content: [
          //      { type: 'image', image: imageBuffer },
          //      { type: 'text', text: 'Describe this image in detail...' }
          //    ]}]
          // 3. Return the description string
          // Falls back to empty string if R2 fetch or vision fails
        },
      }),
      getBrandContext: tool({
        description: 'Get brand identity for tone and voice alignment',
        inputSchema: z.object({ orgId: z.string() }),
        execute: async ({ orgId }) => {
          // Fetch brand identity from DB
          // Return name, tagline, colors, voice guidelines
        },
      }),
    },
    output: Output.object({
      schema: z.object({
        caption: z.string(),
        hashtags: z.array(z.string()),
      }),
    }),
    stopWhen: stepCountIs(4),
  });

  return output ?? { caption: '', hashtags: [] };
}
```

The model decides when it needs image context or brand context, rather than us pre-fetching everything.

### Orchestration — `lab.ts` Changes

The tRPC procedures in `lab.ts` remain the orchestrators:
1. Validate input, check org membership
2. Create nodes with `status: "generating"`
3. Return node IDs immediately
4. Fire-and-forget background generation using `p-limit`
5. Call functions from `src/lib/ai/` instead of `geminiText.generateContent()`

**All procedures that call AI are in scope:**
- `generateIdeas` — uses `generateIdeas()` from AI module
- `generateOutlines` — uses `generateOutlines()` from AI module
- `generateImages` — uses `generateImageFromPrompt()` from AI module
- `generateCaptions` — uses `generateCaption()` from AI module
- `generateBatch` (~260 lines) — currently duplicates all generation logic inline. Must be refactored to call the same shared AI functions above instead of inline `geminiText.generateContent()` calls. This is the biggest win — eliminates code duplication.
- `tweakPrompt` — simple text-in/text-out call. Migrates to a plain `generateText` call with `textModel` (no `Output.object` needed since it returns freeform text).

**Node creation timing**: Ideas and outlines create nodes *after* generation returns (synchronous — count depends on AI output). Images and captions create nodes *before* generation starts (fire-and-forget — count is known upfront). The caller in lab.ts handles the count mismatch for ideas/outlines by creating one node per returned item.

**No changes to**: status tracking, polling, cancellation, R2 upload, fire-and-forget pattern.

**Stale generation cleanup**: Add a check — nodes stuck in `"generating"` for >5 minutes get marked `"failed"`. Can be checked in `treeProgress` or as a periodic sweep.

**`withRetry()` stays in `lab.ts`** as the orchestration-level retry wrapper. The AI module functions do not retry internally — lab.ts wraps calls with `withRetry()` as it does today.

### What Gets Deleted

From `lab.ts`:
- `cleanJsonResponse()` — replaced by `Output.object()`
- `parseJsonResponse()` — replaced by `Output.object()`
- Chunking logic in `generateIdeas` (CHUNK_SIZE, overlap, dedup pass)
- Inline system prompts (moved to `prompts.ts`)
- Direct `geminiText.generateContent()` calls
- Separate vision API call for caption image description (now a tool)

From `gemini.ts`:
- Nothing removed yet (other routers still use it)
- Lab.ts stops importing from it

### Dependencies

**Add**:
- `ai` (AI SDK v6 core)
- `@ai-sdk/google` (Google provider)

**Keep** (temporarily, for other routers):
- `@google/genai`

**Keep** (unchanged):
- `p-limit` (concurrency control)
- `zod` (schemas — also used by Output.object)

### Error Handling

- `withRetry()` helper stays — wraps `generateText` calls with exponential backoff
- AI SDK throws typed errors on failures
- Each generation job catches errors and marks nodes as `"failed"`
- `Promise.allSettled()` ensures one failure doesn't block siblings

### Migration Order

1. Install `ai` + `@ai-sdk/google`
2. Create `src/lib/ai/` module (config, prompts, 4 generation functions)
3. Update `lab.ts` to import from `src/lib/ai/` instead of `gemini.ts`
4. Test all 5 generation layers end-to-end
5. (Future) Migrate `generation.ts`, `content.ts`, `style.ts`, REST routes
6. (Future) Remove `@google/genai` dependency once all consumers migrated
