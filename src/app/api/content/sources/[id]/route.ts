import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const source = await prisma.contentSource.findUnique({
      where: { id },
      include: {
        ideas: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!source) {
      return NextResponse.json(
        { error: "Content source not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(source);
  } catch (error) {
    console.error("Error fetching content source:", error);
    return NextResponse.json(
      { error: "Failed to fetch content source" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.contentSource.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting content source:", error);
    return NextResponse.json(
      { error: "Failed to delete content source" },
      { status: 500 }
    );
  }
}
