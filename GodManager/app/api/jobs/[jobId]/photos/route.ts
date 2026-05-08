import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserFromSession } from "@/lib/authServer";
import { toClientScopeUser, canAccessClientId } from "@/lib/clientScope";

export const dynamic = "force-dynamic";

const MAX_PHOTOS_PER_JOB = 20;

export async function GET(_req: Request, { params }: { params: { jobId: string } }) {
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

  const photos = await prisma.jobPhoto.findMany({
    where: { jobId: expense.id },
    orderBy: { uploadedAt: "desc" },
    select: {
      id: true,
      publicUrl: true,
      filename: true,
      sizeBytes: true,
      uploadedAt: true,
      uploadedBy: true,
    },
  });

  return NextResponse.json({
    photos: photos.map((p) => ({
      ...p,
      uploadedAt: p.uploadedAt.toISOString(),
    })),
    count: photos.length,
    max: MAX_PHOTOS_PER_JOB,
  });
}
