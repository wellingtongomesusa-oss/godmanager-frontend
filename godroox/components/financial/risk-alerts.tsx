'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Alert {
  id: string;
  severity: string;
  message: string;
  date: string;
}

interface RiskAlertsProps {
  alerts: Alert[];
}

export function RiskAlerts({ alerts }: RiskAlertsProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Alertas de Risco</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-3',
                alert.severity === 'high' && 'border-danger-200 bg-danger-50/50',
                alert.severity === 'medium' && 'border-accent-200 bg-accent-50/50',
                alert.severity === 'low' && 'border-secondary-200 bg-secondary-50/50'
              )}
            >
              <span
                className={cn(
                  'mt-0.5 h-2 w-2 shrink-0 rounded-full',
                  alert.severity === 'high' && 'bg-danger-500',
                  alert.severity === 'medium' && 'bg-accent-500',
                  alert.severity === 'low' && 'bg-secondary-100'
                )}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-secondary-900">{alert.message}</p>
                <p className="text-xs text-secondary-500 mt-0.5">{alert.date}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
