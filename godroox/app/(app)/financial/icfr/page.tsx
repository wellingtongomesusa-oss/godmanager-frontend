'use client';

import { ModulePageShell } from '@/components/financial/module-page-shell';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const COSO_COMPONENTS = [
  'Control Environment',
  'Risk Assessment',
  'Control Activities',
  'Information & Communication',
  'Monitoring Activities',
];

const MOCK_CONTROLS = [
  { id: 'C-001', component: 'Control Environment', cycle: 'Revenue', risk: 'Receita não reconhecida corretamente', control: 'Revisão mensal de contratos', owner: 'Maria S.', status: 'ACTIVE' },
  { id: 'C-002', component: 'Control Activities', cycle: 'Expenditure', risk: 'Pagamentos não autorizados', control: 'Dual approval AP > $5K', owner: 'João P.', status: 'ACTIVE' },
  { id: 'C-003', component: 'Risk Assessment', cycle: 'Treasury', risk: 'Fraude em reconciliação', control: 'Reconciliação bancária mensal', owner: 'Ana L.', status: 'ACTIVE' },
];

export default function ICFRPage() {
  return (
    <ModulePageShell
      title="ICFR Controls (COSO 2013)"
      description="Matriz COSO • Objetivos • Componentes • Ciclos • Riscos • Controles • Evidências"
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Componentes COSO 2013</CardTitle>
            <p className="text-sm text-secondary-500">Framework de controles internos</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {COSO_COMPONENTS.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-primary-100 px-3 py-1 text-sm font-medium text-primary-700"
                >
                  {c}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Matriz de Controles</CardTitle>
            <p className="text-sm text-secondary-500">Controles chave por ciclo financeiro</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">ID</th>
                    <th className="pb-2 font-medium">Componente</th>
                    <th className="pb-2 font-medium">Ciclo</th>
                    <th className="pb-2 font-medium">Risco</th>
                    <th className="pb-2 font-medium">Controle</th>
                    <th className="pb-2 font-medium">Responsável</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_CONTROLS.map((c) => (
                    <tr key={c.id} className="border-b">
                      <td className="py-2">{c.id}</td>
                      <td className="py-2">{c.component}</td>
                      <td className="py-2">{c.cycle}</td>
                      <td className="py-2 max-w-xs truncate">{c.risk}</td>
                      <td className="py-2">{c.control}</td>
                      <td className="py-2">{c.owner}</td>
                      <td className="py-2">
                        <span className="rounded-full bg-success-100 px-2 py-0.5 text-xs text-success-700">
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </ModulePageShell>
  );
}
