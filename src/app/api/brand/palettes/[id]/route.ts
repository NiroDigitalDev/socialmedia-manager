import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.brandPalette.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete palette error:", error);
    return NextResponse.json(
      { error: "Failed to delete palette" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, accentColor, bgColor } = body as {
      name?: string;
      accentColor?: string;
      bgColor?: string;
    };

    const palette = await prisma.brandPalette.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(accentColor && { accentColor: accentColor.trim() }),
        ...(bgColor && { bgColor: bgColor.trim() }),
      },
    });

    return NextResponse.json(palette);
  } catch (error) {
    console.error("Update palette error:", error);
    return NextResponse.json(
      { error: "Failed to update palette" },
      { status: 500 }
    );
  }
}
