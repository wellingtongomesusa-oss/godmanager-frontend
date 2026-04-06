'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { IcfrMaturityLevel } from '@/services/financial/financial-dashboard.service';
import { cn } from '@/lib/utils';

interface IcfrMaturityProps {
  levels: IcfrMaturityLevel[];
}

const MATURITY_LABELS = ['Initial', 'Repeatable', 'Defined', 'Managed', 'Optimizing'];

export function IcfrMaturity({ levels }: IcfrMaturityProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Maturidade ICFR (COSO 2013)</CardTitle>
        <p className="text-xs text-secondary-500">Modelo KPMG - 5 níveis</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {levels.map((l) => (
            <div key={l.component} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-secondary-700">{l.component}</span>
                <span
                  className={cn(
                    'text-xs font-medium rounded-full px-2 py-0.5',
                    l.status === 'mature' && 'bg-success-100 text-success-700',
                    l.status === 'developing' && 'bg-accent-100 text-accent-700',
                    l.status === 'initial' && 'bg-secondary-100 text-secondary-600'
                  )}
                >
                  {MATURITY_LABELS[l.level - 1]} ({l.level}/5)
                </span>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div
                    key={n}
                    className={cn(
                      'h-2 flex-1 rounded',
                      n <= l.level
                        ? l.status === 'mature'
                          ? 'bg-success-500'
                          : l.status === 'developing'
                          ? 'bg-accent-500'
                          : 'bg-secondary-400'
                        : 'bg-secondary-100'
                    )}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
