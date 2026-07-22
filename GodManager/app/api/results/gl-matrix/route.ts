import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';

export const dynamic = 'force-dynamic';

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * GET /api/results/gl-matrix?clientId=&year=2026
 * Matriz casa × mês (calendário): aluguel RECEBIDO (amarelo) e PAGO ao owner (verde) por mês,
 * com o Owner, o repasse esperado (aluguel − mgm fee cadastrado) e o total a pagar/receber.
 * Só leitura, a partir do GL importado (PropertyGlTxn).
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  try {
    const url = new URL(req.url);
    const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
    if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

    const yearRaw = Number(url.searchParams.get('year'));
    const year = Number.isFinite(yearRaw) && yearRaw >= 2000 && yearRaw <= 2100 ? Math.trunc(yearRaw) : 2026;
    const yPrefix = `${year}-`;

    const txns = await prisma.propertyGlTxn.findMany({
      where: { clientId: scope.clientId },
      select: { propertyId: true, propertyLabel: true, kind: true, amount: true, txnDate: true },
    });

    type Cell = { received: number; paid: number; mgm: number };
    type Row = {
      propertyId: string | null;
      key: string;
      code: string;
      name: string;
      owner: string;
      cells: Map<string, Cell>;
      received: number;
      paid: number;
      mgm: number;
    };
    const rows = new Map<string, Row>();
    const monthsSet = new Set<string>();
    const mkCell = (): Cell => ({ received: 0, paid: 0, mgm: 0 });

    for (const t of txns) {
      const cal = t.txnDate.toISOString().slice(0, 7); // YYYY-MM calendário
      if (!cal.startsWith(yPrefix)) continue;
      const key = t.propertyId || `__u__:${t.propertyLabel}`;
      const r =
        rows.get(key) ||
        ({ propertyId: t.propertyId, key, code: '', name: t.propertyLabel, owner: '', cells: new Map(), received: 0, paid: 0, mgm: 0 } as Row);
      const cell = r.cells.get(cal) || mkCell();
      const amt = Number(t.amount);
      if (t.kind === 'RECEIVED') { cell.received += amt; r.received += amt; }
      else if (t.kind === 'SENT') { cell.paid += amt; r.paid += amt; }
      else if (t.kind === 'MGM_FEE') { cell.mgm += amt; r.mgm += amt; }
      r.cells.set(cal, cell);
      rows.set(key, r);
      monthsSet.add(cal);
    }

    // Nome/código/owner/% de gestão cadastrado das casas casadas.
    const feePctById = new Map<string, number>();
    const ids = [...rows.values()].map((v) => v.propertyId).filter((x): x is string => !!x);
    if (ids.length) {
      const props = await prisma.property.findMany({
        where: { id: { in: ids } },
        select: { id: true, code: true, address: true, mgmtFeePct: true, ownerName: true, owner: { select: { name: true } } },
      });
      const byId = new Map(props.map((p) => [p.id, p]));
      for (const r of rows.values()) {
        const p = r.propertyId ? byId.get(r.propertyId) : null;
        if (p) {
          r.code = p.code || '';
          r.name = p.address || r.name;
          r.owner = (p.ownerName || p.owner?.name || '').trim();
          feePctById.set(r.propertyId as string, Number(p.mgmtFeePct ?? 0));
        }
      }
    }
    const effPct = (raw: number) => (!Number.isFinite(raw) || raw < 0 || raw > 30 ? 8 : raw);

    const months = [...monthsSet].sort();

    const outRows = [...rows.values()]
      .map((r) => {
        const reg = r.propertyId ? effPct(feePctById.get(r.propertyId) ?? 8) : 8;
        const cells: Record<string, { received: number; paid: number; mgm: number; expected: number }> = {};
        for (const m of months) {
          const c = r.cells.get(m);
          if (!c) continue;
          cells[m] = {
            received: round2(c.received),
            paid: round2(c.paid),
            mgm: round2(c.mgm),
            expected: round2(c.received * (1 - reg / 100)),
          };
        }
        const expectedTotal = round2(r.received * (1 - reg / 100));
        // "Aluguel" da casa: recebido do mês mais recente com recebimento > 0 (proxy do aluguel mensal).
        let rent = 0;
        for (let i = months.length - 1; i >= 0; i--) {
          const c = cells[months[i]];
          if (c && c.received > 0) { rent = c.received; break; }
        }
        return {
          propertyId: r.propertyId,
          code: r.code,
          name: r.name,
          owner: r.owner,
          matched: !!r.propertyId,
          regPct: reg,
          rent,
          cells,
          received: round2(r.received),
          paid: round2(r.paid),
          mgm: round2(r.mgm),
          expected: expectedTotal,
          // Positivo = ainda a pagar ao owner; negativo = pago a mais (a receber de volta).
          net: round2(expectedTotal - r.paid),
        };
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const totals = {
      received: round2(outRows.reduce((s, r) => s + r.received, 0)),
      paid: round2(outRows.reduce((s, r) => s + r.paid, 0)),
      expected: round2(outRows.reduce((s, r) => s + r.expected, 0)),
      net: round2(outRows.reduce((s, r) => s + r.net, 0)),
      properties: outRows.length,
    };

    return NextResponse.json({ ok: true, year, months, rows: outRows, totals });
  } catch (e) {
    console.error('[GET /api/results/gl-matrix]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Falha ao montar a matriz do GL.' }, { status: 500 });
  }
}
