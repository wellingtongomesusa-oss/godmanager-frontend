import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserFromSession } from "@/lib/authServer";
import { toClientScopeUser, canAccessClientId } from "@/lib/clientScope";
import { deleteObject } from "@/lib/r2";

export const dynamic = "force-dynamic";

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
  const photoId = (body as { photoId?: unknown })?.photoId;
  if (typeof photoId !== "string" || !photoId.trim()) {
    return NextResponse.json({ error: "photoId is required" }, { status: 400 });
  }

  const photo = await prisma.jobPhoto.findUnique({ where: { id: photoId.trim() } });
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (photo.jobId !== expense.id) {
    return NextResponse.json({ error: "Photo does not belong to this job" }, { status: 400 });
  }

  if (!canAccessClientId(scopeUser, photo.clientId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await deleteObject(photo.r2Key);
  } catch (e) {
    console.warn("[jobs photos delete] R2 deleteObject failed (continuing DB delete):", e);
  }

  await prisma.jobPhoto.delete({ where: { id: photo.id } });

  return NextResponse.json({ ok: true });
}
