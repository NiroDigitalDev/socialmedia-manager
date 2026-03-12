import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const style = await prisma.style.findUnique({
      where: { id },
    });

    if (!style) {
      return NextResponse.json({ error: "Style not found" }, { status: 404 });
    }

    return NextResponse.json(style);
  } catch (error) {
    console.error("Error fetching style:", error);
    return NextResponse.json(
      { error: "Failed to fetch style" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const style = await prisma.style.findUnique({
      where: { id },
    });

    if (!style) {
      return NextResponse.json({ error: "Style not found" }, { status: 404 });
    }

    // Delete stored images
    const imageIds = [...style.sampleImageIds];
    if (style.referenceImageId) imageIds.push(style.referenceImageId);

    if (imageIds.length > 0) {
      await prisma.storedImage.deleteMany({
        where: { id: { in: imageIds } },
      });
    }

    await prisma.style.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting style:", error);
    return NextResponse.json(
      { error: "Failed to delete style" },
      { status: 500 }
    );
  }
}
