'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/language-context';
import { formatCurrency } from '@/lib/utils';

interface EvolucaoItem {
  mes: number;
  valor: number;
  juros: number;
}

export default function JurosCompostosPage() {
  const { t } = useLanguage();
  const [valorInicial, setValorInicial] = useState('');
  const [taxa, setTaxa] = useState('');
  const [prazo, setPrazo] = useState('');
  const [valorFinal, setValorFinal] = useState<number | null>(null);
  const [evolucao, setEvolucao] = useState<EvolucaoItem[]>([]);

  const handleCalculate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const C = parseFloat(valorInicial);
    const i = parseFloat(taxa) / 100;
    const n = parseInt(prazo, 10);
    if (Number.isNaN(C) || Number.isNaN(i) || Number.isNaN(n) || n < 1) return;
    const M = C * Math.pow(1 + i, n);
    setValorFinal(M);
    const ev: EvolucaoItem[] = [];
    let prev = C;
    for (let mes = 1; mes <= n; mes++) {
      const valor = C * Math.pow(1 + i, mes);
      const juros = valor - prev;
      ev.push({ mes, valor, juros });
      prev = valor;
    }
    setEvolucao(ev);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">{t('juros.title')}</h1>
        <p className="mt-1 text-secondary-600">Calcule o valor final e a evolução mensal com juros compostos.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('juros.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleCalculate} className="grid gap-4 sm:grid-cols-3">
            <Input label={t('juros.valorInicial')} name="valorInicial" type="number" step="0.01" min="0" value={valorInicial} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValorInicial(e.target.value)} />
            <Input label={t('juros.taxa')} name="taxa" type="number" step="0.01" min="0" value={taxa} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTaxa(e.target.value)} />
            <Input label={t('juros.prazo')} name="prazo" type="number" min="1" value={prazo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrazo(e.target.value)} />
            <div className="sm:col-span-3">
              <Button type="submit">{t('juros.calcular')}</Button>
            </div>
          </form>
          {valorFinal != null && (
            <div className="mt-6 rounded-lg border border-primary-200 bg-primary-50 p-4">
              <p className="text-sm font-medium text-secondary-700">{t('juros.valorFinal')}</p>
              <p className="mt-1 text-2xl font-bold text-primary-600">{formatCurrency(valorFinal, 'BRL')}</p>
            </div>
          )}
          {evolucao.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-semibold text-secondary-800">{t('juros.evolucao')}</h3>
              <div className="overflow-x-auto rounded-lg border border-secondary-200">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-secondary-200 bg-secondary-50">
                      <th className="px-4 py-3 font-semibold text-secondary-900">Mês</th>
                      <th className="px-4 py-3 font-semibold text-secondary-900">Valor</th>
                      <th className="px-4 py-3 font-semibold text-secondary-900">Juros no período</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evolucao.map((e) => (
                      <tr key={e.mes} className="border-b border-secondary-100">
                        <td className="px-4 py-3 text-secondary-700">{e.mes}</td>
                        <td className="px-4 py-3 text-secondary-700">{formatCurrency(e.valor, 'BRL')}</td>
                        <td className="px-4 py-3 text-secondary-700">{formatCurrency(e.juros, 'BRL')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
