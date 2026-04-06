'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/language-context';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddDepartmentModal({ open, onClose, onSuccess }: Props) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Nome é obrigatório.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/departamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, description: description.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Erro ao criar departamento.');
        return;
      }
      setName('');
      setDescription('');
      onSuccess();
      onClose();
    } catch {
      setError('Erro ao conectar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('dept.title')} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('dept.name')}
          name="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={loading}
          placeholder="Ex.: Vendas, Financeiro"
        />
        <div>
          <label className="mb-2 block text-sm font-medium text-secondary-700">{t('dept.description')}</label>
          <textarea
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
            rows={2}
            className="flex w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            {t('common.close')}
          </Button>
          <Button type="submit" disabled={loading}>
            {t('dept.add')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
