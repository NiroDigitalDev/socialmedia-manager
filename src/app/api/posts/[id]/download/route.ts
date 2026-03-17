import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import JSZip from "jszip";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const slideParam = request.nextUrl.searchParams.get("slide");

    const post = await prisma.generatedPost.findUnique({
      where: { id },
      include: {
        images: { orderBy: { slideNumber: "asc" } },
      },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Single image download
    if (slideParam) {
      const slideNumber = parseInt(slideParam);
      const image = post.images.find((img) => img.slideNumber === slideNumber);
      if (!image) {
        return NextResponse.json(
          { error: "Image not found" },
          { status: 404 }
        );
      }

      return new NextResponse(Buffer.from(image.data), {
        headers: {
          "Content-Type": image.mimeType,
          "Content-Disposition": `attachment; filename="post-${id}-slide-${slideNumber}.png"`,
        },
      });
    }

    // Download all as zip (for carousel or single)
    if (post.images.length === 1) {
      return new NextResponse(Buffer.from(post.images[0].data), {
        headers: {
          "Content-Type": post.images[0].mimeType,
          "Content-Disposition": `attachment; filename="post-${id}.png"`,
        },
      });
    }

    // Multiple images - create zip
    const zip = new JSZip();

    for (const image of post.images) {
      zip.file(`slide-${image.slideNumber}.png`, Buffer.from(image.data));
    }

    const zipArrayBuffer = await zip.generateAsync({ type: "arraybuffer" });

    return new NextResponse(zipArrayBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="post-${id}-carousel.zip"`,
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Failed to download" },
      { status: 500 }
    );
  }
}
