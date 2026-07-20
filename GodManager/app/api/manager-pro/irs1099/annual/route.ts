import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

/**
 * GET /api/manager-pro/irs1099/annual?year=YYYY[&clientId=][&format=csv][&all=1]
 *
 * Relatorio 1099 ANUAL, um unico arquivo, no layout exigido pelo IRS:
 *  - Vendors com send1099=true  -> 1099-NEC, Box 1 (Nonemployee compensation) = soma de VendorPayment no ano.
 *  - Owners                      -> 1099-MISC, Box 1 (Rents) = alugueis brutos coletados (totalIncome) no ano.
 *
 * SOMENTE LEITURA: nao grava nada, nao move dinheiro. Restrito a super_admin/admin
 * (dados fiscais/PII). O TIN sai preenchido quando cadastrado (W-9) e em branco quando nao.
 * Limiar padrao: US$ 600/ano por destinatario (all=1 inclui todos > 0).
 */

type Recipient = {
  form: '1099-NEC' | '1099-MISC';
  box: string;
  name: string;
  taxId: string;
  tinType: string;
  w9OnFile: boolean;
  street: string;
  city: string;
  state: string;
  zip: string;
  email: string;
  phone: string;
  amount: number;
  payments: number;
  source: string;
};

const money = (n: number) => Math.round(n * 100) / 100;

function csvField(v: string | number | boolean): string {
  const s = typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v ?? '');
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  const role = String(user.role || '').toLowerCase();
  if (role !== 'super_admin' && role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Acesso restrito a administradores.' }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const yearRaw = (url.searchParams.get('year') || '').trim();
    const year = /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : new Date().getUTCFullYear();
    const format = (url.searchParams.get('format') || 'json').trim().toLowerCase();
    const includeAll = url.searchParams.get('all') === '1';
    const threshold = includeAll ? 0.01 : 600;

    const clientIdParam = (url.searchParams.get('clientId') || '').trim();
    // Escopo: super_admin pode filtrar por clientId (ou ver todos); demais ficam presos ao proprio clientId.
    let scopedClientId: string | null = null;
    if (role === 'super_admin') {
      scopedClientId = clientIdParam || null;
    } else {
      if (!user.clientId) {
        return NextResponse.json({ ok: false, error: 'Cliente não definido.' }, { status: 400 });
      }
      if (clientIdParam && clientIdParam !== user.clientId) {
        return NextResponse.json({ ok: false, error: 'Sem acesso a este cliente.' }, { status: 403 });
      }
      scopedClientId = user.clientId;
    }

    const from = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const to = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));

    // Payer (quem emite o 1099) = empresa do cliente.
    let payerName = 'Manager Prop LLC';
    if (scopedClientId) {
      const c = await prisma.client.findUnique({ where: { id: scopedClientId }, select: { companyName: true } });
      if (c?.companyName) payerName = c.companyName;
    }

    // ---- Vendors -> 1099-NEC (Box 1) ----
    const vpWhere: Record<string, unknown> = { paidAt: { gte: from, lt: to } };
    if (scopedClientId) vpWhere.clientId = scopedClientId;
    const vendorPayments = await prisma.vendorPayment.findMany({
      where: vpWhere,
      select: {
        amount: true,
        vendor: {
          select: {
            id: true, companyName: true, send1099: true,
            taxId: true, taxIdType: true, w9OnFile: true,
            addressStreet: true, addressCity: true, addressState: true, addressZip: true,
            email: true, phone: true,
          },
        },
      },
    });
    const vendorAgg = new Map<string, Recipient>();
    for (const p of vendorPayments) {
      const v = p.vendor;
      if (!v || v.send1099 === false) continue;
      const cur = vendorAgg.get(v.id) || {
        form: '1099-NEC', box: '1 (Nonemployee compensation)', name: v.companyName || '',
        taxId: v.taxId || '', tinType: v.taxIdType || '', w9OnFile: !!v.w9OnFile,
        street: v.addressStreet || '', city: v.addressCity || '', state: v.addressState || '', zip: v.addressZip || '',
        email: v.email || '', phone: v.phone || '', amount: 0, payments: 0, source: 'vendor_payments',
      } as Recipient;
      cur.amount += Number(p.amount || 0);
      cur.payments += 1;
      vendorAgg.set(v.id, cur);
    }

    // ---- Owners -> 1099-MISC (Box 1 Rents) = alugueis brutos coletados ----
    const propWhere: Record<string, unknown> = {};
    if (scopedClientId) propWhere.clientId = scopedClientId;
    const payouts = await prisma.ownerMonthPayout.findMany({
      where: { paidAt: { gte: from, lt: to }, property: propWhere },
      select: {
        totalIncome: true, paidAmount: true,
        property: {
          select: {
            ownerName: true,
            owner: {
              select: {
                id: true, name: true, taxId: true, taxIdType: true,
                addressStreet: true, addressCity: true, addressState: true, addressZip: true,
                email: true, phone: true,
              },
            },
          },
        },
      },
    });
    const ownerAgg = new Map<string, Recipient>();
    for (const p of payouts) {
      const o = p.property?.owner;
      const name = o?.name || p.property?.ownerName || '';
      if (!name) continue;
      const key = o?.id || `name:${name.toLowerCase()}`;
      // Box 1 (Rents) = alugueis brutos coletados no periodo (totalIncome); paidAmount fica so como referencia.
      const gross = Number(p.totalIncome || 0);
      const cur = ownerAgg.get(key) || {
        form: '1099-MISC', box: '1 (Rents)', name,
        taxId: o?.taxId || '', tinType: o?.taxIdType || '', w9OnFile: false,
        street: o?.addressStreet || '', city: o?.addressCity || '', state: o?.addressState || '', zip: o?.addressZip || '',
        email: o?.email || '', phone: o?.phone || '', amount: 0, payments: 0, source: 'owner_month_payouts',
      } as Recipient;
      cur.amount += gross;
      cur.payments += 1;
      ownerAgg.set(key, cur);
    }

    const all: Recipient[] = [...vendorAgg.values(), ...ownerAgg.values()]
      .map((r) => ({ ...r, amount: money(r.amount) }))
      .sort((a, b) => a.form.localeCompare(b.form) || b.amount - a.amount);

    const reportable = all.filter((r) => r.amount >= threshold);
    const missingTin = reportable.filter((r) => !r.taxId).length;

    if (format === 'csv') {
      const header = [
        'Form Type', 'Payer', 'Recipient Name', 'Recipient TIN', 'TIN Type', 'W-9 On File',
        'Street Address', 'City', 'State', 'Zip', 'Email', 'Phone',
        'Box', 'Amount', '# Payments', 'Meets $600', 'Source',
      ];
      const lines = [header.map(csvField).join(',')];
      for (const r of reportable) {
        lines.push([
          r.form, payerName, r.name, r.taxId, r.tinType, r.w9OnFile,
          r.street, r.city, r.state, r.zip, r.email, r.phone,
          r.box, r.amount.toFixed(2), r.payments, r.amount >= 600, r.source,
        ].map(csvField).join(','));
      }
      const csv = '﻿' + lines.join('\r\n') + '\r\n';
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="1099_${year}_${payerName.replace(/[^A-Za-z0-9]+/g, '_')}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json({
      ok: true,
      year,
      payer: payerName,
      threshold,
      counts: {
        vendorsNEC: [...vendorAgg.values()].filter((r) => r.amount >= threshold).length,
        ownersMISC: [...ownerAgg.values()].filter((r) => r.amount >= threshold).length,
        reportable: reportable.length,
        missingTin,
      },
      totals: {
        nec: money(reportable.filter((r) => r.form === '1099-NEC').reduce((s, r) => s + r.amount, 0)),
        misc: money(reportable.filter((r) => r.form === '1099-MISC').reduce((s, r) => s + r.amount, 0)),
      },
      rows: reportable,
    });
  } catch (e) {
    console.error('[GET /api/manager-pro/irs1099/annual]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Falha ao gerar o relatório 1099.' }, { status: 500 });
  }
}
