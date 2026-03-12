import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Serves images from StoredImage or GeneratedImage tables
// Usage: /api/images/[id]?type=stored (default) or /api/images/[id]?type=generated
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const type = request.nextUrl.searchParams.get("type") || "stored";

    let data: Buffer;
    let mimeType: string;

    if (type === "generated") {
      const image = await prisma.generatedImage.findUnique({ where: { id } });
      if (!image) {
        return NextResponse.json({ error: "Image not found" }, { status: 404 });
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
