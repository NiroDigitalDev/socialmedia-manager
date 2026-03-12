import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const sources = await prisma.contentSource.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { ideas: true },
        },
      },
    });

    return NextResponse.json(sources);
  } catch (error) {
    console.error("Error fetching content sources:", error);
    return NextResponse.json(
      { error: "Failed to fetch content sources" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, rawText } = body as { title: string; rawText: string };

    if (!title || !rawText) {
      return NextResponse.json(
        { error: "Title and rawText are required" },
        { status: 400 }
      );
    }

    const source = await prisma.contentSource.create({
      data: { title, rawText },
      include: {
        _count: {
          select: { ideas: true },
        },
      },
    });

    return NextResponse.json(source, { status: 201 });
  } catch (error) {
    console.error("Error creating content source:", error);
    return NextResponse.json(
      { error: "Failed to create content source" },
      { status: 500 }
    );
  }
}
