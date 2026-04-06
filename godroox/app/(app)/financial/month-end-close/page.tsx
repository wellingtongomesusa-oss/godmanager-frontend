'use client';

import { useState } from 'react';
import { ModulePageShell } from '@/components/financial/module-page-shell';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const TASKS_BY_AREA = [
  { id: '1', area: 'AP', task: 'Reconciliar contas a pagar', responsible: 'Maria S.', status: 'COMPLETED', dueDate: '2025-03-05' },
  { id: '2', area: 'AR', task: 'Reconciliar contas a receber', responsible: 'João P.', status: 'COMPLETED', dueDate: '2025-03-05' },
  { id: '3', area: 'GL', task: 'Revisar lançamentos de ajuste', responsible: 'Ana L.', status: 'IN_PROGRESS', dueDate: '2025-03-08' },
  { id: '4', area: 'Bank', task: 'Reconciliação bancária', responsible: 'Carlos M.', status: 'PENDING', dueDate: '2025-03-10' },
  { id: '5', area: 'Tax', task: 'Provisionamento de impostos', responsible: 'Pedro R.', status: 'PENDING', dueDate: '2025-03-12' },
];

const TIMELINE = [
  { date: '2025-03-01', event: 'Início do fechamento' },
  { date: '2025-03-05', event: 'AP/AR reconciliados' },
  { date: '2025-03-08', event: 'Journal entries em revisão' },
  { date: '2025-03-10', event: 'Prazo reconciliação bancária' },
];

export default function MonthEndClosePage() {
  const [period, setPeriod] = useState('2025-03');

  return (
    <ModulePageShell
      title="Fechamento Contábil (Month-End Close)"
      description="Checklist • Tarefas por área • Status • Evidências • Linha do tempo"
    >
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-40"
          />
          <span className="rounded-full bg-primary-100 px-3 py-1 text-sm font-medium text-primary-700">
            72% Concluído
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Checklist de Fechamento</CardTitle>
              <p className="text-sm text-secondary-500">Tarefas por área e responsável</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {TASKS_BY_AREA.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{t.task}</p>
                      <p className="text-xs text-secondary-500">
                        {t.area} • {t.responsible} • {t.dueDate}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        t.status === 'COMPLETED' && 'bg-success-100 text-success-700'
                      } ${t.status === 'IN_PROGRESS' && 'bg-primary-100 text-primary-700'} ${
                        t.status === 'PENDING' && 'bg-secondary-100 text-secondary-600'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Linha do Tempo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {TIMELINE.map((item, i) => (
                  <div key={item.date} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="h-3 w-3 rounded-full bg-primary-500" />
                      {i < TIMELINE.length - 1 && (
                        <div className="mt-1 h-full w-0.5 bg-secondary-200" />
                      )}
                    </div>
                    <div className="pb-4">
                      <p className="font-medium text-secondary-900">{item.date}</p>
                      <p className="text-sm text-secondary-600">{item.event}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Evidências Anexadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 rounded-lg border-2 border-dashed border-secondary-300 p-6">
              <Button variant="outline">+ Anexar Evidência</Button>
              <span className="text-sm text-secondary-500">
                Documentos de suporte ao fechamento
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </ModulePageShell>
  );
}
