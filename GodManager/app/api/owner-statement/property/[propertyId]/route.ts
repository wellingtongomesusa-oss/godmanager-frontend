import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { canAccessClientId, getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';

export const dynamic = 'force-dynamic';

type Meta = Record<string, unknown>;

function asMeta(m: unknown): Meta {
  if (m && typeof m === 'object' && !Array.isArray(m)) return m as Meta;
  return {};
}

type StmtStatus = 'approved' | 'pending' | 'disputed';

function parseBody(body: unknown): {
  lastPaymentAmount: number | null;
  lastPaymentDate: string | null;
  status: StmtStatus | null;
} | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const o = body as Record<string, unknown>;

  let lastPaymentAmount: number | null = null;
  if ('lastPaymentAmount' in o) {
    const v = o.lastPaymentAmount;
    if (v === null) lastPaymentAmount = null;
    else if (typeof v === 'number' && Number.isFinite(v)) lastPaymentAmount = v;
    else if (typeof v === 'string' && v.trim()) {
      const n = parseFloat(v);
      lastPaymentAmount = Number.isFinite(n) ? n : null;
    } else lastPaymentAmount = null;
  }

  let lastPaymentDate: string | null = null;
  if ('lastPaymentDate' in o) {
    const v = o.lastPaymentDate;
    if (v === null || v === '') lastPaymentDate = null;
    else if (typeof v === 'string') {
      const d = new Date(v);
      lastPaymentDate = Number.isNaN(d.getTime()) ? null : d.toISOString();
    } else lastPaymentDate = null;
  }

  let status: StmtStatus | null = null;
  if ('status' in o) {
    const v = o.status;
    if (v === null || v === '') status = null;
    else if (v === 'approved' || v === 'pending' || v === 'disputed') status = v;
    else return null;
  }

  return { lastPaymentAmount, lastPaymentDate, status };
}

export async function POST(req: Request, { params }: { params: { propertyId: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const rawParam = params.propertyId?.trim();
  if (!rawParam) {
    return NextResponse.json({ ok: false, error: 'propertyId required' }, { status: 400 });
  }

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = parseBody(bodyJson);
  if (!parsed) {
    return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
  }

  try {
    const scopeUser = toClientScopeUser(user);
    const scope = getClientScopeWhere(scopeUser);

    const property = await prisma.property.findFirst({
      where: {
        AND: [scope, { OR: [{ id: rawParam }, { code: rawParam }] }],
      },
    });

    if (!property) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    }
    if (!canAccessClientId(scopeUser, property.clientId)) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const currentMeta = asMeta(property.metadata);
    const statementOverride = {
      lastPaymentAmount: parsed.lastPaymentAmount,
      lastPaymentDate: parsed.lastPaymentDate,
      status: parsed.status,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id,
    };

    const nextMetadata = {
      ...currentMeta,
      statementOverride,
    } satisfies Record<string, unknown>;

    await prisma.property.update({
      where: { id: property.id },
      data: { metadata: nextMetadata as Prisma.InputJsonValue },
    });

    return NextResponse.json({ ok: true, override: statementOverride });
  } catch (e) {
    console.error('[POST /api/owner-statement/property/:propertyId]', e);
    return NextResponse.json({ ok: false, error: 'Failed to save' }, { status: 500 });
  }
}
