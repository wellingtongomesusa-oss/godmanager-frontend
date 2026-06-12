import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { getCurrentUserFromSession } from "@/lib/authServer";
import { getClientScopeWhere, toClientScopeUser } from "@/lib/clientScope";
import { generateUploadUrl, publicUrlForKey } from "@/lib/r2";
import {
  MAX_PHOTOS_PER_JOB,
  parseContainerNumber,
  jobPhotoR2KeyPrefix,
} from "@/lib/jobPhotos";

export const dynamic = "force-dynamic";

const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

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
    if (!userVendorId || String(expense.vendorId || "").trim() !== userVendorId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const photoCount = await prisma.jobPhoto.count({
    where: { jobId: expense.id, ...getClientScopeWhere(scopeUser) },
  });
  if (photoCount >= MAX_PHOTOS_PER_JOB) {
    return NextResponse.json({ error: "Limite de 20 fotos atingido" }, { status: 400 });
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

  if (typeof contentType !== "string" || !ALLOWED_CONTENT_TYPES.includes(contentType as (typeof ALLOWED_CONTENT_TYPES)[number])) {
    return NextResponse.json(
      { error: `contentType must be one of: ${ALLOWED_CONTENT_TYPES.join(", ")}` },
      { status: 400 }
    );
  }
  if (typeof sizeBytes !== "number" || sizeBytes <= 0 || sizeBytes > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: `sizeBytes must be between 1 and ${MAX_SIZE_BYTES} bytes` },
      { status: 400 }
    );
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
