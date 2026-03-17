import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, orgProtectedProcedure } from "../init";
import { generateImage, geminiText } from "@/lib/gemini";

const PREDEFINED_STYLES = [
  {
    name: "Corporate Clean",
    description: "Professional and modern corporate aesthetic",
    promptText:
      "Professional, clean corporate design with blue and white colors, modern typography, structured layout",
  },
  {
    name: "Bold & Vibrant",
    description: "High-energy designs that grab attention",
    promptText:
      "Bold, vibrant colors, high contrast, energetic design, dynamic composition, eye-catching",
  },
  {
    name: "Minimalist",
    description: "Less is more - clean and elegant designs",
    promptText:
      "Minimalist design, lots of white space, simple typography, subtle colors, clean and elegant",
  },
  {
    name: "Retro/Vintage",
    description: "Nostalgic throwback aesthetics",
    promptText:
      "Retro vintage aesthetic, warm tones, film grain texture, classic typography, nostalgic feel",
  },
  {
    name: "Neon/Cyberpunk",
    description: "Futuristic neon-lit digital aesthetics",
    promptText:
      "Neon cyberpunk aesthetic, dark background, glowing neon colors, futuristic, high-tech",
  },
  {
    name: "Pastel Soft",
    description: "Gentle and inviting pastel designs",
    promptText:
      "Soft pastel colors, gentle gradients, rounded shapes, warm and inviting, feminine aesthetic",
  },
  {
    name: "Dark Luxury",
    description: "Premium dark-themed sophistication",
    promptText:
      "Dark luxury aesthetic, black and gold, premium feel, elegant typography, sophisticated",
  },
  {
    name: "Earthy Natural",
    description: "Organic and nature-inspired designs",
    promptText:
      "Earthy natural tones, organic textures, green and brown palette, botanical elements",
  },
  {
    name: "Gradient Modern",
    description: "Contemporary gradient-driven designs",
    promptText:
      "Modern gradient backgrounds, smooth color transitions, contemporary design, vibrant",
  },
  {
    name: "Hand-Drawn Sketch",
    description: "Artistic hand-drawn illustration style",
    promptText:
      "Hand-drawn sketch style, pencil textures, illustration aesthetic, artistic, creative",
  },
  {
    name: "3D Render",
    description: "Glossy 3D rendered objects and scenes",
    promptText:
      "3D rendered design, glossy materials, soft lighting, volumetric shadows, clean 3D objects, modern 3D illustration style",
  },
  {
    name: "Watercolor",
    description: "Soft watercolor painting aesthetic",
    promptText:
      "Watercolor painting style, soft washes of color, organic paint bleeds, textured paper background, artistic and fluid composition",
  },
  {
    name: "Pop Art",
    description: "Bold pop art inspired designs",
    promptText:
      "Pop art style, bold outlines, Ben-Day dots, high contrast, comic book aesthetic, bright saturated colors, Roy Lichtenstein inspired",
  },
  {
    name: "Glassmorphism",
    description: "Frosted glass UI design aesthetic",
    promptText:
      "Glassmorphism design, frosted glass panels, translucent layers, soft blur backgrounds, subtle borders, modern UI aesthetic",
  },
  {
    name: "Paper Cut",
    description: "Layered paper cutout art style",
    promptText:
      "Paper cut art style, layered paper shapes, soft shadows between layers, craft aesthetic, dimensional paper illustration",
  },
  {
    name: "Isometric",
    description: "Isometric 3D illustration style",
    promptText:
      "Isometric illustration, 30-degree angle view, flat shading, geometric precision, clean isometric objects, technical but playful",
  },
  {
    name: "Collage Scrapbook",
    description: "Mixed media collage and scrapbook aesthetic",
    promptText:
      "Collage scrapbook style, mixed media textures, torn paper edges, layered photographs, stickers and tape elements, creative and eclectic",
  },
  {
    name: "Typography Heavy",
    description: "Typography-driven bold text layouts",
    promptText:
      "Typography-focused design, bold text as the hero element, expressive lettering, creative text arrangements, minimal imagery, type-driven layout",
  },
  {
    name: "Brutalist",
    description: "Raw, unpolished brutalist web design aesthetic",
    promptText:
      "Brutalist design, raw unpolished aesthetic, monospaced typography, harsh borders, stark contrast, intentionally rough layout, anti-design movement inspired",
  },
  {
    name: "Vaporwave",
    description: "Retro-futuristic 80s/90s digital nostalgia",
    promptText:
      "Vaporwave aesthetic, pink and teal gradients, Greek statues, palm trees, retro computer graphics, 80s/90s nostalgia, glitch effects, sunset grid horizon",
  },
  {
    name: "Duotone",
    description: "Two-tone color overlay photography",
    promptText:
      "Duotone design, two-color overlay effect on photography, high contrast split-tone, bold color mapping, dramatic monochromatic imagery with accent color wash",
  },
  {
    name: "Flat Illustration",
    description: "Clean vector-style flat illustrations",
    promptText:
      "Flat illustration style, clean vector shapes, no gradients or shadows, geometric characters, simple clean lines, modern flat design with solid color fills",
  },
  {
    name: "Grunge Texture",
    description: "Distressed and gritty textured designs",
    promptText:
      "Grunge texture aesthetic, distressed overlay, scratched and worn surfaces, dark gritty atmosphere, rough edges, ink splatter, urban street art feel",
  },
  {
    name: "Art Deco",
    description: "1920s geometric luxury patterns",
    promptText:
      "Art Deco design, 1920s geometric patterns, gold and black color scheme, ornate symmetrical borders, fan shapes, stepped forms, Gatsby-era luxury aesthetic",
  },
  {
    name: "Claymation",
    description: "Playful clay-like 3D character style",
    promptText:
      "Claymation style, soft clay-like 3D objects, rounded forms, playful characters, handmade crafted feel, stop-motion aesthetic, warm soft lighting on clay surfaces",
  },
  {
    name: "Pixel Art",
    description: "Retro pixel art and 8-bit game aesthetic",
    promptText:
      "Pixel art style, 8-bit retro game aesthetic, visible pixel grid, limited color palette, chunky sprites, nostalgic video game art, crisp pixel edges",
  },
  {
    name: "Magazine Editorial",
    description: "High-fashion editorial magazine layout",
    promptText:
      "Magazine editorial layout, high-fashion photography aesthetic, sophisticated grid composition, elegant serif headlines, negative space, luxury publication design",
  },
  {
    name: "Psychedelic",
    description: "Trippy 60s/70s psychedelic art style",
    promptText:
      "Psychedelic art style, swirling organic patterns, vivid rainbow colors, melting shapes, 1960s concert poster aesthetic, op-art optical illusions, fluid warped typography",
  },
  {
    name: "Risograph",
    description: "Textured risograph print aesthetic",
    promptText:
      "Risograph print aesthetic, halftone dot patterns, misregistration color offset, limited ink palette, grainy textured paper, layered semi-transparent shapes, indie zine print feel",
  },
  {
    name: "Bauhaus",
    description: "Geometric Bauhaus design movement",
    promptText:
      "Bauhaus design style, primary colors red yellow blue on white, geometric circles triangles rectangles, asymmetric grid composition, sans-serif typography, modernist functional aesthetic",
  },
  {
    name: "Stained Glass",
    description: "Colorful stained glass window art",
    promptText:
      "Stained glass window art style, bold black lead outlines separating jewel-toned glass segments, translucent light effects, rich saturated colors, cathedral window mosaic composition",
  },
  {
    name: "Noir Film",
    description: "Cinematic film noir atmosphere",
    promptText:
      "Film noir style, high contrast black and white, dramatic shadows and light beams, venetian blind shadow patterns, smoky atmosphere, vintage cinema grain, detective story mood",
  },
  {
    name: "Origami",
    description: "Folded paper origami sculpture style",
    promptText:
      "Origami paper folding art style, geometric creased paper shapes, clean angular folds, soft shadows on white paper, Japanese paper craft aesthetic, precise mathematical forms",
  },
  {
    name: "Memphis Design",
    description: "80s Memphis Group bold patterns",
    promptText:
      "Memphis design movement, bold geometric shapes, squiggly lines, terrazzo patterns, bright clashing colors, asymmetric composition, 1980s Italian postmodern aesthetic, playful and irreverent",
  },
  {
    name: "Blueprint",
    description: "Technical blueprint and schematic style",
    promptText:
      "Technical blueprint style, white lines on deep blue background, engineering schematic aesthetic, grid paper, precise measurements and annotations, architectural drawing feel",
  },
  {
    name: "Chalkboard",
    description: "Hand-drawn chalkboard illustration",
    promptText:
      "Chalkboard art style, white and colored chalk on dark green/black board, hand-drawn lettering, chalk dust texture, cafe menu board aesthetic, sketchy organic illustrations",
  },
  {
    name: "Low Poly",
    description: "Geometric low-polygon 3D art",
    promptText:
      "Low polygon 3D art style, flat-shaded triangular facets, geometric crystalline forms, vibrant gradient colors across facets, modern digital art aesthetic, angular abstract shapes",
  },
  {
    name: "Embroidery",
    description: "Cross-stitch and embroidery textile art",
    promptText:
      "Embroidery textile art style, visible thread stitches and cross-stitch patterns, fabric texture background, floral motifs, handcraft needlework aesthetic, warm homemade feel",
  },
  {
    name: "Synthwave",
    description: "Retro 80s synthwave digital aesthetic",
    promptText:
      "Synthwave retro aesthetic, chrome text effects, sunset gradient sky pink to purple, wireframe mountains, retro sports car, laser grid floor, 1980s sci-fi movie poster feel, retrowave digital art",
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

    // Map styles to include image serving URLs
    return styles.map((style) => ({
      ...style,
      sampleImageUrls: style.sampleImageIds.map(
        (id) => `/api/images/${id}?type=stored`
      ),
      referenceImageUrl: style.referenceImageId
        ? `/api/images/${style.referenceImageId}?type=stored`
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

      // Verify org access: must be predefined (orgId null) or belong to the user's org
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const style = await ctx.prisma.style.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          promptText: input.promptText,
          sampleImageIds: [],
          isPredefined: false,
          orgId: ctx.orgId,
        },
      });

      return style;
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

      // Delete associated stored images
      const imageIds = [...style.sampleImageIds];
      if (style.referenceImageId) imageIds.push(style.referenceImageId);

      if (imageIds.length > 0) {
        await ctx.prisma.storedImage.deleteMany({
          where: { id: { in: imageIds } },
        });
      }

      await ctx.prisma.style.delete({ where: { id: input.id } });
      return { success: true };
    }),

  generatePreview: orgProtectedProcedure
    .input(z.object({ promptText: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // Generate 2 sample images using Gemini
      const results = await Promise.all([
        generateImage(input.promptText, "nano-banana-2", "1:1"),
        generateImage(input.promptText, "nano-banana-2", "1:1"),
      ]);

      // Store in DB
      const stored = await Promise.all(
        results.map((img) =>
          ctx.prisma.storedImage.create({
            data: {
              data: Buffer.from(img.base64, "base64"),
              mimeType: img.mimeType,
            },
          })
        )
      );

      const sampleImageIds = stored.map((s) => s.id);
      return {
        sampleImageIds,
        sampleImageUrls: sampleImageIds.map(
          (id) => `/api/images/${id}?type=stored`
        ),
      };
    }),

  seed: orgProtectedProcedure.mutation(async ({ ctx }) => {
    // Get existing predefined style names to avoid duplicates
    const existingStyles = await ctx.prisma.style.findMany({
      where: { isPredefined: true },
      select: { name: true },
    });
    const existingNames = new Set(existingStyles.map((s) => s.name));

    // Filter to only new styles
    const newStyles = PREDEFINED_STYLES.filter(
      (style) => !existingNames.has(style.name)
    );

    if (newStyles.length === 0) {
      return {
        message: "All predefined styles already exist",
        count: 0,
        total: existingStyles.length,
      };
    }

    const created = await ctx.prisma.style.createMany({
      data: newStyles.map((style) => ({
        name: style.name,
        description: style.description,
        promptText: style.promptText,
        sampleImageIds: [],
        isPredefined: true,
      })),
    });

    return {
      message: `Seeded ${created.count} new predefined styles`,
      count: created.count,
      total: existingStyles.length + created.count,
    };
  }),

  fromImage: orgProtectedProcedure
    .input(
      z.object({
        base64: z.string().min(1),
        mimeType: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Store the reference image in DB
      const refImage = await ctx.prisma.storedImage.create({
        data: {
          data: Buffer.from(input.base64, "base64"),
          mimeType: input.mimeType,
        },
      });

      // Use Gemini vision to analyze the image and extract a style description
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

      // Generate 2 sample images using the extracted style prompt
      const results = await Promise.all([
        generateImage(cleanedPrompt, "nano-banana-2", "1:1"),
        generateImage(cleanedPrompt, "nano-banana-2", "1:1"),
      ]);

      // Store samples in DB
      const stored = await Promise.all(
        results.map((img) =>
          ctx.prisma.storedImage.create({
            data: {
              data: Buffer.from(img.base64, "base64"),
              mimeType: img.mimeType,
            },
          })
        )
      );

      const sampleImageIds = stored.map((s) => s.id);

      return {
        promptText: cleanedPrompt,
        referenceImageId: refImage.id,
        sampleImageIds,
        sampleImageUrls: sampleImageIds.map(
          (id) => `/api/images/${id}?type=stored`
        ),
        referenceImageUrl: `/api/images/${refImage.id}?type=stored`,
      };
    }),
});
