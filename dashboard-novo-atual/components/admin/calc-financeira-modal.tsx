'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/language-context';
import { formatCurrency } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CalcFinanceiraModal({ open, onClose }: Props) {
  const { t } = useLanguage();
  const [valor, setValor] = useState('');
  const [taxa, setTaxa] = useState('');
  const [prazo, setPrazo] = useState('');
  const [resultado, setResultado] = useState<number | null>(null);

  const handleCalculate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = parseFloat(valor);
    const r = parseFloat(taxa) / 100;
    const n = parseInt(prazo, 10);
    if (Number.isNaN(v) || Number.isNaN(r) || Number.isNaN(n) || n < 1) return;
    setResultado(v * (1 + r * n));
  };

  const reset = () => {
    setResultado(null);
    setValor('');
    setTaxa('');
    setPrazo('');
  };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title={t('calc.title')} size="md">
      <form onSubmit={handleCalculate} className="space-y-4">
        <Input label={t('calc.valor')} name="valor" type="number" step="0.01" min="0" value={valor} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValor(e.target.value)} />
        <Input label={t('calc.taxa')} name="taxa" type="number" step="0.01" min="0" value={taxa} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTaxa(e.target.value)} />
        <Input label={t('calc.prazo')} name="prazo" type="number" min="1" value={prazo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrazo(e.target.value)} />
        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="submit">{t('calc.calcular')}</Button>
          <Button type="button" variant="outline" onClick={() => { reset(); onClose(); }}>{t('calc.fechar')}</Button>
        </div>
        {resultado != null && (
          <div className="mt-4 rounded-lg border border-secondary-200 bg-secondary-50 p-4">
            <p className="text-sm font-medium text-secondary-700">{t('calc.resultado')}</p>
            <p className="mt-1 text-xl font-bold text-primary-600">{formatCurrency(resultado, 'BRL')}</p>
          </div>
        )}
      </form>
    </Modal>
  );
}
