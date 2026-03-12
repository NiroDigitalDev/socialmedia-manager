import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const styles = await prisma.style.findMany({
      orderBy: [{ isPredefined: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(styles);
  } catch (error) {
    console.error("Error fetching styles:", error);
    return NextResponse.json(
      { error: "Failed to fetch styles" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, promptText, referenceImageUrl, sampleImageUrls } =
      body;

    if (!name || !promptText) {
      return NextResponse.json(
        { error: "Name and promptText are required" },
        { status: 400 }
      );
    }

    const style = await prisma.style.create({
      data: {
        name,
        description: description || null,
        promptText,
        referenceImageUrl: referenceImageUrl || null,
        sampleImageUrls: sampleImageUrls || [],
        isPredefined: false,
      },
    });

    return NextResponse.json(style, { status: 201 });
  } catch (error) {
    console.error("Error creating style:", error);
    return NextResponse.json(
      { error: "Failed to create style" },
      { status: 500 }
    );
  }
}
