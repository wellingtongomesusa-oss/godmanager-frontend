import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserFromSession } from "@/lib/authServer";
import { getClientScopeWhere, toClientScopeUser } from "@/lib/clientScope";

export const dynamic = "force-dynamic";

const MAX_PHOTOS_PER_JOB = 20;

export async function GET(_req: Request, { params }: { params: { jobId: string } }) {
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

  const photos = await prisma.jobPhoto.findMany({
    where: { jobId: expense.id, ...getClientScopeWhere(scopeUser) },
    orderBy: [{ containerNumber: "asc" }, { uploadedAt: "desc" }],
    select: {
      id: true,
      containerNumber: true,
      publicUrl: true,
      filename: true,
      contentType: true,
      sizeBytes: true,
      uploadedAt: true,
      uploadedBy: true,
    },
  });

  return NextResponse.json({
    photos: photos.map((p) => ({
      ...p,
      containerNumber: p.containerNumber,
      uploadedAt: p.uploadedAt.toISOString(),
    })),
    count: photos.length,
    max: MAX_PHOTOS_PER_JOB,
  });
}
