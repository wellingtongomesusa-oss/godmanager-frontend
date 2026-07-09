import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { recordAudit } from '@/lib/auditServer';
import {
  canAccessClientId,
  getClientScopeWhere,
  toClientScopeUser,
} from '@/lib/clientScope';
import { sendEmailAndLog } from '@/lib/email';

export const dynamic = 'force-dynamic';

function canManageDelinquency(role: string): boolean {
  return ['super_admin', 'admin', 'manager'].includes(role);
}

function money(n: number): string {
  return '$' + Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function esc(s: string): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

interface SendItem {
  tenantId: string;
  amountReceivable: number;
  past0_30: number;
  past30plus: number;
}

function buildHtml(opts: {
  tenantName: string;
  propertyAddress: string;
  intro: string;
  amountReceivable: number;
  past0_30: number;
  past30plus: number;
}): string {
  const introHtml = esc(opts.intro).replace(/\n/g, '<br>');
  return `<!doctype html><html><body style="margin:0;background:#f5f3ee;font-family:Arial,Helvetica,sans-serif;color:#2b2b2b">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <div style="background:#fff;border:1px solid #e5e0d6;border-radius:12px;overflow:hidden">
      <div style="background:#22558c;color:#fff;padding:18px 24px;font-size:16px;font-weight:700">Payment Reminder / Aviso de Pagamento</div>
      <div style="padding:24px">
        <p style="margin:0 0 14px">Dear ${esc(opts.tenantName)},</p>
        <p style="margin:0 0 16px;line-height:1.6">${introHtml}</p>
        <table style="width:100%;border-collapse:collapse;margin:8px 0 18px">
          <tr><td style="padding:8px 10px;border:1px solid #e5e0d6;color:#666">Property</td><td style="padding:8px 10px;border:1px solid #e5e0d6;font-weight:600">${esc(opts.propertyAddress)}</td></tr>
          <tr><td style="padding:8px 10px;border:1px solid #e5e0d6;color:#666">Current (0–30 days)</td><td style="padding:8px 10px;border:1px solid #e5e0d6">${money(opts.past0_30)}</td></tr>
          <tr><td style="padding:8px 10px;border:1px solid #e5e0d6;color:#666">Past due (30+ days)</td><td style="padding:8px 10px;border:1px solid #e5e0d6">${money(opts.past30plus)}</td></tr>
          <tr><td style="padding:10px;border:1px solid #e5e0d6;color:#22558c;font-weight:700">Total Amount Due</td><td style="padding:10px;border:1px solid #e5e0d6;color:#b83030;font-weight:700;font-size:16px">${money(opts.amountReceivable)}</td></tr>
        </table>
        <p style="margin:0 0 16px;line-height:1.6">Please submit your payment at your earliest convenience. If you have already made this payment, kindly disregard this notice. For any questions or to arrange payment, simply reply to this email.</p>
        <p style="margin:0;line-height:1.6;color:#666;font-size:13px">Thank you,<br><strong>Manager Prop LLC — Billing</strong></p>
      </div>
    </div>
    <p style="text-align:center;color:#a99;font-size:11px;margin:14px 0 0">Sent via GodManager</p>
  </div></body></html>`;
}

/**
 * POST /api/delinquency/send
 *   { items: [{ tenantId, amountReceivable, past0_30, past30plus }], subject, intro, clientId? }
 * Envia cobrança para cada inquilino selecionado. Revalida o inquilino no banco e usa o
 * e-mail do CADASTRO (nunca confia num e-mail vindo do cliente). Cada envio é logado
 * automaticamente no histórico da casa + do inquilino (via sendEmailAndLog).
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
      items?: SendItem[];
      subject?: string;
      intro?: string;
      clientId?: string;
    };
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) {
      return NextResponse.json({ ok: false, error: 'items required' }, { status: 400 });
    }
    const subject = String(body.subject || '').trim() || 'Payment Reminder — Amount Due';
    const intro =
      String(body.intro || '').trim() ||
      'This is a friendly reminder that your account currently shows a balance due. Please find the details below.';

    const scopeUser = toClientScopeUser(user);
    let clientId: string;
    if (user.role === 'super_admin') {
      const raw =
        body.clientId != null && String(body.clientId).trim() !== ''
          ? String(body.clientId).trim()
          : user.clientId;
      if (!raw) {
        return NextResponse.json({ ok: false, error: 'clientId required for super_admin' }, { status: 400 });
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

    const authorName =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email || 'Unknown';
    const author = { id: user.id, name: authorName, role: user.role };

    // Revalida todos os inquilinos de uma vez, dentro do escopo do cliente
    const scope = getClientScopeWhere(scopeUser);
    const ids = items.map((i) => String(i.tenantId)).filter(Boolean);
    const tenants = await prisma.tenant.findMany({
      where: { ...scope, clientId, id: { in: ids } },
      select: {
        id: true,
        name: true,
        email: true,
        propertyId: true,
        property: { select: { address: true } },
      },
    });
    const tenantById = new Map(tenants.map((t) => [t.id, t]));

    const results: Array<{ tenantId: string; ok: boolean; error?: string; email?: string }> = [];
    let sent = 0;
    for (const item of items) {
      const t = tenantById.get(String(item.tenantId));
      if (!t) {
        results.push({ tenantId: item.tenantId, ok: false, error: 'tenant_not_found' });
        continue;
      }
      const email = t.email && t.email.includes('@') ? t.email : null;
      if (!email) {
        results.push({ tenantId: item.tenantId, ok: false, error: 'no_email' });
        continue;
      }
      const html = buildHtml({
        tenantName: t.name,
        propertyAddress: t.property?.address || '',
        intro,
        amountReceivable: Number(item.amountReceivable) || 0,
        past0_30: Number(item.past0_30) || 0,
        past30plus: Number(item.past30plus) || 0,
      });

      const r = await sendEmailAndLog({
        to: email,
        subject,
        html,
        clientId,
        author,
        propertyId: t.propertyId,
        tenantId: t.id,
        recipientType: 'TENANT',
        kind: 'delinquency',
      });

      if (r.ok) sent++;
      results.push({ tenantId: item.tenantId, ok: r.ok, error: r.ok ? undefined : r.error, email });
    }

    await recordAudit({
      request: req,
      actor: { id: user.id, email: user.email },
      action: 'delinquency.send',
      entity: 'delinquency',
      entityId: clientId,
      clientId,
      details: JSON.stringify({ requested: items.length, sent }),
    });

    return NextResponse.json({ ok: true, sent, total: items.length, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed';
    console.error('[POST /api/delinquency/send]', e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
