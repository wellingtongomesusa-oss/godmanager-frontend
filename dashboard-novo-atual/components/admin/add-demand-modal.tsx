'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/language-context';
import { addTransaction, type TipoDemanda } from '@/services/admin/admin-dashboard.service';

const ADD_TIPOS: TipoDemanda[] = ['gpainel', 'gopen', 'gpay', 'gpro', 'gmail', 'glife'];

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddDemandModal({ open, onClose, onSuccess }: Props) {
  const { t } = useLanguage();
  const [data, setData] = useState('');
  const [quemPediu, setQuemPediu] = useState('');
  const [descricaoProblema, setDescricaoProblema] = useState('');
  const [tipo, setTipo] = useState<TipoDemanda>('gpainel');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const dataVal = data || new Date().toISOString().slice(0, 10);
    const quem = quemPediu.trim();
    if (!quem) return;
    setLoading(true);
    try {
      addTransaction({ tipoDemanda: tipo, data: dataVal, quemPediu: quem, descricaoProblema: descricaoProblema.trim() || undefined });
      onSuccess();
      setData('');
      setQuemPediu('');
      setDescricaoProblema('');
      setTipo('gpainel');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('add.title')} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-secondary-700">{t('add.tipo')}</label>
          <select value={tipo} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTipo(e.target.value as TipoDemanda)} required className="flex h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500">
            {ADD_TIPOS.map((opt) => (
              <option key={opt} value={opt}>{t(`demand.${opt}` as import('@/lib/i18n/translations').TranslationKey)}</option>
            ))}
          </select>
        </div>
        <div>
          <Input label={t('add.data')} name="data" type="date" value={data} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setData(e.target.value)} disabled={loading} />
        </div>
        <div>
          <Input label={t('add.quemPediu')} name="quemPediu" type="text" placeholder={t('add.placeholderQuem')} value={quemPediu} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuemPediu(e.target.value)} required disabled={loading} />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-secondary-700">{t('add.descricaoProblema')}</label>
          <textarea
            name="descricaoProblema"
            placeholder={t('add.placeholderDescricao')}
            value={descricaoProblema}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescricaoProblema(e.target.value)}
            disabled={loading}
            rows={3}
            className="flex w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 resize-y"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>{t('common.close')}</Button>
          <Button type="submit" disabled={loading}>{t('add.enviar')}</Button>
        </div>
      </form>
    </Modal>
  );
}
