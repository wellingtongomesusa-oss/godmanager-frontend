'use client';

import { useState } from 'react';
import { ModulePageShell } from '@/components/financial/module-page-shell';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const MOCK_DEFICIENCIES = [
  { id: 'DEF-001', title: 'Documentação incompleta C-002', severity: 'SIGNIFICANT_DEFICIENCY', status: 'OPEN', dueDate: '2025-04-15' },
  { id: 'DEF-002', title: 'Atraso em reconciliação', severity: 'DEFICIENCY', status: 'REMEDIATED', dueDate: '2025-03-01' },
];

export default function DeficienciesPage() {
  const [showForm, setShowForm] = useState(false);

  return (
    <ModulePageShell
      title="Deficiências e Remediações"
      description="Registro • Classificação (D/SD/MW) • Plano de ação • Evidências • Aging"
    >
      <div className="space-y-6">
        <div className="flex justify-between">
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Fechar' : '+ Registrar Deficiência'}
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Registro de Deficiência</CardTitle>
              <p className="text-sm text-secondary-500">Classificação automática: Deficiency, SD, MW</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input label="Título" placeholder="Descrição da deficiência" />
              <div>
                <label className="mb-2 block text-sm font-medium">Descrição</label>
                <textarea className="w-full rounded-lg border border-secondary-300 p-4 text-sm" rows={3} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Severidade</label>
                <select className="w-full rounded-lg border border-secondary-300 px-4 py-2 text-sm">
                  <option>Deficiency</option>
                  <option>Significant Deficiency (SD)</option>
                  <option>Material Weakness (MW)</option>
                </select>
              </div>
              <Input label="Data Limite" type="date" />
              <div>
                <label className="mb-2 block text-sm font-medium">Plano de Ação</label>
                <textarea className="w-full rounded-lg border border-secondary-300 p-4 text-sm" rows={3} />
              </div>
              <Button>Registrar</Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Deficiências</CardTitle>
            <p className="text-sm text-secondary-500">Aging report • Fluxo de aprovação</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">ID</th>
                    <th className="pb-2 font-medium">Título</th>
                    <th className="pb-2 font-medium">Severidade</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Prazo</th>
                    <th className="pb-2 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_DEFICIENCIES.map((d) => (
                    <tr key={d.id} className="border-b">
                      <td className="py-2">{d.id}</td>
                      <td className="py-2">{d.title}</td>
                      <td className="py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            d.severity === 'MATERIAL_WEAKNESS' && 'bg-danger-100 text-danger-700'
                          } ${d.severity === 'SIGNIFICANT_DEFICIENCY' && 'bg-accent-100 text-accent-700'} ${
                            d.severity === 'DEFICIENCY' && 'bg-secondary-100 text-secondary-600'
                          }`}
                        >
                          {d.severity.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2">{d.status}</td>
                      <td className="py-2">{d.dueDate}</td>
                      <td className="py-2">
                        <Button size="sm" variant="outline">Remediar</Button>
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
