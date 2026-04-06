'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/language-context';
import { addProjeto, type AddAndamentoInput } from '@/services/admin/andamento.service';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddAndamentoModal({ open, onClose, onSuccess }: Props) {
  const { t } = useLanguage();
  const [valorEntrada, setValorEntrada] = useState('');
  const [valorParcela, setValorParcela] = useState('');
  const [numParcelas, setNumParcelas] = useState('1');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const ve = parseFloat(valorEntrada);
    const vp = parseFloat(valorParcela);
    const np = Math.max(1, parseInt(numParcelas, 10) || 1);
    if (Number.isNaN(ve) || Number.isNaN(vp) || ve < 0 || vp < 0) return;
    setLoading(true);
    try {
      addProjeto({ valorEntrada: ve, valorParcela: vp, numParcelas: np });
      onSuccess();
      setValorEntrada('');
      setValorParcela('');
      setNumParcelas('1');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('andamento.add')} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('andamento.valorEntrada')}
          name="valorEntrada"
          type="number"
          step="0.01"
          min="0"
          value={valorEntrada}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValorEntrada(e.target.value)}
          required
          disabled={loading}
        />
        <Input
          label={t('andamento.valorParcela')}
          name="valorParcela"
          type="number"
          step="0.01"
          min="0"
          value={valorParcela}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValorParcela(e.target.value)}
          required
          disabled={loading}
        />
        <Input
          label={t('andamento.numParcelas')}
          name="numParcelas"
          type="number"
          min="1"
          value={numParcelas}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNumParcelas(e.target.value)}
          disabled={loading}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            {t('common.close')}
          </Button>
          <Button type="submit" disabled={loading}>
            {t('add.enviar')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
