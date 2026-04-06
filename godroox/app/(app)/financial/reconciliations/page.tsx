'use client';

import { useState } from 'react';
import { ModulePageShell } from '@/components/financial/module-page-shell';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const MOCK_RECONCILIATIONS = [
  { id: '1', account: 'Bank of America - Operating', period: '2025-03', bookBalance: 425000, bankBalance: 423500, status: 'IN_PROGRESS' },
  { id: '2', account: 'Chase - Payroll', period: '2025-03', bookBalance: 125000, bankBalance: 125000, status: 'COMPLETED' },
];

const MOCK_DIFFERENCES = [
  { description: 'Depósito em trânsito', amount: 2500, type: 'deposit' },
  { description: 'Taxa bancária não lançada', amount: -50, type: 'fee' },
];

export default function ReconciliationsPage() {
  const [showForm, setShowForm] = useState(false);

  return (
    <ModulePageShell
      title="Reconciliações (Bank Reconciliation)"
      description="Formulário • Importação de extratos • Diferenças • Evidências • Relatório"
    >
      <div className="space-y-6">
        <div className="flex justify-between">
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Fechar' : '+ Nova Reconciliação'}
          </Button>
          <Button variant="outline">Gerar Relatório</Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Formulário de Reconciliação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Conta Bancária" placeholder="Nome da conta" />
                <Input label="Período" type="month" />
                <Input label="Saldo Livro" type="number" placeholder="0.00" />
                <Input label="Saldo Extrato" type="number" placeholder="0.00" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Importar Extrato</label>
                <div className="flex items-center gap-4 rounded-lg border-2 border-dashed border-secondary-300 p-6">
                  <input type="file" accept=".csv,.xlsx,.ofx" className="text-sm" />
                  <span className="text-secondary-500">CSV, Excel ou OFX</span>
                </div>
              </div>
              <Button>Salvar Reconciliação</Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6">
          {MOCK_RECONCILIATIONS.map((rec) => (
            <Card key={rec.id}>
              <CardHeader>
                <CardTitle>{rec.account}</CardTitle>
                <p className="text-sm text-secondary-500">Período: {rec.period}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-secondary-500">Saldo Livro</p>
                    <p className="font-semibold">${rec.bookBalance.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-secondary-500">Saldo Extrato</p>
                    <p className="font-semibold">${rec.bankBalance.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-secondary-500">Diferença</p>
                    <p className="font-semibold">
                      ${(rec.bookBalance - rec.bankBalance).toLocaleString()}
                    </p>
                  </div>
                </div>
                {rec.status === 'IN_PROGRESS' && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Itens Pendentes</p>
                    <ul className="space-y-1 text-sm">
                      {MOCK_DIFFERENCES.map((d) => (
                        <li key={d.description} className="flex justify-between">
                          <span>{d.description}</span>
                          <span className={d.amount >= 0 ? 'text-success-600' : 'text-danger-600'}>
                            ${d.amount.toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">Anexar Evidência</Button>
                  <Button size="sm">Concluir</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </ModulePageShell>
  );
}
