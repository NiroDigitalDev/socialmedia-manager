import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadImageBuffer } from "@/lib/cloudinary";

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

    const { url } = await uploadImageBuffer(
      buffer,
      "socialmedia-manager/brand"
    );

    const existing = await prisma.brandSettings.findFirst();

    if (existing) {
      await prisma.brandSettings.update({
        where: { id: existing.id },
        data: { logoUrl: url },
      });
    } else {
      await prisma.brandSettings.create({
        data: {
          brandName: "My Brand",
          colors: [],
          logoUrl: url,
        },
      });
    }

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Logo upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload logo" },
      { status: 500 }
    );
  }
}
