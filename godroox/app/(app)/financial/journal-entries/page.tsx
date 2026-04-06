'use client';

import { useState } from 'react';
import { ModulePageShell } from '@/components/financial/module-page-shell';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const MOCK_ENTRIES = [
  { id: 'JE-001', date: '2025-03-05', description: 'Ajuste depreciação', total: 12500, status: 'APPROVED' },
  { id: 'JE-002', date: '2025-03-06', description: 'Provisionamento impostos', total: 18500, status: 'PENDING_APPROVAL' },
  { id: 'JE-003', date: '2025-03-07', description: 'Ajuste accrual receita', total: 8200, status: 'DRAFT' },
];

const MOCK_LINES = [
  { account: '1200 - Depreciação Acumulada', debit: 0, credit: 12500 },
  { account: '5100 - Despesa Depreciação', debit: 12500, credit: 0 },
];

export default function JournalEntriesPage() {
  const [showForm, setShowForm] = useState(false);

  return (
    <ModulePageShell
      title="Lançamentos Contábeis (Journal Entries)"
      description="Formulário GAAP • Validações • Anexos • Fluxo de Aprovação • Exportação Auditoria"
    >
      <div className="space-y-6">
        <div className="flex justify-between">
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Fechar' : '+ Novo Lançamento'}
          </Button>
          <Button variant="outline">Exportar para Auditoria</Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Novo Lançamento Contábil (GAAP)</CardTitle>
              <p className="text-sm text-secondary-500">Débito = Crédito (validação automática)</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Data" type="date" />
                <Input label="Período (YYYY-MM)" placeholder="2025-03" />
                <Input label="Descrição" className="sm:col-span-2" placeholder="Descrição do lançamento" />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Linhas do Lançamento</p>
                <div className="space-y-2 rounded-lg border p-4">
                  {MOCK_LINES.map((line, i) => (
                    <div key={i} className="flex gap-4">
                      <Input placeholder="Conta" className="flex-1" defaultValue={line.account} />
                      <Input type="number" placeholder="Débito" className="w-28" defaultValue={line.debit || ''} />
                      <Input type="number" placeholder="Crédito" className="w-28" defaultValue={line.credit || ''} />
                    </div>
                  ))}
                  <Button variant="outline" size="sm">+ Adicionar Linha</Button>
                </div>
                <p className="mt-2 text-sm text-success-600">✓ Total Débito: $12,500 = Total Crédito: $12,500</p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Anexos de Evidência</label>
                <div className="rounded-lg border-2 border-dashed border-secondary-300 p-4">
                  <input type="file" className="text-sm" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button>Enviar para Aprovação</Button>
                <Button variant="outline">Salvar Rascunho</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Lançamentos</CardTitle>
            <p className="text-sm text-secondary-500">Fluxo de aprovação dual</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Nº</th>
                    <th className="pb-2 font-medium">Data</th>
                    <th className="pb-2 font-medium">Descrição</th>
                    <th className="pb-2 font-medium">Total</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_ENTRIES.map((e) => (
                    <tr key={e.id} className="border-b">
                      <td className="py-2">{e.id}</td>
                      <td className="py-2">{e.date}</td>
                      <td className="py-2">{e.description}</td>
                      <td className="py-2">${e.total.toLocaleString()}</td>
                      <td className="py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            e.status === 'APPROVED' && 'bg-success-100 text-success-700'
                          } ${e.status === 'PENDING_APPROVAL' && 'bg-accent-100 text-accent-700'} ${
                            e.status === 'DRAFT' && 'bg-secondary-100 text-secondary-600'
                          }`}
                        >
                          {e.status}
                        </span>
                      </td>
                      <td className="py-2">
                        <Button size="sm" variant="outline">Aprovar</Button>
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
