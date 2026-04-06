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
  { key: 'transacoesPendentes', label: 'Transações pendentes', accent: 'warning' },
  { key: 'transacoesCanceladas', label: 'Transações canceladas', accent: 'danger' },
];

const accentStyles: Record<string, string> = {
  primary: 'text-primary-600',
  success: 'text-success-600',
  warning: 'text-warning-600',
  danger: 'text-danger-600',
  secondary: 'text-brex-black',
};

export function MetricCards({ metrics }: { metrics: AdminMetrics }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map(({ key, label, accent = 'secondary' }) => (
        <Card key={key} className="overflow-hidden">
          <CardHeader className="pb-1 pt-5">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-secondary-500">{label}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className={cn('text-2xl font-semibold tabular-nums sm:text-3xl', accentStyles[accent])}>
              {metrics[key]}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
