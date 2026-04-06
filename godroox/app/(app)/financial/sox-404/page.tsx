'use client';

import { ModulePageShell } from '@/components/financial/module-page-shell';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const IPO_MILESTONES = [
  { milestone: 'SEC S-1 Draft', status: 'IN_PROGRESS', dueDate: '2025-04-15' },
  { milestone: 'Audited Financials', status: 'COMPLETED', dueDate: '2025-03-01' },
  { milestone: 'ICFR Assessment', status: 'IN_PROGRESS', dueDate: '2025-04-01' },
  { milestone: 'Management Certifications', status: 'PENDING', dueDate: '2025-05-01' },
];

export default function SOX404Page() {
  return (
    <ModulePageShell
      title="SOX 404 Compliance & IPO Readiness"
      description="Conformidade • Linha do tempo IPO (SEC S-1) • Controles • Deficiências"
    >
      <div className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-secondary-500">% Conformidade</p>
              <p className="text-3xl font-bold text-success-600">94%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-secondary-500">Controles Implementados</p>
              <p className="text-3xl font-bold">47/50</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-secondary-500">Controles Pendentes</p>
              <p className="text-3xl font-bold text-accent-600">3</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-secondary-500">Deficiências Abertas</p>
              <p className="text-3xl font-bold text-danger-600">2</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Linha do Tempo IPO (SEC S-1)</CardTitle>
            <p className="text-sm text-secondary-500">Marcos para oferta pública</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {IPO_MILESTONES.map((m) => (
                <div
                  key={m.milestone}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <span className="font-medium">{m.milestone}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-secondary-500">{m.dueDate}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        m.status === 'COMPLETED' && 'bg-success-100 text-success-700'
                      } ${m.status === 'IN_PROGRESS' && 'bg-primary-100 text-primary-700'} ${
                        m.status === 'PENDING' && 'bg-secondary-100 text-secondary-600'
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deficiências por Severidade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-danger-200 bg-danger-50/50 p-4">
                <p className="text-sm font-medium text-danger-700">Material Weakness</p>
                <p className="text-2xl font-bold">0</p>
              </div>
              <div className="rounded-lg border border-accent-200 bg-accent-50/50 p-4">
                <p className="text-sm font-medium text-accent-700">Significant Deficiency</p>
                <p className="text-2xl font-bold">1</p>
              </div>
              <div className="rounded-lg border border-secondary-200 bg-secondary-50/50 p-4">
                <p className="text-sm font-medium text-secondary-700">Deficiency</p>
                <p className="text-2xl font-bold">1</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ModulePageShell>
  );
}
