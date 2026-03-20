import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, orgProtectedProcedure } from "../init";
import { generateImage, geminiText, geminiPro } from "@/lib/gemini";
import { prisma as globalPrisma } from "@/lib/prisma";
import { uploadToR2, publicUrl, deleteFromR2 } from "@/lib/r2";
import { createWebPPreview } from "@/lib/image-processing";
import { randomUUID } from "crypto";

// In-memory progress tracker for background preview generation
const previewProgress = {
  isRunning: false,
  completed: 0,
  total: 0,
  currentStyle: "",
};

/** Upload a base64-encoded image to R2 with a WebP preview, return the base key (without extension) */
async function uploadStylePreviewToR2(
  base64: string,
  mimeType: string
): Promise<string> {
  const id = randomUUID();
  const buf = Buffer.from(base64, "base64");
  const ext = mimeType === "image/jpeg" ? "jpg" : "png";
  const baseKey = `style-previews/${id}`;

  // Generate optimized WebP preview (480px max, 75% quality)
  const webpBuf = await createWebPPreview(buf);

  // Upload original + WebP preview in parallel
  await Promise.all([
    uploadToR2(`${baseKey}.${ext}`, buf, mimeType),
    uploadToR2(`${baseKey}.webp`, webpBuf, "image/webp"),
  ]);

  return baseKey;
}

/** Resolve a sampleImageId to a URL — R2 base keys get WebP preview URLs, legacy IDs get /api/images */
function sampleIdToUrl(id: string): string {
  if (id.startsWith("style-previews/")) {
    // Base key without extension — serve the optimized WebP preview
    return publicUrl(`${id}.webp`);
  }
  // Legacy StoredImage ID
  return `/api/images/${id}?type=stored`;
}

/** Resolve to the full-size original image (for detail views / downloads) */
function sampleIdToOriginalUrl(id: string, ext = "png"): string {
  if (id.startsWith("style-previews/")) {
    return publicUrl(`${id}.${ext}`);
  }
  return `/api/images/${id}?type=stored`;
}

// ── Shared background generation helpers ──

type StyleForGeneration = {
  id: string;
  name: string;
  promptText: string;
  sampleImageIds: string[];
};

const GENERATION_BATCH_SIZE = 5; // 5 styles × 4 images = 20 concurrent image generations

function toIgPrompt(promptText: string): string {
  return `Create a visually stunning Instagram social media post image. The visual style is: ${promptText}. The image should look like a professional, polished Instagram post with engaging lifestyle content, proper composition for social media, and beautiful visual storytelling.`;
}

/** Generate IG-style preview images for a single style and persist to R2 + DB */
async function generateStyleImages(style: StyleForGeneration, force: boolean) {
  const count = force ? 4 : Math.max(0, 4 - style.sampleImageIds.length);
  if (count === 0) return;

  const results = await Promise.all(
    Array.from({ length: count }, () =>
      generateImage(toIgPrompt(style.promptText), "nano-banana-2", "1:1")
    )
  );

  const r2Keys = await Promise.all(
    results.map((img) => uploadStylePreviewToR2(img.base64, img.mimeType))
  );

  const newIds = force ? r2Keys : [...style.sampleImageIds, ...r2Keys];

  await globalPrisma.style.update({
    where: { id: style.id },
    data: { sampleImageIds: newIds },
  });

  // Clean up old R2 images when force-regenerating
  if (force && style.sampleImageIds.length > 0) {
    const oldR2Keys = style.sampleImageIds.filter((k) => k.startsWith("style-previews/"));
    await Promise.allSettled(
      oldR2Keys.flatMap((k) => [
        deleteFromR2(`${k}.webp`),
        deleteFromR2(`${k}.png`),
        deleteFromR2(`${k}.jpg`),
      ])
    );
  }
}

/** Start background generation for a list of styles with progress tracking.
 *  Returns false if generation is already running. */
function startBackgroundGeneration(
  styles: StyleForGeneration[],
  force: boolean
): boolean {
  if (previewProgress.isRunning) return false;

  previewProgress.isRunning = true;
  previewProgress.completed = 0;
  previewProgress.total = styles.length;
  previewProgress.currentStyle = styles[0]?.name ?? "";

  (async () => {
    for (let i = 0; i < styles.length; i += GENERATION_BATCH_SIZE) {
      const batch = styles.slice(i, i + GENERATION_BATCH_SIZE);
      previewProgress.currentStyle = batch.map((s) => s.name).join(", ");
      await Promise.all(
        batch.map(async (style) => {
          try {
            await generateStyleImages(style, force);
          } catch (err) {
            console.error(`Failed to generate previews for style "${style.name}":`, err);
          }
          previewProgress.completed++;
        })
      );
    }
    previewProgress.isRunning = false;
    previewProgress.currentStyle = "";
  })();

  return true;
}

const ALL_PLATFORMS = ["instagram", "linkedin", "x", "reddit", "blog", "email"] as const;
export type Platform = (typeof ALL_PLATFORMS)[number];

const PREDEFINED_STYLES: Array<{
  name: string;
  description: string;
  promptText: string;
  platforms: string[];
  kind?: string;
}> = [
  {
    name: "Corporate Clean",
    description: "Professional and modern corporate aesthetic",
    promptText:
      "Professional, clean corporate design with blue and white colors, modern typography, structured layout",
    platforms: ["instagram"],
  },
  {
    name: "Bold & Vibrant",
    description: "High-energy designs that grab attention",
    promptText:
      "Bold, vibrant colors, high contrast, energetic design, dynamic composition, eye-catching",
    platforms: ["instagram"],
  },
  {
    name: "Minimalist",
    description: "Less is more - clean and elegant designs",
    promptText:
      "Minimalist design, lots of white space, simple typography, subtle colors, clean and elegant",
    platforms: ["instagram"],
  },
  {
    name: "Retro/Vintage",
    description: "Nostalgic throwback aesthetics",
    promptText:
      "Retro vintage aesthetic, warm tones, film grain texture, classic typography, nostalgic feel",
    platforms: ["instagram"],
  },
  {
    name: "Neon/Cyberpunk",
    description: "Futuristic neon-lit digital aesthetics",
    promptText:
      "Neon cyberpunk aesthetic, dark background, glowing neon colors, futuristic, high-tech",
    platforms: ["instagram"],
  },
  {
    name: "Pastel Soft",
    description: "Gentle and inviting pastel designs",
    promptText:
      "Soft pastel colors, gentle gradients, rounded shapes, warm and inviting, feminine aesthetic",
    platforms: ["instagram"],
  },
  {
    name: "Dark Luxury",
    description: "Premium dark-themed sophistication",
    promptText:
      "Dark luxury aesthetic, black and gold, premium feel, elegant typography, sophisticated",
    platforms: ["instagram"],
  },
  {
    name: "Earthy Natural",
    description: "Organic and nature-inspired designs",
    promptText:
      "Earthy natural tones, organic textures, green and brown palette, botanical elements",
    platforms: ["instagram"],
  },
  {
    name: "Gradient Modern",
    description: "Contemporary gradient-driven designs",
    promptText:
      "Modern gradient backgrounds, smooth color transitions, contemporary design, vibrant",
    platforms: ["instagram"],
  },
  {
    name: "Hand-Drawn Sketch",
    description: "Artistic hand-drawn illustration style",
    promptText:
      "Hand-drawn sketch style, pencil textures, illustration aesthetic, artistic, creative",
    platforms: ["instagram"],
  },
  {
    name: "3D Render",
    description: "Glossy 3D rendered objects and scenes",
    promptText:
      "3D rendered design, glossy materials, soft lighting, volumetric shadows, clean 3D objects, modern 3D illustration style",
    platforms: ["instagram"],
  },
  {
    name: "Watercolor",
    description: "Soft watercolor painting aesthetic",
    promptText:
      "Watercolor painting style, soft washes of color, organic paint bleeds, textured paper background, artistic and fluid composition",
    platforms: ["instagram"],
  },
  {
    name: "Pop Art",
    description: "Bold pop art inspired designs",
    promptText:
      "Pop art style, bold outlines, Ben-Day dots, high contrast, comic book aesthetic, bright saturated colors, Roy Lichtenstein inspired",
    platforms: ["instagram"],
  },
  {
    name: "Glassmorphism",
    description: "Frosted glass UI design aesthetic",
    promptText:
      "Glassmorphism design, frosted glass panels, translucent layers, soft blur backgrounds, subtle borders, modern UI aesthetic",
    platforms: ["instagram"],
  },
  {
    name: "Paper Cut",
    description: "Layered paper cutout art style",
    promptText:
      "Paper cut art style, layered paper shapes, soft shadows between layers, craft aesthetic, dimensional paper illustration",
    platforms: ["instagram"],
  },
  {
    name: "Isometric",
    description: "Isometric 3D illustration style",
    promptText:
      "Isometric illustration, 30-degree angle view, flat shading, geometric precision, clean isometric objects, technical but playful",
    platforms: ["instagram"],
  },
  {
    name: "Collage Scrapbook",
    description: "Mixed media collage and scrapbook aesthetic",
    promptText:
      "Collage scrapbook style, mixed media textures, torn paper edges, layered photographs, stickers and tape elements, creative and eclectic",
    platforms: ["instagram"],
  },
  {
    name: "Typography Heavy",
    description: "Typography-driven bold text layouts",
    promptText:
      "Typography-focused design, bold text as the hero element, expressive lettering, creative text arrangements, minimal imagery, type-driven layout",
    platforms: ["instagram"],
  },
  {
    name: "Brutalist",
    description: "Raw, unpolished brutalist web design aesthetic",
    promptText:
      "Brutalist design, raw unpolished aesthetic, monospaced typography, harsh borders, stark contrast, intentionally rough layout, anti-design movement inspired",
    platforms: ["instagram"],
  },
  {
    name: "Vaporwave",
    description: "Retro-futuristic 80s/90s digital nostalgia",
    promptText:
      "Vaporwave aesthetic, pink and teal gradients, Greek statues, palm trees, retro computer graphics, 80s/90s nostalgia, glitch effects, sunset grid horizon",
    platforms: ["instagram"],
  },
  {
    name: "Duotone",
    description: "Two-tone color overlay photography",
    promptText:
      "Duotone design, two-color overlay effect on photography, high contrast split-tone, bold color mapping, dramatic monochromatic imagery with accent color wash",
    platforms: ["instagram"],
  },
  {
    name: "Flat Illustration",
    description: "Clean vector-style flat illustrations",
    promptText:
      "Flat illustration style, clean vector shapes, no gradients or shadows, geometric characters, simple clean lines, modern flat design with solid color fills",
    platforms: ["instagram"],
  },
  {
    name: "Grunge Texture",
    description: "Distressed and gritty textured designs",
    promptText:
      "Grunge texture aesthetic, distressed overlay, scratched and worn surfaces, dark gritty atmosphere, rough edges, ink splatter, urban street art feel",
    platforms: ["instagram"],
  },
  {
    name: "Art Deco",
    description: "1920s geometric luxury patterns",
    promptText:
      "Art Deco design, 1920s geometric patterns, gold and black color scheme, ornate symmetrical borders, fan shapes, stepped forms, Gatsby-era luxury aesthetic",
    platforms: ["instagram"],
  },
  {
    name: "Claymation",
    description: "Playful clay-like 3D character style",
    promptText:
      "Claymation style, soft clay-like 3D objects, rounded forms, playful characters, handmade crafted feel, stop-motion aesthetic, warm soft lighting on clay surfaces",
    platforms: ["instagram"],
  },
  {
    name: "Pixel Art",
    description: "Retro pixel art and 8-bit game aesthetic",
    promptText:
      "Pixel art style, 8-bit retro game aesthetic, visible pixel grid, limited color palette, chunky sprites, nostalgic video game art, crisp pixel edges",
    platforms: ["instagram"],
  },
  {
    name: "Magazine Editorial",
    description: "High-fashion editorial magazine layout",
    promptText:
      "Magazine editorial layout, high-fashion photography aesthetic, sophisticated grid composition, elegant serif headlines, negative space, luxury publication design",
    platforms: ["instagram"],
  },
  {
    name: "Psychedelic",
    description: "Trippy 60s/70s psychedelic art style",
    promptText:
      "Psychedelic art style, swirling organic patterns, vivid rainbow colors, melting shapes, 1960s concert poster aesthetic, op-art optical illusions, fluid warped typography",
    platforms: ["instagram"],
  },
  {
    name: "Risograph",
    description: "Textured risograph print aesthetic",
    promptText:
      "Risograph print aesthetic, halftone dot patterns, misregistration color offset, limited ink palette, grainy textured paper, layered semi-transparent shapes, indie zine print feel",
    platforms: ["instagram"],
  },
  {
    name: "Bauhaus",
    description: "Geometric Bauhaus design movement",
    promptText:
      "Bauhaus design style, primary colors red yellow blue on white, geometric circles triangles rectangles, asymmetric grid composition, sans-serif typography, modernist functional aesthetic",
    platforms: ["instagram"],
  },
  {
    name: "Stained Glass",
    description: "Colorful stained glass window art",
    promptText:
      "Stained glass window art style, bold black lead outlines separating jewel-toned glass segments, translucent light effects, rich saturated colors, cathedral window mosaic composition",
    platforms: ["instagram"],
  },
  {
    name: "Noir Film",
    description: "Cinematic film noir atmosphere",
    promptText:
      "Film noir style, high contrast black and white, dramatic shadows and light beams, venetian blind shadow patterns, smoky atmosphere, vintage cinema grain, detective story mood",
    platforms: ["instagram"],
  },
  {
    name: "Origami",
    description: "Folded paper origami sculpture style",
    promptText:
      "Origami paper folding art style, geometric creased paper shapes, clean angular folds, soft shadows on white paper, Japanese paper craft aesthetic, precise mathematical forms",
    platforms: ["instagram"],
  },
  {
    name: "Memphis Design",
    description: "80s Memphis Group bold patterns",
    promptText:
      "Memphis design movement, bold geometric shapes, squiggly lines, terrazzo patterns, bright clashing colors, asymmetric composition, 1980s Italian postmodern aesthetic, playful and irreverent",
    platforms: ["instagram"],
  },
  {
    name: "Blueprint",
    description: "Technical blueprint and schematic style",
    promptText:
      "Technical blueprint style, white lines on deep blue background, engineering schematic aesthetic, grid paper, precise measurements and annotations, architectural drawing feel",
    platforms: ["instagram"],
  },
  {
    name: "Chalkboard",
    description: "Hand-drawn chalkboard illustration",
    promptText:
      "Chalkboard art style, white and colored chalk on dark green/black board, hand-drawn lettering, chalk dust texture, cafe menu board aesthetic, sketchy organic illustrations",
    platforms: ["instagram"],
  },
  {
    name: "Low Poly",
    description: "Geometric low-polygon 3D art",
    promptText:
      "Low polygon 3D art style, flat-shaded triangular facets, geometric crystalline forms, vibrant gradient colors across facets, modern digital art aesthetic, angular abstract shapes",
    platforms: ["instagram"],
  },
  {
    name: "Embroidery",
    description: "Cross-stitch and embroidery textile art",
    promptText:
      "Embroidery textile art style, visible thread stitches and cross-stitch patterns, fabric texture background, floral motifs, handcraft needlework aesthetic, warm homemade feel",
    platforms: ["instagram"],
  },
  {
    name: "Synthwave",
    description: "Retro 80s synthwave digital aesthetic",
    promptText:
      "Synthwave retro aesthetic, chrome text effects, sunset gradient sky pink to purple, wireframe mountains, retro sports car, laser grid floor, 1980s sci-fi movie poster feel, retrowave digital art",
    platforms: ["instagram"],
  },
  // ── Caption / text styles ──
  {
    name: "Professional & Concise",
    description: "Business-forward tone with clear, structured messaging",
    promptText:
      "Write in a professional, concise business tone. Use clear and direct language. Minimal emojis (1-2 max). Include a subtle call-to-action. Keep sentences short and impactful. Structure with line breaks for readability.",
    platforms: ["instagram"],
    kind: "caption",
  },
  {
    name: "Casual & Friendly",
    description: "Conversational everyday tone with emojis",
    promptText:
      "Write in a casual, friendly conversational tone like talking to a friend. Use emojis naturally throughout. Keep it relatable and approachable. Short sentences, contractions, and everyday language. End with a question to drive engagement.",
    platforms: ["instagram"],
    kind: "caption",
  },
  {
    name: "Inspirational & Motivational",
    description: "Uplifting quotes and powerful language",
    promptText:
      "Write in an inspirational, motivational tone. Use powerful, emotive language. Include quotable one-liners. Build up to a strong finish. Use relevant hashtags. Line breaks between key phrases for dramatic effect. Occasional 🔥💪✨ emojis.",
    platforms: ["instagram"],
    kind: "caption",
  },
  {
    name: "Witty & Playful",
    description: "Humor, wordplay, and pop culture references",
    promptText:
      "Write in a witty, playful tone with clever wordplay and puns. Use humor that's smart but accessible. Reference pop culture where relevant. Keep it light and entertaining. Surprise the reader with an unexpected twist or punchline.",
    platforms: ["instagram"],
    kind: "caption",
  },
  {
    name: "Storytelling & Narrative",
    description: "Mini-stories with emotional hooks",
    promptText:
      "Write as a mini-story or personal narrative. Start with an attention-grabbing hook. Build tension or curiosity. Use descriptive, sensory language. End with a meaningful takeaway or call-to-action. Make the reader feel something.",
    platforms: ["instagram"],
    kind: "caption",
  },
];

export const styleRouter = router({
  list: orgProtectedProcedure.query(async ({ ctx }) => {
    const styles = await ctx.prisma.style.findMany({
      where: {
        OR: [
          { orgId: ctx.orgId },
          { isPredefined: true, orgId: null },
        ],
      },
      orderBy: [{ isPredefined: "desc" }, { createdAt: "desc" }],
    });

    return styles.map((style) => ({
      ...style,
      sampleImageUrls: style.sampleImageIds.map(sampleIdToUrl),
      referenceImageUrl: style.referenceImageId
        ? sampleIdToUrl(style.referenceImageId)
        : null,
    }));
  }),

  get: orgProtectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const style = await ctx.prisma.style.findUnique({
        where: { id: input.id },
      });

      if (!style) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Style not found" });
      }

      if (!style.isPredefined && style.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      return {
        ...style,
        sampleImageUrls: style.sampleImageIds.map(
          (id) => `/api/images/${id}?type=stored`
        ),
        referenceImageUrl: style.referenceImageId
          ? `/api/images/${style.referenceImageId}?type=stored`
          : null,
      };
    }),

  create: orgProtectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        description: z.string().optional(),
        promptText: z.string().min(1),
        platforms: z.array(z.string()).optional(),
        parentStyleIds: z.array(z.string()).optional(),
        kind: z.enum(["image", "caption"]).optional(),
        sampleTexts: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const style = await ctx.prisma.style.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          promptText: input.promptText,
          platforms: input.platforms ?? [],
          parentStyleIds: input.parentStyleIds ?? [],
          kind: input.kind ?? "image",
          sampleTexts: input.sampleTexts ?? [],
          sampleImageIds: [],
          isPredefined: false,
          orgId: ctx.orgId,
        },
      });

      return style;
    }),

  update: orgProtectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).optional(),
        promptText: z.string().min(1).optional(),
        platforms: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const style = await ctx.prisma.style.findFirst({
        where: { id, orgId: ctx.orgId, isPredefined: false },
      });
      if (!style) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.style.update({ where: { id }, data });
    }),

  delete: orgProtectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const style = await ctx.prisma.style.findUnique({
        where: { id: input.id },
      });

      if (!style) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Style not found" });
      }

      if (style.isPredefined) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete predefined styles",
        });
      }

      if (style.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      // Clean up images — R2 keys and legacy StoredImage blobs
      const allKeys = [...style.sampleImageIds];
      if (style.referenceImageId) allKeys.push(style.referenceImageId);

      const r2Keys = allKeys.filter((k) => k.startsWith("style-previews/"));
      const legacyIds = allKeys.filter((k) => !k.startsWith("style-previews/"));

      // Delete R2 objects (non-blocking)
      await Promise.allSettled(r2Keys.map((key) => deleteFromR2(key)));

      // Delete legacy StoredImage blobs
      if (legacyIds.length > 0) {
        await ctx.prisma.storedImage.deleteMany({
          where: { id: { in: legacyIds } },
        });
      }

      await ctx.prisma.style.delete({ where: { id: input.id } });
      return { success: true };
    }),

  generatePreview: orgProtectedProcedure
    .input(z.object({ promptText: z.string().min(1) }))
    .mutation(async ({ input }) => {
      // Generate 4 IG-style sample images and upload to R2 (original + WebP)
      const igPrompt = toIgPrompt(input.promptText);
      const results = await Promise.all([
        generateImage(igPrompt, "nano-banana-2", "1:1"),
        generateImage(igPrompt, "nano-banana-2", "1:1"),
        generateImage(igPrompt, "nano-banana-2", "1:1"),
        generateImage(igPrompt, "nano-banana-2", "1:1"),
      ]);

      const r2Keys = await Promise.all(
        results.map((img) => uploadStylePreviewToR2(img.base64, img.mimeType))
      );

      return {
        sampleImageIds: r2Keys,
        sampleImageUrls: r2Keys.map(sampleIdToUrl),
      };
    }),

  // Poll progress of background preview generation
  previewProgress: orgProtectedProcedure.query(() => {
    return { ...previewProgress };
  }),

  // Bulk generate preview images for all styles. force=true regenerates all.
  generateAllPreviews: orgProtectedProcedure
    .input(z.object({ force: z.boolean().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const force = input?.force ?? false;

      if (previewProgress.isRunning) {
        return {
          message: "Generation already in progress",
          queued: previewProgress.total - previewProgress.completed,
          total: previewProgress.total,
        };
      }

      const styles = await ctx.prisma.style.findMany({
        where: {
          OR: [
            { orgId: ctx.orgId },
            { isPredefined: true, orgId: null },
          ],
          kind: { not: "caption" },
        },
        select: { id: true, name: true, promptText: true, sampleImageIds: true },
        orderBy: { createdAt: "asc" },
      });

      const needsGeneration = force
        ? styles
        : styles.filter((s) => s.sampleImageIds.length < 4);

      if (needsGeneration.length === 0) {
        return { message: "All styles already have 4 previews", queued: 0, total: styles.length };
      }

      startBackgroundGeneration(needsGeneration, force);

      return {
        message: `Generating previews for ${needsGeneration.length} styles in background`,
        queued: needsGeneration.length,
        total: styles.length,
      };
    }),

  // Generate previews for specific styles (used after create / save with prompt change)
  generatePreviewsForStyles: orgProtectedProcedure
    .input(z.object({ styleIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const styles = await ctx.prisma.style.findMany({
        where: {
          id: { in: input.styleIds },
          kind: { not: "caption" },
        },
        select: { id: true, name: true, promptText: true, sampleImageIds: true },
      });

      if (styles.length === 0) {
        return { message: "No image styles to generate", queued: 0 };
      }

      if (!startBackgroundGeneration(styles, true)) {
        return { message: "Generation already in progress — try again shortly", queued: 0 };
      }

      return {
        message: `Generating previews for ${styles.length} styles`,
        queued: styles.length,
      };
    }),

  // Migrate existing StoredImage blobs to R2 for all styles
  migrateToR2: orgProtectedProcedure.mutation(async ({ ctx }) => {
    const styles = await ctx.prisma.style.findMany({
      where: {
        OR: [
          { orgId: ctx.orgId },
          { isPredefined: true, orgId: null },
        ],
      },
      select: { id: true, name: true, sampleImageIds: true, referenceImageId: true },
    });

    let migrated = 0;
    let skipped = 0;

    for (const style of styles) {
      const allIds = [...style.sampleImageIds];
      if (style.referenceImageId) allIds.push(style.referenceImageId);

      // Only migrate legacy IDs (not already R2 keys)
      const legacyIds = allIds.filter((id) => !id.startsWith("style-previews/"));
      if (legacyIds.length === 0) {
        skipped++;
        continue;
      }

      // Fetch blobs and upload to R2
      const newMapping = new Map<string, string>(); // old ID → new R2 key
      for (const legacyId of legacyIds) {
        try {
          const blob = await ctx.prisma.storedImage.findUnique({
            where: { id: legacyId },
          });
          if (!blob) continue;

          const r2Key = await uploadStylePreviewToR2(
            Buffer.from(blob.data).toString("base64"),
            blob.mimeType
          );
          newMapping.set(legacyId, r2Key);
        } catch (err) {
          console.error(`Failed to migrate image ${legacyId}:`, err);
        }
      }

      if (newMapping.size === 0) continue;

      // Update style record with R2 keys
      const newSampleIds = style.sampleImageIds.map((id) => newMapping.get(id) ?? id);
      const newRefId = style.referenceImageId
        ? newMapping.get(style.referenceImageId) ?? style.referenceImageId
        : null;

      await ctx.prisma.style.update({
        where: { id: style.id },
        data: {
          sampleImageIds: newSampleIds,
          ...(newRefId !== null ? { referenceImageId: newRefId } : {}),
        },
      });

      // Delete migrated blobs from PostgreSQL
      const migratedIds = [...newMapping.keys()];
      if (migratedIds.length > 0) {
        await ctx.prisma.storedImage.deleteMany({
          where: { id: { in: migratedIds } },
        });
      }

      migrated++;
    }

    return {
      message: `Migrated ${migrated} styles to R2, ${skipped} already on R2`,
      migrated,
      skipped,
    };
  }),

  seed: orgProtectedProcedure.mutation(async ({ ctx }) => {
    const existingStyles = await ctx.prisma.style.findMany({
      where: { isPredefined: true },
      select: { id: true, name: true, platforms: true },
    });
    const existingNames = new Set(existingStyles.map((s) => s.name));

    // Create new styles
    const newStyles = PREDEFINED_STYLES.filter(
      (style) => !existingNames.has(style.name)
    );

    let createdCount = 0;
    if (newStyles.length > 0) {
      const created = await ctx.prisma.style.createMany({
        data: newStyles.map((style) => ({
          name: style.name,
          description: style.description,
          promptText: style.promptText,
          platforms: style.platforms,
          kind: style.kind ?? "image",
          sampleImageIds: [],
          isPredefined: true,
        })),
      });
      createdCount = created.count;
    }

    // Sync platform tags on existing predefined styles to match source of truth
    const styleMap = new Map(PREDEFINED_STYLES.map((s) => [s.name, s.platforms]));
    const updates = existingStyles
      .filter((s) => {
        const expected = styleMap.get(s.name);
        if (!expected) return false;
        return JSON.stringify([...s.platforms].sort()) !== JSON.stringify([...expected].sort());
      })
      .map((s) =>
        ctx.prisma.style.update({
          where: { id: s.id },
          data: { platforms: styleMap.get(s.name)! },
        })
      );

    if (updates.length > 0) {
      await Promise.all(updates);
    }

    // Auto-generate caption samples for any predefined caption styles missing them
    const captionStylesMissingSamples = await ctx.prisma.style.findMany({
      where: { isPredefined: true, kind: "caption", sampleTexts: { equals: [] } },
      select: { id: true, name: true, promptText: true },
    });

    if (captionStylesMissingSamples.length > 0) {
      // Generate caption samples in parallel (text gen is fast)
      await Promise.all(
        captionStylesMissingSamples.map(async (cs) => {
          try {
            const prompt = `You are a social media caption writer. Your writing style is described as: "${cs.promptText}"

Generate exactly 3 short Instagram caption examples (each 1-3 sentences) that demonstrate this writing style. The captions should be for generic lifestyle/brand content so they showcase the STYLE, not specific content.

Return ONLY the 3 captions, separated by the delimiter "---". No numbering, no labels, no explanation.`;

            const result = await geminiPro.generateContent(prompt);
            const cleaned = (typeof result === "string" ? result : "").trim();
            const samples = cleaned
              .split("---")
              .map((s) => s.trim())
              .filter((s) => s.length > 0)
              .slice(0, 3);

            if (samples.length > 0) {
              await ctx.prisma.style.update({
                where: { id: cs.id },
                data: { sampleTexts: samples },
              });
            }
          } catch (err) {
            console.error(`Failed to generate caption samples for style "${cs.name}":`, err);
          }
        })
      );
    }

    return {
      message: createdCount > 0
        ? `Seeded ${createdCount} new predefined styles`
        : updates.length > 0
          ? `Updated ${updates.length} existing styles with platform tags`
          : "All predefined styles already exist",
      count: createdCount,
      updated: updates.length,
      total: existingStyles.length + createdCount,
    };
  }),

  fromImage: orgProtectedProcedure
    .input(
      z.object({
        base64: z.string().min(1),
        mimeType: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      // Upload reference image to R2
      const refKey = await uploadStylePreviewToR2(input.base64, input.mimeType);

      const analysisResult = await geminiText.generateContent([
        {
          inlineData: {
            data: input.base64,
            mimeType: input.mimeType,
          },
        },
        {
          text: "Analyze this image and describe its visual style in detail. Focus on colors, typography, composition, textures, mood, and design elements. Write a concise style prompt (1-2 sentences) that could be used to generate images with a similar aesthetic. Return ONLY the style prompt, nothing else.",
        },
      ]);

      const cleanedPrompt =
        (typeof analysisResult === "string" ? analysisResult : "").trim() ||
        "Modern design with clean composition";

      // Generate 4 sample images and upload to R2
      const results = await Promise.all([
        generateImage(cleanedPrompt, "nano-banana-2", "1:1"),
        generateImage(cleanedPrompt, "nano-banana-2", "1:1"),
        generateImage(cleanedPrompt, "nano-banana-2", "1:1"),
        generateImage(cleanedPrompt, "nano-banana-2", "1:1"),
      ]);

      const r2Keys = await Promise.all(
        results.map((img) => uploadStylePreviewToR2(img.base64, img.mimeType))
      );

      return {
        promptText: cleanedPrompt,
        referenceImageId: refKey,
        sampleImageIds: r2Keys,
        sampleImageUrls: r2Keys.map(sampleIdToUrl),
        referenceImageUrl: sampleIdToUrl(refKey),
      };
    }),

  remix: orgProtectedProcedure
    .input(z.object({ sourceStyleId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const source = await ctx.prisma.style.findUnique({
        where: { id: input.sourceStyleId },
      });
      if (!source) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Source style not found" });
      }
      if (!source.isPredefined && source.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      const prompt = `Given this visual style description: "${source.promptText}"

Create a creative variation that keeps the core aesthetic but introduces fresh elements. Change some aspects like color palette shifts, texture variations, or composition tweaks while maintaining the overall mood and feel.

Return ONLY the new style description as a single prompt (1-2 sentences), nothing else.`;

      const variation = await geminiText.generateContent(prompt);
      const cleanedVariation = (typeof variation === "string" ? variation : "").trim();

      return {
        name: `${source.name} — Remix`,
        description: source.description ? `Remix of: ${source.description}` : null,
        promptText: cleanedVariation || source.promptText,
        platforms: source.platforms,
        parentStyleIds: [source.id],
      };
    }),

  blend: orgProtectedProcedure
    .input(z.object({ styleIdA: z.string(), styleIdB: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [styleA, styleB] = await Promise.all([
        ctx.prisma.style.findUnique({ where: { id: input.styleIdA } }),
        ctx.prisma.style.findUnique({ where: { id: input.styleIdB } }),
      ]);

      if (!styleA || !styleB) {
        throw new TRPCError({ code: "NOT_FOUND", message: "One or both styles not found" });
      }

      for (const s of [styleA, styleB]) {
        if (!s.isPredefined && s.orgId !== ctx.orgId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
      }

      const prompt = `Combine these two visual styles into one cohesive new style:

Style A: "${styleA.promptText}"
Style B: "${styleB.promptText}"

Create a harmonious blend that takes the best elements from both styles and merges them into something new and cohesive.

Return ONLY the new blended style description as a single prompt (1-2 sentences), nothing else.`;

      const blended = await geminiText.generateContent(prompt);
      const cleanedBlend = (typeof blended === "string" ? blended : "").trim();

      const platforms = [...new Set([...styleA.platforms, ...styleB.platforms])];

      return {
        name: `${styleA.name} × ${styleB.name}`,
        description: `Blend of ${styleA.name} and ${styleB.name}`,
        promptText: cleanedBlend || `${styleA.promptText}. ${styleB.promptText}`,
        platforms,
        parentStyleIds: [styleA.id, styleB.id],
      };
    }),

  generateCaptionPreview: orgProtectedProcedure
    .input(z.object({ promptText: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const prompt = `You are a social media caption writer. Your writing style is described as: "${input.promptText}"

Generate exactly 3 short Instagram caption examples (each 1-3 sentences) that demonstrate this writing style. The captions should be for generic lifestyle/brand content so they showcase the STYLE, not specific content.

Return ONLY the 3 captions, separated by the delimiter "---". No numbering, no labels, no explanation.`;

      const result = await geminiPro.generateContent(prompt);
      const cleaned = (typeof result === "string" ? result : "").trim();
      const samples = cleaned
        .split("---")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .slice(0, 3);

      return {
        sampleTexts: samples.length > 0 ? samples : ["Sample caption in this style"],
      };
    }),

  saveWithHistory: orgProtectedProcedure
    .input(
      z.object({
        id: z.string(),
        promptText: z.string().min(1),
        sampleImageIds: z.array(z.string()).optional(),
        sampleTexts: z.array(z.string()).optional(),
        name: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const style = await ctx.prisma.style.findUnique({
        where: { id: input.id },
      });
      if (!style) throw new TRPCError({ code: "NOT_FOUND" });
      if (!style.isPredefined && style.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Push current state to history
      await ctx.prisma.styleHistory.create({
        data: {
          styleId: style.id,
          promptText: style.promptText,
          sampleImageIds: style.sampleImageIds,
          sampleTexts: style.sampleTexts,
        },
      });

      // Update style with new values
      const updateData: Record<string, unknown> = {
        promptText: input.promptText,
      };
      if (input.sampleImageIds) updateData.sampleImageIds = input.sampleImageIds;
      if (input.sampleTexts) updateData.sampleTexts = input.sampleTexts;
      if (input.name) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;

      const updated = await ctx.prisma.style.update({
        where: { id: input.id },
        data: updateData,
      });

      return {
        ...updated,
        sampleImageUrls: updated.sampleImageIds.map(sampleIdToUrl),
      };
    }),

  getHistory: orgProtectedProcedure
    .input(z.object({ styleId: z.string() }))
    .query(async ({ ctx, input }) => {
      const entries = await ctx.prisma.styleHistory.findMany({
        where: { styleId: input.styleId },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      return entries.map((e) => ({
        ...e,
        sampleImageUrls: e.sampleImageIds.map(sampleIdToUrl),
      }));
    }),

  restoreHistory: orgProtectedProcedure
    .input(z.object({ historyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.prisma.styleHistory.findUnique({
        where: { id: input.historyId },
      });
      if (!entry) throw new TRPCError({ code: "NOT_FOUND" });

      const style = await ctx.prisma.style.findUnique({
        where: { id: entry.styleId },
      });
      if (!style) throw new TRPCError({ code: "NOT_FOUND" });
      if (!style.isPredefined && style.orgId !== ctx.orgId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Push current state to history first
      await ctx.prisma.styleHistory.create({
        data: {
          styleId: style.id,
          promptText: style.promptText,
          sampleImageIds: style.sampleImageIds,
          sampleTexts: style.sampleTexts,
        },
      });

      // Restore from history entry
      const updated = await ctx.prisma.style.update({
        where: { id: style.id },
        data: {
          promptText: entry.promptText,
          sampleImageIds: entry.sampleImageIds,
          sampleTexts: entry.sampleTexts,
        },
      });

      return {
        ...updated,
        sampleImageUrls: updated.sampleImageIds.map(sampleIdToUrl),
      };
    }),
});
