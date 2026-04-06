'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface AdminMetrics {
  contasCadastradas: number;
  transacoesTotais: number;
  transacoesConcluidas: number;
  transacoesPendentes: number;
  transacoesCanceladas: number;
}

const cards: { key: keyof AdminMetrics; label: string; accent?: string }[] = [
  { key: 'contasCadastradas', label: 'Contas cadastradas', accent: 'secondary' },
  { key: 'transacoesTotais', label: 'Transações totais', accent: 'primary' },
  { key: 'transacoesConcluidas', label: 'Transações concluídas', accent: 'success' },
  { key: 'transacoesPendentes', label: 'Transações pendentes', accent: 'accent' },
  { key: 'transacoesCanceladas', label: 'Transações canceladas', accent: 'danger' },
];

const accentStyles: Record<string, string> = {
  primary: 'text-primary-500',
  success: 'text-emerald-600',
  accent: 'text-amber-600',
  danger: 'text-rose-600',
  secondary: 'text-secondary-600',
};

export function MetricCards({ metrics }: { metrics: AdminMetrics }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map(({ key, label, accent = 'secondary' }) => (
        <Card key={key} className="border-gray-200 bg-white shadow-lg">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-secondary-600">{label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold tabular-nums sm:text-3xl', accentStyles[accent])}>
              {metrics[key]}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
