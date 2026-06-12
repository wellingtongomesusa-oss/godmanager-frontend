import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserFromSession } from "@/lib/authServer";
import { getClientScopeWhere, toClientScopeUser } from "@/lib/clientScope";
import {
  MAX_PHOTOS_PER_JOB,
  parseContainerNumber,
  validateJobPhotoR2Key,
} from "@/lib/jobPhotos";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { jobId: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobId = params.jobId;
  const scopeUser = toClientScopeUser(user);
  const expense = await prisma.pmExpense.findFirst({
    where: { id: jobId, ...getClientScopeWhere(scopeUser) },
    select: { id: true, clientId: true, vendorId: true },
  });
  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (String(user.role || "").toLowerCase() === "vendor") {
    const userVendorId = String(user.vendorId || "").trim();
    if (!userVendorId || String(expense.vendorId || "").trim() !== userVendorId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
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

  const containerNumber = parseContainerNumber(raw.containerNumber);
  if (containerNumber === null) {
    return NextResponse.json(
      { error: "containerNumber must be an integer between 1 and 5" },
      { status: 400 }
    );
  }

  if (!validateJobPhotoR2Key(r2Key.trim(), expense.clientId, expense.id, containerNumber)) {
    return NextResponse.json({ error: "Invalid r2Key" }, { status: 400 });
  }

  const count = await prisma.jobPhoto.count({
    where: { jobId: expense.id, ...getClientScopeWhere(scopeUser) },
  });
  if (count >= MAX_PHOTOS_PER_JOB) {
    return NextResponse.json({ error: "Limite de 20 fotos atingido" }, { status: 400 });
  }

  try {
    const photo = await prisma.jobPhoto.create({
      data: {
        jobId: expense.id,
        containerNumber,
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
        containerNumber: photo.containerNumber,
        publicUrl: photo.publicUrl,
        filename: photo.filename,
        contentType: photo.contentType,
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
