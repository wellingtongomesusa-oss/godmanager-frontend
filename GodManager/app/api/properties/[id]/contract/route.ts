import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getR2Client, getR2Bucket, generateDownloadUrl, deleteObject } from '@/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

const ALLOWED: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

function extFromName(name: string): string {
  const m = String(name || '').toLowerCase().match(/\.(pdf|docx|doc)$/);
  return m ? m[1] : '';
}

async function resolvePropertyAccess(propertyId: string) {
  const user = await getCurrentUserFromSession();
  if (!user) return { ok: false as const, status: 401, error: 'Não autenticado.' };
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, clientId: true },
  });
  if (!property) return { ok: false as const, status: 404, error: 'Propriedade não encontrada.' };
  const role = String(user.role || '').toLowerCase();
  const clientId = property.clientId || user.clientId || null;
  if (role !== 'super_admin' && (!user.clientId || property.clientId !== user.clientId)) {
    return { ok: false as const, status: 403, error: 'Acesso negado.' };
  }
  if (!clientId) return { ok: false as const, status: 400, error: 'Propriedade sem cliente.' };
  return { ok: true as const, user, clientId, propertyId };
}

/** GET — retorna o contrato atual (com link de visualizar/baixar presigned) ou null. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const acc = await resolvePropertyAccess(params.id);
  if (!acc.ok) return NextResponse.json({ ok: false, error: acc.error }, { status: acc.status });

  const row = await prisma.propertyContract.findFirst({
    where: { propertyId: acc.propertyId, clientId: acc.clientId },
    orderBy: { updatedAt: 'desc' },
  });
  if (!row) return NextResponse.json({ ok: true, contract: null });

  let uploaderName: string | null = null;
  if (row.uploadedBy) {
    const u = await prisma.user.findUnique({
      where: { id: row.uploadedBy },
      select: { firstName: true, lastName: true, email: true },
    });
    if (u) uploaderName = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || null;
  }
  let viewUrl: string | null = null;
  let downloadUrl: string | null = null;
  try {
    viewUrl = await generateDownloadUrl(row.fileKey, undefined, 300);
    downloadUrl = await generateDownloadUrl(row.fileKey, row.fileName, 300);
  } catch {
    /* ignore — links ficam null */
  }
  return NextResponse.json({
    ok: true,
    contract: {
      id: row.id,
      fileName: row.fileName,
      fileSize: row.fileSize,
      mimeType: row.mimeType,
      uploadedAt: row.updatedAt.toISOString(),
      uploadedByName: uploaderName,
      viewUrl,
      downloadUrl,
    },
  });
}

/** POST — sobe/substitui o contrato (PDF/DOC/DOCX). Mantém 1 por propriedade. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const acc = await resolvePropertyAccess(params.id);
  if (!acc.ok) return NextResponse.json({ ok: false, error: acc.error }, { status: acc.status });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: 'Arquivo obrigatório.' }, { status: 400 });
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: 'Arquivo muito grande (máx 25MB).' }, { status: 400 });
  }
  const ext = ALLOWED[file.type] || extFromName(file.name);
  if (!ext) {
    return NextResponse.json(
      { ok: false, error: 'Formato inválido. Use PDF, DOC ou DOCX.' },
      { status: 400 },
    );
  }
  const mimeType =
    file.type && ALLOWED[file.type]
      ? file.type
      : ext === 'pdf'
        ? 'application/pdf'
        : ext === 'docx'
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'application/msword';

  const bytes = Buffer.from(await file.arrayBuffer());
  const fileKey = `contracts/${acc.clientId}/${acc.propertyId}.${ext}`;

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getR2Bucket(),
      Key: fileKey,
      Body: bytes,
      ContentType: mimeType,
    }),
  );

  const existing = await prisma.propertyContract.findFirst({
    where: { propertyId: acc.propertyId, clientId: acc.clientId },
  });
  if (existing) {
    // Se a extensão mudou, remove o arquivo antigo (chave diferente) do R2.
    if (existing.fileKey && existing.fileKey !== fileKey) {
      try {
        await deleteObject(existing.fileKey);
      } catch {
        /* ignore */
      }
    }
    await prisma.propertyContract.update({
      where: { id: existing.id },
      data: {
        fileKey,
        fileName: file.name,
        fileSize: bytes.length,
        mimeType,
        uploadedBy: acc.user.id,
      },
    });
  } else {
    await prisma.propertyContract.create({
      data: {
        clientId: acc.clientId,
        propertyId: acc.propertyId,
        fileKey,
        fileName: file.name,
        fileSize: bytes.length,
        mimeType,
        uploadedBy: acc.user.id,
      },
    });
  }

  await recordAudit({
    request: req,
    actor: { id: acc.user.id, email: acc.user.email },
    action: existing ? 'property_contract.replace' : 'property_contract.upload',
    entity: 'property_contract',
    entityId: acc.propertyId,
    clientId: acc.clientId,
    details: `${file.name} (${bytes.length} bytes)`,
  });

  return NextResponse.json({ ok: true });
}

/** DELETE — remove o contrato (arquivo + registro). */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const acc = await resolvePropertyAccess(params.id);
  if (!acc.ok) return NextResponse.json({ ok: false, error: acc.error }, { status: acc.status });

  const row = await prisma.propertyContract.findFirst({
    where: { propertyId: acc.propertyId, clientId: acc.clientId },
  });
  if (!row) return NextResponse.json({ ok: true });
  try {
    await deleteObject(row.fileKey);
  } catch {
    /* ignore */
  }
  await prisma.propertyContract.delete({ where: { id: row.id } });

  await recordAudit({
    request: req,
    actor: { id: acc.user.id, email: acc.user.email },
    action: 'property_contract.delete',
    entity: 'property_contract',
    entityId: acc.propertyId,
    clientId: acc.clientId,
    details: row.fileName,
  });
  return NextResponse.json({ ok: true });
}
