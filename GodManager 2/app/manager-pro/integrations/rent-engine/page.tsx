'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  applyPriceDemo,
  getRecommendationsDemo,
  recommendationBadge,
  type RentRecommendation,
} from '@/lib/integrations/rent-engine';

function badgeClass(b: ReturnType<typeof recommendationBadge>): string {
  if (b === 'alinhado') return 'bg-[color-mix(in_srgb,var(--green)_18%,var(--paper))] text-[var(--green)]';
  if (b === 'abaixo') return 'bg-[color-mix(in_srgb,var(--amber)_22%,var(--paper))] text-[var(--amber)]';
  return 'bg-[color-mix(in_srgb,var(--red)_18%,var(--paper))] text-[var(--red)]';
}

function badgeLabel(b: ReturnType<typeof recommendationBadge>): string {
  if (b === 'alinhado') return 'Alinhado ao mercado';
  if (b === 'abaixo') return 'Abaixo do recomendado';
  return 'Acima do recomendado';
}

export default function RentEngineIntegrationPage() {
  const [rows, setRows] = useState<RentRecommendation[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void getRecommendationsDemo().then(setRows);
  }, []);

  const aplicar = async (r: RentRecommendation) => {
    setBusy(r.unidadeId);
    try {
      await applyPriceDemo(r.unidadeId, r.precoRecomendado);
      alert(`Preço aplicado para ${r.endereco} (demo).`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <Link href="/manager-pro" className="text-xs text-[var(--amber)] hover:underline">
        ← Home
      </Link>
      <div>
        <h1 className="text-xl font-bold text-[var(--ink)]">Rent Engine</h1>
        <p className="mt-1 text-sm text-[var(--ink2)]">Precificação dinâmica (RENT_ENGINE_API_KEY).</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--paper)]">
            <tr>
              <th className="px-3 py-2 text-left">Unidade</th>
              <th className="px-3 py-2 text-right">Preço atual</th>
              <th className="px-3 py-2 text-right">Recomendado</th>
              <th className="px-3 py-2 text-left">Badge</th>
              <th className="px-3 py-2 text-left" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const b = recommendationBadge(r);
              return (
                <tr key={r.unidadeId} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2">{r.endereco}</td>
                  <td className="px-3 py-2 text-right">{r.precoAtual.toFixed(0)}</td>
                  <td className="px-3 py-2 text-right">{r.precoRecomendado.toFixed(0)}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClass(b)}`}>
                      {badgeLabel(b)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={busy === r.unidadeId}
                      onClick={() => void aplicar(r)}
                      className="rounded-[12px] bg-[var(--champagne)] px-3 py-1 text-xs font-bold text-[var(--coal)] disabled:opacity-50"
                    >
                      {busy === r.unidadeId ? '…' : 'Aplicar recomendação'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
