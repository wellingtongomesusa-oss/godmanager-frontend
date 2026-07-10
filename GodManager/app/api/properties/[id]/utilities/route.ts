import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { encrypt } from '@/lib/encryption';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

const SERVICE_TYPES = [
  'Electricity',
  'Water',
  'Gas',
  'Internet',
  'Cable TV',
  'HOA',
  'Security',
  'Solar',
  'Outros',
];

/** Resolve a propriedade e valida acesso do usuário. */
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
  if (role !== 'super_admin') {
    if (!user.clientId || property.clientId !== user.clientId) {
      return { ok: false as const, status: 403, error: 'Acesso negado.' };
    }
  }
  if (!clientId) return { ok: false as const, status: 400, error: 'Propriedade sem cliente.' };
  return { ok: true as const, user, clientId, propertyId };
}

/** GET — lista as contas de consumo (NUNCA retorna a senha; só hasPassword). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const acc = await resolvePropertyAccess(params.id);
  if (!acc.ok) return NextResponse.json({ ok: false, error: acc.error }, { status: acc.status });

  const rows = await prisma.utilityAccount.findMany({
    where: { propertyId: acc.propertyId, clientId: acc.clientId },
    orderBy: [{ serviceType: 'asc' }, { company: 'asc' }],
  });
  const accounts = rows.map((r) => ({
    id: r.id,
    company: r.company,
    serviceType: r.serviceType,
    accountNumber: r.accountNumber,
    login: r.login,
    hasPassword: !!r.passwordEnc,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
  return NextResponse.json({ ok: true, accounts, serviceTypes: SERVICE_TYPES });
}

/** POST — cria uma conta de consumo (senha é criptografada). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const acc = await resolvePropertyAccess(params.id);
  if (!acc.ok) return NextResponse.json({ ok: false, error: acc.error }, { status: acc.status });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const company = String(body.company ?? '').trim();
  const serviceType = String(body.serviceType ?? '').trim();
  if (!company) return NextResponse.json({ ok: false, error: 'Empresa obrigatória.' }, { status: 400 });
  if (!serviceType) return NextResponse.json({ ok: false, error: 'Tipo de serviço obrigatório.' }, { status: 400 });

  const passwordRaw = body.password != null ? String(body.password) : '';

  const created = await prisma.utilityAccount.create({
    data: {
      clientId: acc.clientId,
      propertyId: acc.propertyId,
      company,
      serviceType,
      accountNumber: body.accountNumber != null ? String(body.accountNumber).trim() || null : null,
      login: body.login != null ? String(body.login).trim() || null : null,
      passwordEnc: passwordRaw ? encrypt(passwordRaw) : null,
      notes: body.notes != null ? String(body.notes).trim() || null : null,
      createdBy: acc.user.id,
    },
  });

  await recordAudit({
    request: req,
    actor: { id: acc.user.id, email: acc.user.email },
    action: 'utility_account.create',
    entity: 'utility_account',
    entityId: created.id,
    clientId: acc.clientId,
    details: `${serviceType} · ${company} · property ${acc.propertyId}`,
  });

  return NextResponse.json({ ok: true, id: created.id });
}
