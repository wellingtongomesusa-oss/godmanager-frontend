'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const LS_ORG = 'invoice_org_collaborators_v1';

type Row = { email: string; addedAt: string };

function loadRows(): Row[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_ORG);
    if (!raw) return [];
    return JSON.parse(raw) as Row[];
  } catch {
    return [];
  }
}

function saveRows(rows: Row[]) {
  localStorage.setItem(LS_ORG, JSON.stringify(rows));
}

export default function InvoiceCollaboratorsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [email, setEmail] = useState('');

  useEffect(() => {
    setRows(loadRows());
  }, []);

  const add = () => {
    const e = email.trim().toLowerCase();
    if (!e.includes('@')) return;
    if (rows.some((r) => r.email === e)) return;
    const next = [...rows, { email: e, addedAt: new Date().toISOString() }];
    saveRows(next);
    setRows(next);
    setEmail('');
  };

  const remove = (emailRm: string) => {
    const next = rows.filter((r) => r.email !== emailRm);
    saveRows(next);
    setRows(next);
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link href="/manager-pro/invoices" className="text-xs font-medium text-[var(--amber)] hover:underline">
        ← Voltar às faturas
      </Link>
      <div>
        <h1 className="text-xl font-bold text-[var(--ink)]">Colaboradores (organização)</h1>
        <p className="mt-2 text-sm text-[var(--ink2)]">
          Utilizador primário pode registar e-mails para convites. Integração real: substituir este armazenamento
          local por API. Para permissões por fatura, use &quot;Acesso&quot; no cartão de cada invoice.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-5">
        <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--ink3)]">
          Convidar por e-mail
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-w-[200px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--warm-white)] px-3 py-2 text-sm"
            placeholder="colaborador@empresa.com"
          />
          <button
            type="button"
            onClick={add}
            className="rounded-[12px] bg-[var(--champagne)] px-5 py-2 text-sm font-bold text-[var(--coal)] hover:opacity-95"
          >
            Adicionar
          </button>
        </div>
      </div>

      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.email}
            className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--cream)] px-4 py-3 text-sm"
          >
            <span className="font-medium text-[var(--ink)]">{r.email}</span>
            <button type="button" className="text-xs font-medium text-[var(--red)] hover:underline" onClick={() => remove(r.email)}>
              Remover
            </button>
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="text-sm text-[var(--ink3)]">Nenhum colaborador na lista da organização.</li>
        ) : null}
      </ul>
    </div>
  );
}
