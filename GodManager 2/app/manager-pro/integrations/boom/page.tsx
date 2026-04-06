'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getPaymentDemo, listPaymentsDemo, listPayoutsDemo, type BoomPayment } from '@/lib/integrations/boom';
import { getInvoice, updateInvoiceStatus } from '@/lib/manager-pro/invoiceStore';

export default function BoomIntegrationPage() {
  const [payments, setPayments] = useState<BoomPayment[]>([]);
  const [payouts, setPayouts] = useState<Awaited<ReturnType<typeof listPayoutsDemo>>>([]);

  useEffect(() => {
    void Promise.all([listPaymentsDemo(), listPayoutsDemo()]).then(([p, po]) => {
      setPayments(p);
      setPayouts(po);
    });
  }, []);

  const confirmarDemo = (id: string) => {
    void getPaymentDemo(id).then((p) => {
      if (!p) return;
      if (p.status !== 'processado') {
        alert('Em produção: POST Boom confirma pagamento; aqui simulamos sucesso.');
      }
      const inv = getInvoice('inv-001');
      if (inv && inv.status !== 'paga') {
        updateInvoiceStatus('inv-001', 'paga');
        alert('Status da fatura inv-001 atualizado para Paga (demo).');
      }
    });
  };

  const porStatus = (s: BoomPayment['status']) => payments.filter((p) => p.status === s);

  return (
    <div className="space-y-6">
      <Link href="/manager-pro" className="text-xs text-[var(--amber)] hover:underline">
        ← Home
      </Link>
      <div>
        <h1 className="text-xl font-bold text-[var(--ink)]">Boom</h1>
        <p className="mt-1 text-sm text-[var(--ink2)]">
          Pagamentos e repasses (BOOM_API_KEY / BOOM_API_SECRET). Ao confirmar, a demo tenta marcar a fatura inv-001 como
          paga.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--cream)] p-3 text-sm">
          <p className="font-semibold text-[var(--ink)]">Pendentes</p>
          <p className="text-2xl font-bold">{porStatus('pendente').length}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--cream)] p-3 text-sm">
          <p className="font-semibold text-[var(--ink)]">Processados</p>
          <p className="text-2xl font-bold">{porStatus('processado').length}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--cream)] p-3 text-sm">
          <p className="font-semibold text-[var(--ink)]">Falhados</p>
          <p className="text-2xl font-bold">{porStatus('falhou').length}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--paper)]">
            <tr>
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">Unidade</th>
              <th className="px-3 py-2 text-right">Valor</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left" />
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2">{p.id}</td>
                <td className="px-3 py-2">{p.unidade}</td>
                <td className="px-3 py-2 text-right">{p.valor.toFixed(2)}</td>
                <td className="px-3 py-2">{p.status}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => confirmarDemo(p.id)}
                    className="rounded-[12px] bg-[var(--champagne)] px-2 py-1 text-xs font-bold text-[var(--coal)]"
                  >
                    Confirmar (demo)
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-[var(--ink3)]">Repasses (demo)</h2>
        <ul className="mt-2 text-sm text-[var(--ink2)]">
          {payouts.map((p) => (
            <li key={p.id}>
              {p.periodo}: {p.total.toFixed(2)} USD
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
