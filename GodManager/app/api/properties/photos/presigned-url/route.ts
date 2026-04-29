import { NextRequest, NextResponse } from "next/server";
import { generateUploadUrl, publicUrlForKey } from "@/lib/r2";
import { randomBytes } from "crypto";

const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { propertyId, contentType, sizeBytes, originalFilename } = body || {};

    if (!propertyId || typeof propertyId !== "string") {
      return NextResponse.json({ error: "propertyId is required" }, { status: 400 });
    }
    if (!contentType || !ALLOWED_CONTENT_TYPES.includes(contentType)) {
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

    const safePropertyId = propertyId.replace(/[^a-zA-Z0-9_-]/g, "");
    if (!safePropertyId) {
      return NextResponse.json({ error: "propertyId contains no safe characters" }, { status: 400 });
    }

    const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const timestamp = Date.now();
    const random = randomBytes(6).toString("hex");
    const key = `properties/${safePropertyId}/${timestamp}-${random}.${ext}`;

    const uploadUrl = await generateUploadUrl(key, contentType, 300);
    const publicUrl = publicUrlForKey(key);

    return NextResponse.json({
      ok: true,
      uploadUrl,
      publicUrl,
      key,
      expiresInSeconds: 300,
      originalFilename: originalFilename || null,
    });
  } catch (err: any) {
    console.error("[presigned-url] Error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}
