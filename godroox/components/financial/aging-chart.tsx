'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { AgingBucket } from '@/services/financial/financial-dashboard.service';
import { cn } from '@/lib/utils';

interface AgingChartProps {
  title: string;
  data: AgingBucket[];
  totalLabel?: string;
}

export function AgingChart({ title, data, totalLabel }: AgingChartProps) {
  const total = data.reduce((sum, b) => sum + b.amount, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {totalLabel && (
          <p className="text-sm text-secondary-500">
            Total: {totalLabel} ${total.toLocaleString()}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((bucket, i) => (
            <div key={bucket.range} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-secondary-700">{bucket.range}</span>
                <span className="text-secondary-600">
                  ${bucket.amount.toLocaleString()} ({bucket.count} items)
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary-100">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    i === 0 && 'bg-success-500',
                    i === 1 && 'bg-primary-400',
                    i === 2 && 'bg-accent-500',
                    i === 3 && 'bg-danger-400',
                    i >= 4 && 'bg-danger-600'
                  )}
                  style={{ width: `${bucket.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
