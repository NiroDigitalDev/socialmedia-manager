import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const brand = await prisma.brandSettings.findFirst();
    if (brand) {
      return NextResponse.json({
        ...brand,
        logoUrl: brand.logoImageId ? `/api/images/${brand.logoImageId}` : null,
      });
    }
    return NextResponse.json(null);
  } catch (error) {
    console.error("Fetch brand settings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch brand settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brandName, colors, tagline } = body;

    if (!brandName || typeof brandName !== "string") {
      return NextResponse.json(
        { error: "brandName is required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(colors)) {
      return NextResponse.json(
        { error: "colors must be an array" },
        { status: 400 }
      );
    }

    const existing = await prisma.brandSettings.findFirst();

    let brand;
    if (existing) {
      brand = await prisma.brandSettings.update({
        where: { id: existing.id },
        data: { brandName, colors, tagline: tagline || null },
      });
    } else {
      brand = await prisma.brandSettings.create({
        data: { brandName, colors, tagline: tagline || null },
      });
    }

    return NextResponse.json(brand);
  } catch (error) {
    console.error("Save brand settings error:", error);
    return NextResponse.json(
      { error: "Failed to save brand settings" },
      { status: 500 }
    );
  }
}
