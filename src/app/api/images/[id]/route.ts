import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createWebPPreview } from "@/lib/image-processing";
import { publicUrl } from "@/lib/r2";

// Serves images from StoredImage or GeneratedImage tables
// Usage: /api/images/[id]?type=stored|generated&format=webp&w=480
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const type = request.nextUrl.searchParams.get("type") || "stored";
    const format = request.nextUrl.searchParams.get("format");
    const width = request.nextUrl.searchParams.get("w");

    let data: Buffer;
    let mimeType: string;

    if (type === "generated") {
      const image = await prisma.generatedImage.findUnique({ where: { id } });
      if (!image) {
        return NextResponse.json({ error: "Image not found" }, { status: 404 });
      }

      // Prefer R2 if available
      if (image.r2Key) {
        const r2Url = publicUrl(image.r2Key);
        return NextResponse.redirect(r2Url, 302);
      }

      // Legacy fallback: serve from DB bytes
      if (!image.data) {
        return NextResponse.json({ error: "No image data" }, { status: 404 });
      }
      data = Buffer.from(image.data);
      mimeType = image.mimeType;
    } else {
      const image = await prisma.storedImage.findUnique({ where: { id } });
      if (!image) {
        return NextResponse.json({ error: "Image not found" }, { status: 404 });
      }
      data = Buffer.from(image.data);
      mimeType = image.mimeType;
    }

    // Optimize on-the-fly: convert to WebP preview if requested
    if (format === "webp" || width) {
      const maxWidth = width ? parseInt(width, 10) : 480;
      data = await createWebPPreview(data, { maxWidth });
      mimeType = "image/webp";
    }

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Image serve error:", error);
    return NextResponse.json(
      { error: "Failed to serve image" },
      { status: 500 }
    );
  }
}
