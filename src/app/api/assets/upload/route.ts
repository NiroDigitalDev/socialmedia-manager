import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadToR2, publicUrl } from "@/lib/r2";

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
  "image/avif",
  "application/pdf",
  "text/markdown",
]);

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(request: NextRequest) {
  // Authenticate
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = session.session.activeOrganizationId;
  if (!orgId) {
    return NextResponse.json(
      { error: "No active organization" },
      { status: 400 }
    );
  }

  // Verify membership
  const membership = await prisma.member.findFirst({
    where: { userId: session.user.id, organizationId: orgId },
  });
  if (!membership) {
    return NextResponse.json(
      { error: "Not a member of this organization" },
      { status: 403 }
    );
  }

  // Parse form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  const category = formData.get("category") as string | null;
  const projectId = formData.get("projectId") as string | null;

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!category || !["reference", "asset"].includes(category)) {
    return NextResponse.json(
      { error: "Invalid category. Must be 'reference' or 'asset'" },
      { status: 400 }
    );
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      {
        error: `Unsupported file type: ${file.type}. Allowed: ${[...ALLOWED_MIME_TYPES].join(", ")}`,
      },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
      { status: 400 }
    );
  }

  // Validate project ownership if projectId provided
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId },
    });
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }
  }

  // Upload to R2
  const fileId = crypto.randomUUID();
  const r2Key = `assets/${orgId}/${fileId}/${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await uploadToR2(r2Key, buffer, file.type);
  } catch (err) {
    console.error("R2 upload failed:", err);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }

  // Create DB record
  const asset = await prisma.asset.create({
    data: {
      r2Key,
      mimeType: file.type,
      fileName: file.name,
      category: category as "reference" | "asset",
      projectId: projectId || undefined,
      orgId,
    },
  });

  return NextResponse.json({
    ...asset,
    url: publicUrl(r2Key),
  });
}
