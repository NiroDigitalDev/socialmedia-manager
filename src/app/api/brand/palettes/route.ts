import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const palettes = await prisma.brandPalette.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(palettes);
  } catch (error) {
    console.error("Fetch palettes error:", error);
    return NextResponse.json(
      { error: "Failed to fetch palettes" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, accentColor, bgColor } = body as {
      name: string;
      accentColor: string;
      bgColor: string;
    };

    if (!name?.trim() || !accentColor?.trim() || !bgColor?.trim()) {
      return NextResponse.json(
        { error: "name, accentColor, and bgColor are required" },
        { status: 400 }
      );
    }

    const palette = await prisma.brandPalette.create({
      data: {
        name: name.trim(),
        accentColor: accentColor.trim(),
        bgColor: bgColor.trim(),
      },
    });

    return NextResponse.json(palette);
  } catch (error) {
    console.error("Create palette error:", error);
    const message = error instanceof Error ? error.message : "Failed to create palette";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
