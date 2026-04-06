'use client';

import { useState } from 'react';
import { ModulePageShell } from '@/components/financial/module-page-shell';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const MOCK_CUSTOMERS = [
  { id: '1', name: 'Global Tech LLC', invoices: 8, balance: 28500 },
  { id: '2', name: 'Retail Partners Inc', invoices: 5, balance: 15200 },
  { id: '3', name: 'Service Corp', invoices: 12, balance: 42100 },
];

const MOCK_AR_INVOICES = [
  { id: 'AR-001', customer: 'Global Tech LLC', amount: 8500, dueDate: '2025-03-10', status: 'OPEN' },
  { id: 'AR-002', customer: 'Retail Partners Inc', amount: 4200, dueDate: '2025-03-15', status: 'PARTIAL' },
  { id: 'AR-003', customer: 'Service Corp', amount: 12500, dueDate: '2025-03-20', status: 'OPEN' },
];

const AGING_AR = [
  { range: 'Current', amount: 185000, count: 52 },
  { range: '1-30 days', amount: 52000, count: 15 },
  { range: '31-60 days', amount: 22000, count: 6 },
  { range: '90+ days', amount: 5000, count: 2 },
];

export default function ARPage() {
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  return (
    <ModulePageShell
      title="AR – Contas a Receber"
      description="Recebimentos • Aging AR • Clientes • Aplicação de Pagamentos"
    >
      <div className="space-y-6">
        <div className="flex justify-between">
          <Button onClick={() => setShowPaymentForm(!showPaymentForm)}>
            {showPaymentForm ? 'Fechar' : '+ Registrar Recebimento'}
          </Button>
        </div>

        {showPaymentForm && (
          <Card>
            <CardHeader>
              <CardTitle>Formulário de Recebimento</CardTitle>
              <p className="text-sm text-secondary-500">Aplicação de pagamentos em faturas</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Cliente" placeholder="Nome do cliente" />
                <Input label="Valor (USD)" type="number" placeholder="0.00" />
                <Input label="Data do Pagamento" type="date" />
                <Input label="Método" placeholder="Transferência, Cheque, etc." />
                <Input label="Referência" placeholder="Nº do documento" className="sm:col-span-2" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Aplicar a Faturas</label>
                <div className="space-y-2 rounded-lg border p-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" />
                    <span>AR-001 - $8,500 (Global Tech LLC)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" />
                    <span>AR-002 - $4,200 (Retail Partners Inc)</span>
                  </label>
                </div>
              </div>
              <Button>Registrar Recebimento</Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Aging AR</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {AGING_AR.map((row) => (
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
              <CardTitle>Tabela de Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium">Cliente</th>
                      <th className="pb-2 font-medium">Faturas</th>
                      <th className="pb-2 font-medium">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_CUSTOMERS.map((c) => (
                      <tr key={c.id} className="border-b">
                        <td className="py-2">{c.name}</td>
                        <td className="py-2">{c.invoices}</td>
                        <td className="py-2 font-medium">${c.balance.toLocaleString()}</td>
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
            <CardTitle>Faturas em Aberto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Fatura</th>
                    <th className="pb-2 font-medium">Cliente</th>
                    <th className="pb-2 font-medium">Valor</th>
                    <th className="pb-2 font-medium">Vencimento</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_AR_INVOICES.map((inv) => (
                    <tr key={inv.id} className="border-b">
                      <td className="py-2">{inv.id}</td>
                      <td className="py-2">{inv.customer}</td>
                      <td className="py-2">${inv.amount.toLocaleString()}</td>
                      <td className="py-2">{inv.dueDate}</td>
                      <td className="py-2">
                        <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs">
                          {inv.status}
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
