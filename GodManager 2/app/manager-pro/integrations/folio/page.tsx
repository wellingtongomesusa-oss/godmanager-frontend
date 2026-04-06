'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getFolioDemo, listReservationsDemo, type FolioReservation } from '@/lib/integrations/folio';

export default function FolioIntegrationPage() {
  const [res, setRes] = useState<FolioReservation[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getFolioDemo>>>(null);

  useEffect(() => {
    void listReservationsDemo().then(setRes);
  }, []);

  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      return;
    }
    void getFolioDemo(detailId).then(setDetail);
  }, [detailId]);

  return (
    <div className="space-y-6">
      <Link href="/manager-pro" className="text-xs text-[var(--amber)] hover:underline">
        ← Home
      </Link>
      <div>
        <h1 className="text-xl font-bold text-[var(--ink)]">Folio</h1>
        <p className="mt-1 text-sm text-[var(--ink2)]">
          API Key (FOLIO_API_KEY). Reservas podem ser cruzadas com o módulo{' '}
          <Link href="/manager-pro/reservations" className="font-semibold text-[var(--amber)] hover:underline">
            Reservations
          </Link>
          .
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--paper)]">
            <tr>
              <th className="px-3 py-2 text-left">Unidade</th>
              <th className="px-3 py-2 text-left">Hóspede</th>
              <th className="px-3 py-2 text-left">Check-in</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left" />
            </tr>
          </thead>
          <tbody>
            {res.map((r) => (
              <tr key={r.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2">{r.unidade}</td>
                <td className="px-3 py-2">{r.hospede}</td>
                <td className="px-3 py-2">{r.checkIn}</td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="text-[var(--amber)] hover:underline"
                    onClick={() => setDetailId(r.id)}
                  >
                    Detalhe folio
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--cream)] p-4 text-sm">
          <p className="font-semibold text-[var(--ink)]">Folio {detail.id}</p>
          <p className="mt-2 text-[var(--ink2)]">Cobranças:</p>
          <ul className="list-inside list-disc">
            {detail.cobrancas.map((c) => (
              <li key={c.id}>
                {c.descricao}: {c.valor.toFixed(2)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
