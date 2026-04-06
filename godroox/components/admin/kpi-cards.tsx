'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { DashboardKpiItem } from '@/services/admin/admin-dashboard.service';

const colorScopeStyles: Record<string, string> = {
  blue: 'text-blue-600',
  orange: 'text-primary-600',
  gray: 'text-secondary-700',
  yellow: 'text-accent-600',
  green: 'text-success-600',
};

export function KpiCards({ items }: { items: DashboardKpiItem[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((item) => {
        const up = item.changePercent >= 0;
        return (
          <Card key={item.label} className="border-secondary-200 bg-white">
            <CardContent className="p-5">
              <p className="text-sm font-medium text-secondary-500">{item.label}</p>
              <p
                className={cn(
                  'mt-1 text-2xl font-bold tabular-nums sm:text-3xl',
                  colorScopeStyles[item.colorScope] ?? 'text-secondary-800'
                )}
              >
                {typeof item.value === 'number' ? item.value.toLocaleString('pt-BR') : item.value}
              </p>
              <p className="mt-2 flex items-center gap-1 text-xs text-secondary-500">
                <span className={up ? 'text-success-600' : 'text-danger-600'}>
                  {up ? '↑' : '↓'} {Math.abs(item.changePercent).toFixed(2).replace('.', ',')}%
                </span>
                <span className="text-secondary-400">Nos últimos 30 dias</span>
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
