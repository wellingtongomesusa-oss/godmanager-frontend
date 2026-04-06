'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { listAccountsDemo, queryTransactionsDemo } from '@/lib/integrations/quickbooks';

export default function QuickBooksIntegrationPage() {
  const [status] = useState<'desconectado' | 'conectado' | 'erro'>('desconectado');
  const [rows, setRows] = useState<Awaited<ReturnType<typeof queryTransactionsDemo>>>([]);
  const [accounts, setAccounts] = useState<Awaited<ReturnType<typeof listAccountsDemo>>>([]);

  useEffect(() => {
    void (async () => {
      const companyId = 'demo-company';
      setRows(await queryTransactionsDemo(companyId));
      setAccounts(await listAccountsDemo(companyId));
    })();
  }, []);

  return (
    <div className="space-y-6">
      <Link href="/manager-pro" className="text-xs text-[var(--amber)] hover:underline">
        ← Home
      </Link>
      <div>
        <h1 className="text-xl font-bold text-[var(--ink)]">QuickBooks Online</h1>
        <p className="mt-1 text-sm text-[var(--ink2)]">
          OAuth 2.0 · query, invoices e contas. Dados abaixo são demonstração até conectar API real.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--cream)] p-4">
        <p className="text-sm font-semibold text-[var(--ink)]">
          Estado da conexão: <span className="text-[var(--ink2)]">{status}</span>
        </p>
        <a
          href="/api/integrations/quickbooks/authorize"
          className="mt-3 inline-flex rounded-[12px] bg-[var(--champagne)] px-4 py-2 text-sm font-bold text-[var(--coal)] hover:opacity-95"
        >
          Conectar QuickBooks
        </a>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--ink3)]">
          Query (demo) — transações / invoices
        </h2>
        <div className="mt-2 overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--paper)]">
              <tr>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-left">Data</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2">{r.id}</td>
                  <td className="px-3 py-2">{r.tipo}</td>
                  <td className="px-3 py-2 text-right">{r.total.toFixed(2)}</td>
                  <td className="px-3 py-2">{r.data}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--ink3)]">Contas (demo)</h2>
        <ul className="mt-2 space-y-1 text-sm text-[var(--ink2)]">
          {accounts.map((a) => (
            <li key={a.id}>
              {a.nome} — {a.tipo}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
