'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { DashboardKpi } from '@/services/financial/financial-dashboard.service';
import { cn } from '@/lib/utils';

interface DashboardKpiCardsProps {
  kpis: DashboardKpi[];
}

export function DashboardKpiCards({ kpis }: DashboardKpiCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {kpis.map((kpi) => (
        <Card key={kpi.label} variant="elevated" className="overflow-hidden">
          <CardContent className="p-5">
            <p className="text-sm font-medium text-secondary-500">{kpi.label}</p>
            <p className="mt-1 text-2xl font-bold text-secondary-900">{kpi.value}</p>
            {kpi.changePercent !== undefined && (
              <div className="mt-2 flex items-center gap-1">
                <span
                  className={cn(
                    'text-sm font-medium',
                    kpi.trend === 'up' && 'text-success-600',
                    kpi.trend === 'down' && 'text-danger-600',
                    kpi.trend === 'neutral' && 'text-secondary-500'
                  )}
                >
                  {kpi.trend === 'up' && '↑'}
                  {kpi.trend === 'down' && '↓'}
                  {kpi.trend === 'neutral' && '→'}
                  {Math.abs(kpi.changePercent)}% vs prior period
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
