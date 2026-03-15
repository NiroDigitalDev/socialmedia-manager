import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
];

export async function POST() {
  try {
    // Get existing predefined style names to avoid duplicates
    const existingStyles = await prisma.style.findMany({
      where: { isPredefined: true },
      select: { name: true },
    });
    const existingNames = new Set(existingStyles.map((s) => s.name));

    // Filter to only new styles
    const newStyles = PREDEFINED_STYLES.filter(
      (style) => !existingNames.has(style.name)
    );

    if (newStyles.length === 0) {
      return NextResponse.json({
        message: "All predefined styles already exist",
        count: existingStyles.length,
      });
    }

    const created = await prisma.style.createMany({
      data: newStyles.map((style) => ({
        name: style.name,
        description: style.description,
        promptText: style.promptText,
        sampleImageIds: [],
        isPredefined: true,
      })),
    });

    return NextResponse.json({
      message: `Seeded ${created.count} new predefined styles`,
      count: created.count,
      total: existingStyles.length + created.count,
    });
  } catch (error) {
    console.error("Error seeding styles:", error);
    return NextResponse.json(
      { error: "Failed to seed predefined styles" },
      { status: 500 }
    );
  }
}
