'use client';

import { useState } from 'react';
import type { InvoiceRecord } from '@/lib/manager-pro/invoiceTypes';
import { deleteInvoice, updateInvoiceStatus } from '@/lib/manager-pro/invoiceStore';
import { useInvoicePermissions } from '@/hooks/useInvoicePermissions';
import { InvoiceAccessModal } from './InvoiceAccessModal';

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' }).format(n);
}

const statusLabel: Record<InvoiceRecord['status'], string> = {
  rascunho: 'Rascunho',
  enviada: 'Enviada',
  paga: 'Paga',
  cancelada: 'Cancelada',
};

export function InvoiceCard({ inv, onChanged }: { inv: InvoiceRecord; onChanged: () => void }) {
  const perm = useInvoicePermissions(inv.id);
  const [open, setOpen] = useState(false);

  const onDelete = () => {
    if (!perm.canDelete) return;
    if (confirm('Excluir esta fatura?')) {
      deleteInvoice(inv.id);
      onChanged();
    }
  };

  const cycleStatus = () => {
    if (!perm.canEdit) return;
    const order: InvoiceRecord['status'][] = ['rascunho', 'enviada', 'paga', 'cancelada'];
    const i = order.indexOf(inv.status);
    const next = order[(i + 1) % order.length];
    updateInvoiceStatus(inv.id, next);
    onChanged();
  };

  return (
    <>
      <article
        className="relative flex flex-col overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--border)_80%,var(--coal))] bg-[var(--warm-white)] shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
        style={{ fontFamily: 'var(--font-dm-sans-inv), system-ui, sans-serif' }}
      >
        <div
          className="h-[3px] w-full bg-gradient-to-r from-[var(--champagne)] via-[color-mix(in_srgb,var(--champagne)_70%,white)] to-[var(--coal)]"
          aria-hidden
        />
        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink3)]">
                Fatura {inv.numero}
              </p>
              <p className="mt-1 text-lg font-semibold text-[var(--ink)]">{inv.cliente}</p>
            </div>
            {perm.canInvite ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded-xl border border-[var(--border)] bg-[var(--paper)] px-3 py-1.5 text-[11px] font-semibold text-[var(--ink2)] hover:bg-[var(--cream)]"
                title="Gerenciar acesso"
              >
                Acesso
              </button>
            ) : null}
          </div>

          <dl className="mt-4 space-y-2 text-sm text-[var(--ink2)]">
            <div className="flex justify-between gap-2">
              <dt>Vencimento</dt>
              <dd className="font-medium text-[var(--ink)]">{inv.vencimento}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Status</dt>
              <dd>
                <button
                  type="button"
                  disabled={!perm.canEdit}
                  onClick={cycleStatus}
                  className="rounded-lg border border-[var(--border)] bg-[var(--cream)] px-2 py-0.5 text-xs font-semibold disabled:opacity-50"
                >
                  {statusLabel[inv.status]}
                </button>
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-1 flex-col justify-end">
            <div className="flex items-center justify-between rounded-xl bg-[var(--coal)] px-4 py-3 text-[var(--warm-white)]">
              <span className="text-xs font-medium uppercase tracking-wider text-[color-mix(in_srgb,white_70%,var(--coal))]">
                Total
              </span>
              <span
                className="text-2xl font-semibold"
                style={{ fontFamily: 'var(--font-cormorant-inv), Georgia, serif' }}
              >
                {fmtMoney(inv.valor)}
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {perm.canDelete ? (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-[12px] border border-[color-mix(in_srgb,var(--red)_45%,transparent)] bg-[color-mix(in_srgb,var(--red)_10%,var(--paper))] px-4 py-2 text-xs font-semibold text-[var(--red)] hover:bg-[color-mix(in_srgb,var(--red)_16%,var(--paper))]"
              >
                Excluir
              </button>
            ) : null}
            {perm.canSend && inv.status === 'rascunho' ? (
              <button
                type="button"
                onClick={() => {
                  updateInvoiceStatus(inv.id, 'enviada');
                  onChanged();
                }}
                className="rounded-[12px] bg-[var(--champagne)] px-4 py-2 text-xs font-bold text-[var(--coal)] hover:opacity-95"
              >
                Enviar fatura
              </button>
            ) : null}
          </div>
        </div>
      </article>

      {open ? (
        <InvoiceAccessModal invoiceId={inv.id} numero={inv.numero} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
