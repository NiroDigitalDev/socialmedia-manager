import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get("sourceId");

    const where: { isSaved: boolean; sourceId?: string } = { isSaved: true };
    if (sourceId) {
      where.sourceId = sourceId;
    }

    const ideas = await prisma.contentIdea.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        source: {
          select: { title: true },
        },
      },
    });

    return NextResponse.json(ideas);
  } catch (error) {
    console.error("Error fetching saved ideas:", error);
    return NextResponse.json(
      { error: "Failed to fetch saved ideas" },
      { status: 500 }
    );
  }
}
