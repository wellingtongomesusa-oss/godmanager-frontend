import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserFromSession } from "@/lib/authServer";
import { getClientScopeWhere, toClientScopeUser } from "@/lib/clientScope";
import { deleteObject } from "@/lib/r2";

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
  const photoId = (body as { photoId?: unknown })?.photoId;
  if (typeof photoId !== "string" || !photoId.trim()) {
    return NextResponse.json({ error: "photoId is required" }, { status: 400 });
  }

  const photo = await prisma.jobPhoto.findFirst({
    where: { id: photoId.trim(), ...getClientScopeWhere(scopeUser) },
  });
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (photo.jobId !== expense.id) {
    return NextResponse.json({ error: "Photo does not belong to this job" }, { status: 400 });
  }

  try {
    await deleteObject(photo.r2Key);
  } catch (e) {
    console.warn("[jobs photos delete] R2 deleteObject failed (continuing DB delete):", e);
  }

  await prisma.jobPhoto.delete({ where: { id: photo.id } });

  return NextResponse.json({ ok: true });
}
