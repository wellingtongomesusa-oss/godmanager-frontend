'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  listCardsDemo,
  listDepartmentsDemo,
  listTransactionsDemo,
  type RampTransaction,
} from '@/lib/integrations/ramp';

export default function RampIntegrationPage() {
  const [tx, setTx] = useState<RampTransaction[]>([]);
  const [cards, setCards] = useState<Awaited<ReturnType<typeof listCardsDemo>>>([]);
  const [dept, setDept] = useState<Awaited<ReturnType<typeof listDepartmentsDemo>>>([]);
  const [filtroInicio, setFiltroInicio] = useState('2026-03-01');
  const [filtroFim, setFiltroFim] = useState('2026-03-31');

  useEffect(() => {
    void Promise.all([listTransactionsDemo(), listCardsDemo(), listDepartmentsDemo()]).then(([a, b, c]) => {
      setTx(a);
      setCards(b);
      setDept(c);
    });
  }, []);

  const gastoMes = useMemo(() => tx.reduce((s, t) => s + t.valor, 0), [tx]);
  const maiorCategoria = useMemo(() => {
    if (!dept.length) return '—';
    return [...dept].sort((a, b) => b.gastoMes - a.gastoMes)[0]?.nome ?? '—';
  }, [dept]);

  const filtradas = useMemo(() => {
    const a = new Date(filtroInicio);
    const b = new Date(filtroFim);
    return tx.filter((t) => {
      const d = new Date(t.data);
      return d >= a && d <= b;
    });
  }, [tx, filtroInicio, filtroFim]);

  return (
    <div className="space-y-6">
      <Link href="/manager-pro" className="text-xs text-[var(--amber)] hover:underline">
        ← Home
      </Link>
      <div>
        <h1 className="text-xl font-bold text-[var(--ink)]">Ramp</h1>
        <p className="mt-1 text-sm text-[var(--ink2)]">OAuth 2.0 · transações, cartões e departamentos.</p>
        <a
          href="/api/integrations/ramp/authorize"
          className="mt-2 inline-flex rounded-[12px] border border-[var(--border)] bg-[var(--paper)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--cream)]"
        >
          Conectar Ramp
        </a>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--cream)] p-4">
          <p className="text-[10px] font-semibold uppercase text-[var(--ink3)]">Gasto do mês (demo)</p>
          <p className="mt-1 text-2xl font-bold text-[var(--ink)]">{gastoMes.toFixed(2)} USD</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--cream)] p-4">
          <p className="text-[10px] font-semibold uppercase text-[var(--ink3)]">Cartões ativos</p>
          <p className="mt-1 text-2xl font-bold text-[var(--ink)]">{cards.filter((c) => c.ativo).length}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--cream)] p-4">
          <p className="text-[10px] font-semibold uppercase text-[var(--ink3)]">Maior categoria</p>
          <p className="mt-1 text-lg font-semibold text-[var(--ink)]">{maiorCategoria}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-[var(--ink2)]">
          De
          <input
            type="date"
            value={filtroInicio}
            onChange={(e) => setFiltroInicio(e.target.value)}
            className="ml-2 rounded border border-[var(--border)] px-2 py-1"
          />
        </label>
        <label className="text-xs font-medium text-[var(--ink2)]">
          Até
          <input
            type="date"
            value={filtroFim}
            onChange={(e) => setFiltroFim(e.target.value)}
            className="ml-2 rounded border border-[var(--border)] px-2 py-1"
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--paper)]">
            <tr>
              <th className="px-3 py-2 text-left">Data</th>
              <th className="px-3 py-2 text-left">Comerciante</th>
              <th className="px-3 py-2 text-right">Valor</th>
              <th className="px-3 py-2 text-left">Cartão</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((t) => (
              <tr key={t.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2">{t.data}</td>
                <td className="px-3 py-2">{t.comerciante}</td>
                <td className="px-3 py-2 text-right">{t.valor.toFixed(2)}</td>
                <td className="px-3 py-2">{t.cartaoId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
