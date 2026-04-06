'use client';

import { useEffect, useState } from 'react';
import {
  listPermissionsForInvoice,
  removePermission,
  setPermission,
  type InvoicePermissionRole,
} from '@/lib/manager-pro/invoicePermissionsStore';

const ROLES: { id: InvoicePermissionRole; label: string }[] = [
  { id: 'viewer', label: 'Somente leitura' },
  { id: 'editor', label: 'Editar' },
  { id: 'sender', label: 'Enviar' },
  { id: 'approver', label: 'Aprovar' },
];

export function InvoiceAccessModal({
  invoiceId,
  numero,
  onClose,
}: {
  invoiceId: string;
  numero: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState(() => listPermissionsForInvoice(invoiceId));
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvoicePermissionRole>('viewer');

  useEffect(() => {
    setRows(listPermissionsForInvoice(invoiceId));
  }, [invoiceId]);

  const refresh = () => setRows(listPermissionsForInvoice(invoiceId));

  const add = () => {
    const e = email.trim().toLowerCase();
    if (!e.includes('@')) return;
    const userId = e;
    setPermission({ invoiceId, userId, email: e, role });
    setEmail('');
    refresh();
  };

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inv-access-title"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-6 shadow-xl">
        <h2 id="inv-access-title" className="text-lg font-bold text-[var(--ink)]">
          Gerenciar acesso · {numero}
        </h2>
        <p className="mt-1 text-xs text-[var(--ink3)]">
          Colaboradores convidados por e-mail. Dados em localStorage (demo) — substituível por base de dados.
        </p>

        <ul className="mt-4 space-y-2">
          {rows.map((r) => (
            <li
              key={r.userId}
              className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--cream)] px-3 py-2 text-sm"
            >
              <span className="truncate text-[var(--ink)]">{r.email}</span>
              <span className="shrink-0 text-xs font-medium text-[var(--ink2)]">{r.role}</span>
              <button
                type="button"
                className="text-xs font-medium text-[var(--red)] hover:underline"
                onClick={() => {
                  removePermission(invoiceId, r.userId);
                  refresh();
                }}
              >
                Remover
              </button>
            </li>
          ))}
          {rows.length === 0 ? (
            <li className="text-sm text-[var(--ink3)]">Nenhum colaborador nesta fatura.</li>
          ) : null}
        </ul>

        <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-4">
          <label className="block text-xs font-semibold text-[var(--ink2)]">Convidar por e-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--warm-white)] px-3 py-2 text-sm"
            placeholder="nome@empresa.com"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as InvoicePermissionRole)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--warm-white)] px-3 py-2 text-sm"
          >
            {ROLES.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={add}
            className="w-full rounded-[12px] bg-[var(--champagne)] py-2.5 text-sm font-bold text-[var(--coal)] hover:opacity-95"
          >
            Adicionar colaborador
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl border border-[var(--border)] py-2 text-sm font-semibold text-[var(--ink2)] hover:bg-[var(--cream)]"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
