import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { putStoredImage, deleteStoredImages } from "@/lib/image-storage";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("logo") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No logo file provided" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const mimeType = file.type || "image/png";

    const storedImage = await putStoredImage(buffer, mimeType);

    const logoUrl = `/api/images/${storedImage.id}`;

    const existing = await prisma.brandSettings.findFirst();

    if (existing) {
      // Delete old logo (R2 object + DB row) if it exists
      if (existing.logoImageId) {
        await deleteStoredImages([existing.logoImageId]).catch(() => {});
      }
      await prisma.brandSettings.update({
        where: { id: existing.id },
        data: { logoImageId: storedImage.id },
      });
    } else {
      await prisma.brandSettings.create({
        data: {
          brandName: "My Brand",
          colors: [],
          logoImageId: storedImage.id,
        },
      });
    }

    return NextResponse.json({ url: logoUrl });
  } catch (error) {
    console.error("Logo upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload logo" },
      { status: 500 }
    );
  }
}
