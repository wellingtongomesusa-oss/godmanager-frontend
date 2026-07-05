import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { getCurrentUserFromSession } from "@/lib/authServer";
import { getClientScopeWhere, toClientScopeUser } from "@/lib/clientScope";
import { generateUploadUrl, publicUrlForKey } from "@/lib/r2";
import {
  MAX_PHOTOS_PER_JOB,
  MAX_VIDEOS_PER_JOB,
  MAX_PHOTO_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
  ALLOWED_PHOTO_CONTENT_TYPES,
  ALLOWED_VIDEO_CONTENT_TYPES,
  isVideoContentType,
  isPhotoContentType,
  parseContainerNumber,
  jobPhotoR2KeyPrefix,
} from "@/lib/jobPhotos";

export const dynamic = "force-dynamic";

function randomString(length: number): string {
  return randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length);
}

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
    if (!userVendorId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const vbid = await prisma.jobBid.findFirst({
      where: {
        expenseId: expense.id,
        vendorId: userVendorId,
        status: { in: ["invited", "submitted", "won"] },
      },
      select: { id: true },
    });
    if (!vbid) {
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
  const contentType = raw.contentType;
  const sizeBytes = raw.sizeBytes;

  if (typeof contentType !== "string" || (!isPhotoContentType(contentType) && !isVideoContentType(contentType))) {
    return NextResponse.json(
      { error: `contentType must be one of: ${[...ALLOWED_PHOTO_CONTENT_TYPES, ...ALLOWED_VIDEO_CONTENT_TYPES].join(", ")}` },
      { status: 400 }
    );
  }
  const isVideo = isVideoContentType(contentType);
  const maxSize = isVideo ? MAX_VIDEO_SIZE_BYTES : MAX_PHOTO_SIZE_BYTES;
  if (typeof sizeBytes !== "number" || sizeBytes <= 0 || sizeBytes > maxSize) {
    return NextResponse.json(
      { error: `sizeBytes must be between 1 and ${maxSize} bytes` },
      { status: 400 }
    );
  }

  // Limites separados por midia: fotos (20) e video (1)
  const videoWhere = {
    jobId: expense.id,
    contentType: { in: [...ALLOWED_VIDEO_CONTENT_TYPES] },
    ...getClientScopeWhere(scopeUser),
  };
  if (isVideo) {
    const videoCount = await prisma.jobPhoto.count({ where: videoWhere });
    if (videoCount >= MAX_VIDEOS_PER_JOB) {
      return NextResponse.json({ error: "Limite de 1 video por job atingido" }, { status: 400 });
    }
  } else {
    const totalCount = await prisma.jobPhoto.count({
      where: { jobId: expense.id, ...getClientScopeWhere(scopeUser) },
    });
    const videoCount = await prisma.jobPhoto.count({ where: videoWhere });
    if (totalCount - videoCount >= MAX_PHOTOS_PER_JOB) {
      return NextResponse.json({ error: "Limite de 20 fotos atingido" }, { status: 400 });
    }
  }

  const containerNumber = parseContainerNumber(raw.containerNumber);
  if (containerNumber === null) {
    return NextResponse.json(
      { error: "containerNumber must be an integer between 1 and 5" },
      { status: 400 }
    );
  }

  try {
    const subtype = contentType.split("/")[1] || "";
    const ext =
      contentType === "application/pdf" ? "pdf" : subtype === "jpeg" ? "jpg" : subtype;
    const keyPrefix = jobPhotoR2KeyPrefix(expense.clientId, expense.id, containerNumber);
    const key = `${keyPrefix}${Date.now()}-${randomString(8)}.${ext}`;

    const uploadUrl = await generateUploadUrl(key, contentType, 300);
    const publicUrl = publicUrlForKey(key);

    return NextResponse.json({
      uploadUrl,
      publicUrl,
      key,
      containerNumber,
      expiresInSeconds: 300,
    });
  } catch (err: unknown) {
    console.error("[jobs photos presigned-url]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
