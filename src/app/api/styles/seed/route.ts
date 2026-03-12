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
];

export async function POST() {
  try {
    // Check if predefined styles already exist
    const existingCount = await prisma.style.count({
      where: { isPredefined: true },
    });

    if (existingCount > 0) {
      return NextResponse.json({
        message: "Predefined styles already exist",
        count: existingCount,
      });
    }

    // Create predefined styles
    const created = await prisma.style.createMany({
      data: PREDEFINED_STYLES.map((style) => ({
        name: style.name,
        description: style.description,
        promptText: style.promptText,
        sampleImageUrls: [],
        isPredefined: true,
      })),
    });

    return NextResponse.json({
      message: "Predefined styles seeded successfully",
      count: created.count,
    });
  } catch (error) {
    console.error("Error seeding styles:", error);
    return NextResponse.json(
      { error: "Failed to seed predefined styles" },
      { status: 500 }
    );
  }
}
