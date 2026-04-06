'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { InvoiceCard } from '@/components/manager-pro/InvoiceCard';
import { canUserViewInvoice } from '@/lib/manager-pro/invoicePermissionsStore';
import { listInvoices } from '@/lib/manager-pro/invoiceStore';

export default function InvoicesPage() {
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const visible = useMemo(() => {
    void version;
    return listInvoices().filter((inv) => canUserViewInvoice(inv.id));
  }, [version]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--ink)]">Faturas (Invoice)</h1>
          <p className="mt-1 text-sm text-[var(--ink2)]">
            Visual alinhado à landing — GodManager Trust. Permissões: utilizador primário e colaboradores.
          </p>
        </div>
        <Link
          href="/manager-pro/invoices/collaborators"
          className="rounded-[12px] border border-[var(--border)] bg-[var(--cream)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--paper)]"
        >
          Colaboradores
        </Link>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--cream)] p-8 text-center text-sm text-[var(--ink3)]">
          Nenhuma fatura visível para o seu utilizador. Peça acesso ao utilizador primário.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((inv) => (
            <InvoiceCard key={inv.id} inv={inv} onChanged={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
