'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { MonthEndCloseStatus } from '@/services/financial/financial-dashboard.service';
import { cn } from '@/lib/utils';

interface MonthCloseStatusProps {
  data: MonthEndCloseStatus;
}

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Não Iniciado',
  IN_PROGRESS: 'Em Andamento',
  PENDING_REVIEW: 'Pendente Revisão',
  COMPLETED: 'Concluído',
};

export function MonthCloseStatus({ data }: MonthCloseStatusProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Fechamento Contábil</CardTitle>
        <p className="text-sm text-secondary-500">Período: {data.period}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Progresso</span>
              <span className="font-medium">{data.progress}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-secondary-100">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  data.progress === 100 && 'bg-success-500',
                  data.progress >= 50 && data.progress < 100 && 'bg-primary-500',
                  data.progress < 50 && 'bg-accent-500'
                )}
                style={{ width: `${data.progress}%` }}
              />
            </div>
          </div>
          <p className="text-sm text-secondary-600">
            {data.tasksCompleted} de {data.tasksTotal} tarefas concluídas
          </p>
          <span
            className={cn(
              'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
              data.status === 'COMPLETED' && 'bg-success-100 text-success-700',
              data.status === 'IN_PROGRESS' && 'bg-primary-100 text-primary-700',
              data.status === 'PENDING_REVIEW' && 'bg-accent-100 text-accent-700',
              data.status === 'NOT_STARTED' && 'bg-secondary-100 text-secondary-700'
            )}
          >
            {STATUS_LABELS[data.status] ?? data.status}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
