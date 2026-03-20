import { NextRequest, NextResponse } from "next/server";
import { extractText } from "unpdf";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum 20MB." }, { status: 400 });
    }

    const isText = file.name.match(/\.(md|txt|markdown)$/i);
    if (!ALLOWED_TYPES.includes(file.type) && !isText) {
      return NextResponse.json(
        { error: "Unsupported file type. Use PDF, Markdown, or plain text." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);

    if (file.type === "application/pdf") {
      const { text, totalPages } = await extractText(new Uint8Array(arrayBuffer));
      const joined = (Array.isArray(text) ? text.join("\n\n") : text).trim();
      if (!joined) {
        return NextResponse.json(
          { error: "Could not extract text from this PDF. It may be image-only." },
          { status: 400 }
        );
      }
      return NextResponse.json({ text: joined, pageCount: totalPages });
    }

    // Plain text / markdown
    const text = buf.toString("utf-8").trim();
    if (!text) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }
    return NextResponse.json({ text, pageCount: null });
  } catch (error) {
    console.error("File parse error:", error);
    return NextResponse.json({ error: "Failed to parse file" }, { status: 500 });
  }
}
