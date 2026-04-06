'use client';

import { ModulePageShell } from '@/components/financial/module-page-shell';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const REPORTS = [
  { name: 'GAAP Monthly Report', description: 'Balanço, DRE e Fluxo de Caixa consolidados' },
  { name: 'AP Aging', description: 'Envelhecimento de contas a pagar' },
  { name: 'AR Aging', description: 'Envelhecimento de contas a receber' },
  { name: 'Cash Flow', description: 'Fluxo de caixa detalhado' },
  { name: 'Fechamento Contábil', description: 'Status do month-end close' },
  { name: 'Journal Entries', description: 'Lançamentos por período' },
];

export default function ReportsPage() {
  return (
    <ModulePageShell
      title="Relatórios Financeiros"
      description="GAAP Monthly • AP/AR Aging • Cash Flow • Fechamento • Journal Entries"
    >
      <div className="space-y-6">
        <div className="flex gap-4">
          <Input type="month" placeholder="Período" className="w-40" />
          <Button>Gerar Todos</Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {REPORTS.map((r) => (
            <Card key={r.name} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-base">{r.name}</CardTitle>
                <p className="text-sm text-secondary-500">{r.description}</p>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">PDF</Button>
                  <Button size="sm" variant="outline">Excel</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </ModulePageShell>
  );
}
