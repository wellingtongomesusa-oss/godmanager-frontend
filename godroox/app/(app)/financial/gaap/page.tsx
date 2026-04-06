'use client';

import { useState } from 'react';
import { ModulePageShell } from '@/components/financial/module-page-shell';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const MOCK_BALANCE_SHEET = {
  assets: [
    { name: 'Caixa e Equivalentes', value: 1250000 },
    { name: 'Contas a Receber', value: 850000 },
    { name: 'Estoques', value: 420000 },
    { name: 'Ativos Fixos', value: 2100000 },
    { name: 'Outros Ativos', value: 180000 },
  ],
  liabilities: [
    { name: 'Contas a Pagar', value: 380000 },
    { name: 'Empréstimos CP', value: 250000 },
    { name: 'Empréstimos LP', value: 900000 },
    { name: 'Outros Passivos', value: 120000 },
  ],
  equity: [
    { name: 'Capital Social', value: 1500000 },
    { name: 'Lucros Acumulados', value: 890000 },
  ],
};

const MOCK_INCOME_STATEMENT = [
  { name: 'Receita Bruta', value: 3450000 },
  { name: '(-) Deduções', value: -125000 },
  { name: 'Receita Líquida', value: 3325000 },
  { name: '(-) CMV', value: -1850000 },
  { name: 'Lucro Bruto', value: 1475000 },
  { name: '(-) Despesas Operacionais', value: -720000 },
  { name: 'Lucro Operacional', value: 755000 },
  { name: '(-) Impostos', value: -185000 },
  { name: 'Lucro Líquido', value: 570000 },
];

const MOCK_CASH_FLOW = [
  { name: 'Atividades Operacionais', value: 412000 },
  { name: 'Atividades de Investimento', value: -185000 },
  { name: 'Atividades de Financiamento', value: -95000 },
  { name: 'Variação Líquida', value: 132000 },
];

export default function GAAPFinancialsPage() {
  const [period, setPeriod] = useState('2025-03');
  const [activeTab, setActiveTab] = useState<'balance' | 'income' | 'cashflow'>('balance');

  return (
    <ModulePageShell
      title="GAAP Financials"
      description="Balanço Patrimonial • DRE • Fluxo de Caixa • Notas Explicativas"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2">
            <Input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-40"
            />
            <Button variant="outline">Exportar PDF</Button>
          </div>
          <div className="flex rounded-lg border border-secondary-200 p-1">
            {(['balance', 'income', 'cashflow'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-md px-4 py-2 text-sm font-medium ${
                  activeTab === tab
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-secondary-600 hover:bg-secondary-100'
                }`}
              >
                {tab === 'balance' && 'Balanço'}
                {tab === 'income' && 'DRE'}
                {tab === 'cashflow' && 'Fluxo de Caixa'}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'balance' && (
          <Card>
            <CardHeader>
              <CardTitle>Balanço Patrimonial (Balance Sheet)</CardTitle>
              <p className="text-sm text-secondary-500">Período: {period} • GAAP</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-8 md:grid-cols-3">
                <div>
                  <h4 className="mb-4 font-semibold text-secondary-900">Ativos</h4>
                  <div className="space-y-2">
                    {MOCK_BALANCE_SHEET.assets.map((item) => (
                      <div key={item.name} className="flex justify-between text-sm">
                        <span>{item.name}</span>
                        <span className="font-medium">
                          ${item.value.toLocaleString()}
                        </span>
                      </div>
                    ))}
                    <div className="border-t pt-2 font-semibold">
                      Total Ativos: $
                      {MOCK_BALANCE_SHEET.assets.reduce((s, i) => s + i.value, 0).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="mb-4 font-semibold text-secondary-900">Passivos</h4>
                  <div className="space-y-2">
                    {MOCK_BALANCE_SHEET.liabilities.map((item) => (
                      <div key={item.name} className="flex justify-between text-sm">
                        <span>{item.name}</span>
                        <span className="font-medium">
                          ${item.value.toLocaleString()}
                        </span>
                      </div>
                    ))}
                    <div className="border-t pt-2 font-semibold">
                      Total Passivos: $
                      {MOCK_BALANCE_SHEET.liabilities.reduce((s, i) => s + i.value, 0).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="mb-4 font-semibold text-secondary-900">Patrimônio Líquido</h4>
                  <div className="space-y-2">
                    {MOCK_BALANCE_SHEET.equity.map((item) => (
                      <div key={item.name} className="flex justify-between text-sm">
                        <span>{item.name}</span>
                        <span className="font-medium">
                          ${item.value.toLocaleString()}
                        </span>
                      </div>
                    ))}
                    <div className="border-t pt-2 font-semibold">
                      Total PL: $
                      {MOCK_BALANCE_SHEET.equity.reduce((s, i) => s + i.value, 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'income' && (
          <Card>
            <CardHeader>
              <CardTitle>DRE (Income Statement)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-w-md space-y-2">
                {MOCK_INCOME_STATEMENT.map((item) => (
                  <div key={item.name} className="flex justify-between text-sm">
                    <span className={item.value < 0 ? 'pl-4' : ''}>{item.name}</span>
                    <span className={`font-medium ${item.value < 0 ? 'text-danger-600' : ''}`}>
                      ${Math.abs(item.value).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'cashflow' && (
          <Card>
            <CardHeader>
              <CardTitle>Fluxo de Caixa (Cash Flow)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-w-md space-y-2">
                {MOCK_CASH_FLOW.map((item) => (
                  <div key={item.name} className="flex justify-between text-sm">
                    <span>{item.name}</span>
                    <span className={`font-medium ${item.value < 0 ? 'text-danger-600' : 'text-success-600'}`}>
                      ${item.value.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Notas Explicativas</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              className="w-full rounded-lg border border-secondary-300 p-4 text-sm"
              rows={4}
              placeholder="Adicionar notas explicativas GAAP..."
            />
          </CardContent>
        </Card>
      </div>
    </ModulePageShell>
  );
}
