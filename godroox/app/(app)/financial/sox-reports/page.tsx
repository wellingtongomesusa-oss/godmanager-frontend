'use client';

import { ModulePageShell } from '@/components/financial/module-page-shell';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const REPORTS = [
  { name: 'SOX 404 Management Assessment', description: 'Avaliação de controles pela gestão' },
  { name: 'ICFR Maturity Report (KPMG)', description: 'Maturidade dos controles por componente COSO' },
  { name: 'Deficiency Report', description: 'Deficiências por severidade e status' },
  { name: 'IPO Readiness Report (SEC S-1)', description: 'Checklist de preparação para SEC S-1' },
];

export default function SOXReportsPage() {
  return (
    <ModulePageShell
      title="Relatórios SOX / ICFR / IPO"
      description="Management Assessment • ICFR Maturity • Deficiency • IPO Readiness"
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {REPORTS.map((r) => (
            <Card key={r.name} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-base">{r.name}</CardTitle>
                <p className="text-sm text-secondary-500">{r.description}</p>
              </CardHeader>
              <CardContent>
                <Button size="sm" variant="outline">Exportar PDF</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </ModulePageShell>
  );
}
