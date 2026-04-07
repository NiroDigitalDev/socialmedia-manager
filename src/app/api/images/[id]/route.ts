import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readImageBytes } from "@/lib/image-storage";
import { getR2PublicUrl } from "@/lib/r2";

// Serves images from StoredImage or GeneratedImage tables.
// Usage: /api/images/[id]?type=stored (default) or /api/images/[id]?type=generated
//
// When R2_PUBLIC_URL is set and the row has an R2 `key`, this endpoint
// redirects to the direct CDN URL. Otherwise it proxy-streams bytes from
// R2 (or the legacy bytea column for un-migrated rows).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const type = request.nextUrl.searchParams.get("type") || "stored";

    const image =
      type === "generated"
        ? await prisma.generatedImage.findUnique({ where: { id } })
        : await prisma.storedImage.findUnique({ where: { id } });

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Fast path: R2 row + public URL configured → redirect to direct CDN URL.
    if (image.key) {
      const publicUrl = getR2PublicUrl(image.key);
      if (publicUrl) {
        return NextResponse.redirect(publicUrl, {
          status: 302,
          headers: {
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }
    }

    // Fallback: proxy-stream (works for R2 rows without public URL + legacy bytea).
    const { buffer, mimeType } = await readImageBytes(image);

    return new NextResponse(new Uint8Array(buffer), {
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
