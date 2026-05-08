import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserFromSession } from "@/lib/authServer";
import { toClientScopeUser, canAccessClientId } from "@/lib/clientScope";

export const dynamic = "force-dynamic";

const MAX_PHOTOS_PER_JOB = 20;

export async function POST(req: Request, { params }: { params: { jobId: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobId = params.jobId;
  const expense = await prisma.pmExpense.findUnique({
    where: { id: jobId },
    select: { id: true, clientId: true },
  });
  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const scopeUser = toClientScopeUser(user);
  if (!canAccessClientId(scopeUser, expense.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const raw = (body || {}) as Record<string, unknown>;
  const r2Key = raw.r2Key;
  const publicUrl = raw.publicUrl;
  const filename = raw.filename;
  const sizeBytes = raw.sizeBytes;
  const contentType = raw.contentType;

  if (typeof r2Key !== "string" || !r2Key.trim()) {
    return NextResponse.json({ error: "r2Key is required" }, { status: 400 });
  }
  if (typeof publicUrl !== "string" || !publicUrl.trim()) {
    return NextResponse.json({ error: "publicUrl is required" }, { status: 400 });
  }

  if (!r2Key.startsWith("job-photos/") || r2Key.includes("..") || r2Key.includes("//")) {
    return NextResponse.json({ error: "Invalid r2Key" }, { status: 400 });
  }

  const jobSegment = `/${expense.id}/`;
  if (!r2Key.includes(jobSegment)) {
    return NextResponse.json({ error: "Invalid r2Key" }, { status: 400 });
  }

  const expectedPrefix = `job-photos/${expense.clientId || "no-client"}/${expense.id}/`;
  if (!r2Key.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "Invalid r2Key" }, { status: 400 });
  }

  const count = await prisma.jobPhoto.count({ where: { jobId: expense.id } });
  if (count >= MAX_PHOTOS_PER_JOB) {
    return NextResponse.json({ error: "Limite de 20 fotos atingido" }, { status: 400 });
  }

  try {
    const photo = await prisma.jobPhoto.create({
      data: {
        jobId: expense.id,
        clientId: expense.clientId,
        r2Key: r2Key.trim(),
        publicUrl: publicUrl.trim(),
        filename: typeof filename === "string" && filename.trim() ? filename.trim() : null,
        sizeBytes: typeof sizeBytes === "number" && Number.isFinite(sizeBytes) ? Math.floor(sizeBytes) : null,
        contentType: typeof contentType === "string" && contentType.trim() ? contentType.trim() : null,
        uploadedBy: user.id || null,
      },
    });

    return NextResponse.json({
      photo: {
        id: photo.id,
        publicUrl: photo.publicUrl,
        filename: photo.filename,
        uploadedAt: photo.uploadedAt.toISOString(),
        uploadedBy: photo.uploadedBy,
      },
    });
  } catch (err: unknown) {
    console.error("[jobs photos register]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
