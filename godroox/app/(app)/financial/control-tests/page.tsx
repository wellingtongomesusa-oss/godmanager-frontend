'use client';

import { useState } from 'react';
import { ModulePageShell } from '@/components/financial/module-page-shell';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const TEST_TYPES = ['TOD (Test of Design)', 'TOE (Test of Effectiveness)', 'Walkthrough'];

const MOCK_TESTS = [
  { id: '1', control: 'C-001', type: 'TOE', date: '2025-02-15', result: 'PASS', tester: 'Auditor Interno' },
  { id: '2', control: 'C-002', type: 'TOD', date: '2025-02-20', result: 'PASS', tester: 'Auditor Externo' },
  { id: '3', control: 'C-003', type: 'Walkthrough', date: '2025-03-01', result: 'PENDING', tester: '-' },
];

export default function ControlTestsPage() {
  const [showForm, setShowForm] = useState(false);

  return (
    <ModulePageShell
      title="Testes de Controles (TOD, TOE, Walkthrough)"
      description="Checklist • Evidências • Notas auditor • Resultado • Audit Trail"
    >
      <div className="space-y-6">
        <div className="flex justify-between">
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Fechar' : '+ Novo Teste'}
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Registro de Teste de Controle</CardTitle>
              <p className="text-sm text-secondary-500">Registro automático no Audit Trail</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">Controle</label>
                  <select className="w-full rounded-lg border border-secondary-300 px-4 py-2 text-sm">
                    <option>C-001 - Revisão contratos</option>
                    <option>C-002 - Dual approval AP</option>
                    <option>C-003 - Reconciliação bancária</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Tipo de Teste</label>
                  <select className="w-full rounded-lg border border-secondary-300 px-4 py-2 text-sm">
                    {TEST_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <Input label="Data do Teste" type="date" />
                <div>
                  <label className="mb-2 block text-sm font-medium">Resultado</label>
                  <select className="w-full rounded-lg border border-secondary-300 px-4 py-2 text-sm">
                    <option>PASS</option>
                    <option>FAIL</option>
                    <option>N/A</option>
                  </select>
                </div>
                <Input label="Tamanho da Amostra" type="number" />
                <Input label="Exceções" type="number" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Notas (Auditor Interno/Externo)</label>
                <textarea className="w-full rounded-lg border border-secondary-300 p-4 text-sm" rows={3} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Upload de Evidências</label>
                <div className="rounded-lg border-2 border-dashed border-secondary-300 p-4">
                  <input type="file" className="text-sm" />
                </div>
              </div>
              <Button>Registrar Teste</Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Histórico de Testes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Controle</th>
                    <th className="pb-2 font-medium">Tipo</th>
                    <th className="pb-2 font-medium">Data</th>
                    <th className="pb-2 font-medium">Resultado</th>
                    <th className="pb-2 font-medium">Testador</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_TESTS.map((t) => (
                    <tr key={t.id} className="border-b">
                      <td className="py-2">{t.control}</td>
                      <td className="py-2">{t.type}</td>
                      <td className="py-2">{t.date}</td>
                      <td className="py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            t.result === 'PASS' && 'bg-success-100 text-success-700'
                          } ${t.result === 'FAIL' && 'bg-danger-100 text-danger-700'} ${
                            t.result === 'PENDING' && 'bg-secondary-100 text-secondary-600'
                          }`}
                        >
                          {t.result}
                        </span>
                      </td>
                      <td className="py-2">{t.tester}</td>
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
