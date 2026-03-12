import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteImage } from "@/lib/cloudinary";

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

    // Delete sample images from Cloudinary
    for (const url of style.sampleImageUrls) {
      try {
        // Extract public ID from Cloudinary URL
        const parts = url.split("/upload/");
        if (parts[1]) {
          const publicId = parts[1]
            .replace(/^v\d+\//, "")
            .replace(/\.[^/.]+$/, "");
          await deleteImage(publicId);
        }
      } catch (err) {
        console.error("Error deleting image from Cloudinary:", err);
      }
    }

    // Delete reference image from Cloudinary if present
    if (style.referenceImageUrl) {
      try {
        const parts = style.referenceImageUrl.split("/upload/");
        if (parts[1]) {
          const publicId = parts[1]
            .replace(/^v\d+\//, "")
            .replace(/\.[^/.]+$/, "");
          await deleteImage(publicId);
        }
      } catch (err) {
        console.error("Error deleting reference image from Cloudinary:", err);
      }
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
