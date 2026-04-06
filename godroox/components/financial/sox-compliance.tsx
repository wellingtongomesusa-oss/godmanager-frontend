'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { SoxComplianceMetric } from '@/services/financial/financial-dashboard.service';
import { cn } from '@/lib/utils';

interface SoxComplianceProps {
  metrics: SoxComplianceMetric[];
}

export function SoxCompliance({ metrics }: SoxComplianceProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Conformidade SOX 404</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {metrics.map((m) => (
            <div key={m.metric} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-secondary-700">{m.metric}</span>
                <span
                  className={cn(
                    'font-medium',
                    m.status === 'compliant' && 'text-success-600',
                    m.status === 'partial' && 'text-accent-600',
                    m.status === 'non_compliant' && 'text-danger-600'
                  )}
                >
                  {typeof m.value === 'number' ? `${m.value}%` : m.value}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary-100">
                <div
                  className={cn(
                    'h-full rounded-full',
                    m.status === 'compliant' && 'bg-success-500',
                    m.status === 'partial' && 'bg-accent-500',
                    m.status === 'non_compliant' && 'bg-danger-500'
                  )}
                  style={{ width: `${Math.min((m.value / m.target) * 100, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
