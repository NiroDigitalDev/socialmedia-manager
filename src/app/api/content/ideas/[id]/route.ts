import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { isSaved } = body as { isSaved: boolean };

    if (typeof isSaved !== "boolean") {
      return NextResponse.json(
        { error: "isSaved must be a boolean" },
        { status: 400 }
      );
    }

    const idea = await prisma.contentIdea.update({
      where: { id },
      data: { isSaved },
    });

    return NextResponse.json(idea);
  } catch (error) {
    console.error("Error updating idea:", error);
    return NextResponse.json(
      { error: "Failed to update idea" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.contentIdea.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting idea:", error);
    return NextResponse.json(
      { error: "Failed to delete idea" },
      { status: 500 }
    );
  }
}
