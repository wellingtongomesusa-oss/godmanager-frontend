'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

const TITLES: Record<string, string> = {
  'long-term': 'GodManager Trust',
  divvy: 'Divvy (DIV)',
  stock: 'Stock (STK)',
  'month-log': 'Month Log (LOG)',
  licenses: 'Licenses (LIC)',
  contractors: 'Contractors (CON)',
  payroll: 'Payroll (PAY)',
  phone: 'Phone Lines (TEL)',
  dp: 'DP (use o módulo completo)',
  loans: 'Loans',
  cards: 'Cards',
  insurance: 'Insurance',
};

export default function ExtraCardPage() {
  const params = useParams();
  const slug = String(params.slug ?? '');
  const title = TITLES[slug] ?? slug;

  return (
    <div>
      <Link href="/manager-pro" className="text-xs text-[var(--amber)] hover:underline">
        ← Home
      </Link>
      <h1 className="mt-4 text-xl font-bold text-[var(--ink)]">{title}</h1>
      <p className="mt-2 max-w-xl text-sm text-[var(--ink2)]">
        Card adicional GodManager.One (módulo extra). Estado vazio: valor &quot;—&quot;, donut cinza, integração
        (CSV/API) pode ser ligada aqui.
      </p>
    </div>
  );
}
