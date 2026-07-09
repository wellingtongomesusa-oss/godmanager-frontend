import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import {
  canAccessClientId,
  getClientScopeWhere,
  toClientScopeUser,
} from '@/lib/clientScope';
import {
  parseDelinquencyCsv,
  matchTenantForRow,
  type TenantLite,
} from '@/lib/delinquency';

export const dynamic = 'force-dynamic';

function canManageDelinquency(role: string): boolean {
  return ['super_admin', 'admin', 'manager'].includes(role);
}

/**
 * POST /api/delinquency/preview  { csv, clientId? }
 * Faz o parse do relatório e casa cada inquilino em atraso com o cadastro (unidade/nome),
 * devolvendo a lista para revisão (sem enviar nada).
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!canManageDelinquency(user.role)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      csv?: string;
      clientId?: string;
    };
    const csv = String(body?.csv || '');
    if (!csv.trim()) {
      return NextResponse.json({ ok: false, error: 'csv required' }, { status: 400 });
    }

    const scopeUser = toClientScopeUser(user);
    let clientId: string;
    if (user.role === 'super_admin') {
      const raw =
        body.clientId != null && String(body.clientId).trim() !== ''
          ? String(body.clientId).trim()
          : user.clientId;
      if (!raw) {
        return NextResponse.json(
          { ok: false, error: 'clientId required for super_admin' },
          { status: 400 },
        );
      }
      clientId = raw;
    } else {
      if (!user.clientId) {
        return NextResponse.json({ ok: false, error: 'User has no clientId' }, { status: 400 });
      }
      clientId = user.clientId;
    }
    if (!canAccessClientId(scopeUser, clientId)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const rows = parseDelinquencyCsv(csv);
    if (!rows.length) {
      return NextResponse.json({ ok: true, clientId, items: [], summary: { total: 0 } });
    }

    // Carrega inquilinos do cliente (com a propriedade) para casar
    const scope = getClientScopeWhere(scopeUser);
    const tenants = await prisma.tenant.findMany({
      where: { ...scope, clientId },
      select: {
        id: true,
        name: true,
        email: true,
        unit: true,
        propertyId: true,
        status: true,
        property: { select: { id: true, address: true, code: true } },
      },
    });
    const tenantLites: TenantLite[] = tenants.map((t) => ({
      id: t.id,
      name: t.name,
      email: t.email,
      unit: t.unit,
      propertyId: t.propertyId,
      propertyAddress: t.property?.address ?? null,
      propertyCode: t.property?.code ?? null,
      status: t.status,
    }));

    const items = rows.map((r) => {
      const m = matchTenantForRow(r, tenantLites);
      const email = m?.email && m.email.includes('@') ? m.email : null;
      return {
        unit: r.unit,
        csvName: r.name,
        amountReceivable: r.amountReceivable,
        past0_30: r.past0_30,
        past30plus: r.past30plus,
        lastPayment: r.lastPayment,
        lateCount: r.lateCount,
        matched: !!m,
        tenantId: m?.id ?? null,
        tenantName: m?.name ?? null,
        propertyId: m?.propertyId ?? null,
        propertyAddress: m?.propertyAddress ?? null,
        email,
        sendable: !!(m && email),
      };
    });

    const summary = {
      total: items.length,
      matched: items.filter((i) => i.matched).length,
      sendable: items.filter((i) => i.sendable).length,
      noMatch: items.filter((i) => !i.matched).length,
      noEmail: items.filter((i) => i.matched && !i.email).length,
      totalReceivable: items.reduce((s, i) => s + i.amountReceivable, 0),
    };

    return NextResponse.json({ ok: true, clientId, items, summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed';
    console.error('[POST /api/delinquency/preview]', e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
