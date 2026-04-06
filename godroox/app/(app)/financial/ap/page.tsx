'use client';

import { useState } from 'react';
import { ModulePageShell } from '@/components/financial/module-page-shell';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const MOCK_VENDORS = [
  { id: '1', name: 'Acme Corp', invoices: 12, total: 45000 },
  { id: '2', name: 'Tech Supplies Inc', invoices: 8, total: 28000 },
  { id: '3', name: 'Office Solutions', invoices: 5, total: 15000 },
];

const MOCK_INVOICES = [
  { id: 'INV-001', vendor: 'Acme Corp', amount: 5200, dueDate: '2025-03-15', status: 'APPROVAL_2' },
  { id: 'INV-002', vendor: 'Tech Supplies Inc', amount: 3200, dueDate: '2025-03-20', status: 'PENDING' },
  { id: 'INV-003', vendor: 'Office Solutions', amount: 1800, dueDate: '2025-03-25', status: 'APPROVED' },
  { id: 'INV-004', vendor: 'Acme Corp', amount: 4500, dueDate: '2025-04-01', status: 'APPROVAL_1' },
];

const AGING_AP = [
  { range: 'Current', amount: 125000, count: 45 },
  { range: '1-30 days', amount: 45000, count: 12 },
  { range: '31-60 days', amount: 18000, count: 5 },
  { range: '90+ days', amount: 4000, count: 2 },
];

export default function APPage() {
  const [showForm, setShowForm] = useState(false);

  return (
    <ModulePageShell
      title="AP – Contas a Pagar"
      description="Aprovação de pagamentos • Aging AP • Fornecedores • Dual Authorization"
    >
      <div className="space-y-6">
        <div className="flex justify-between">
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Fechar Formulário' : '+ Nova Nota Fiscal'}
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Formulário de Aprovação de Pagamento</CardTitle>
              <p className="text-sm text-secondary-500">Dual Authorization • Upload OCR</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Fornecedor" placeholder="Nome do fornecedor" />
                <Input label="Nº da Nota" placeholder="Número da nota fiscal" />
                <Input label="Valor (USD)" type="number" placeholder="0.00" />
                <Input label="Vencimento" type="date" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Upload de Nota/Recibo (OCR)</label>
                <div className="flex items-center gap-4 rounded-lg border-2 border-dashed border-secondary-300 p-6">
                  <input type="file" accept="image/*,.pdf" className="text-sm" />
                  <span className="text-secondary-500">Arraste ou clique para enviar</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button>Enviar para Aprovação</Button>
                <Button variant="outline">Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Aging AP</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {AGING_AP.map((row) => (
                  <div key={row.range} className="flex justify-between text-sm">
                    <span>{row.range}</span>
                    <span className="font-medium">
                      ${row.amount.toLocaleString()} ({row.count})
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tabela de Fornecedores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium">Fornecedor</th>
                      <th className="pb-2 font-medium">Notas</th>
                      <th className="pb-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_VENDORS.map((v) => (
                      <tr key={v.id} className="border-b">
                        <td className="py-2">{v.name}</td>
                        <td className="py-2">{v.invoices}</td>
                        <td className="py-2 font-medium">${v.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Notas Pendentes de Aprovação</CardTitle>
            <p className="text-sm text-secondary-500">Workflow Dual Authorization</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Nota</th>
                    <th className="pb-2 font-medium">Fornecedor</th>
                    <th className="pb-2 font-medium">Valor</th>
                    <th className="pb-2 font-medium">Vencimento</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_INVOICES.map((inv) => (
                    <tr key={inv.id} className="border-b">
                      <td className="py-2">{inv.id}</td>
                      <td className="py-2">{inv.vendor}</td>
                      <td className="py-2">${inv.amount.toLocaleString()}</td>
                      <td className="py-2">{inv.dueDate}</td>
                      <td className="py-2">
                        <span className="rounded-full bg-accent-100 px-2 py-0.5 text-xs">
                          {inv.status}
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
