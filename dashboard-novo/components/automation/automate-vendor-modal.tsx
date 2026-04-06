'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/language-context';
import { automateVendor } from '@/services/automation/automation.service';
import type { RecurrenceType } from '@/services/automation/automation.service';

interface AutomateVendorModalProps {
  open: boolean;
  onClose: () => void;
  onAutomated: () => void;
}

const RECURRENCE_OPTIONS: { value: RecurrenceType; labelKey: string }[] = [
  { value: 'weekly', labelKey: 'automation.recurrence.weekly' },
  { value: 'monthly', labelKey: 'automation.recurrence.monthly' },
];

export function AutomateVendorModal({ open, onClose, onAutomated }: AutomateVendorModalProps) {
  const { t } = useLanguage();
  const [vendorName, setVendorName] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('monthly');
  const [defaultAmount, setDefaultAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim()) return;
    setLoading(true);
    try {
      automateVendor({
        vendorId: vendorId.trim() || `vendor-${Date.now()}`,
        vendorName: vendorName.trim(),
        recurrence,
        defaultAmount: defaultAmount ? parseFloat(defaultAmount) : undefined,
      });
      onAutomated();
      onClose();
      setVendorName('');
      setVendorId('');
      setDefaultAmount('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('automation.automateVendor')} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('automation.vendorName')}
          value={vendorName}
          onChange={(e) => setVendorName(e.target.value)}
          placeholder="Vendor or supplier name"
          required
          disabled={loading}
        />
        <Input
          label="Vendor ID (optional)"
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
          placeholder="Internal ID"
          disabled={loading}
        />
        <div>
          <label className="mb-2 block text-sm font-medium text-secondary-700">
            {t('automation.recurrence')}
          </label>
          <select
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
            className="h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900"
            disabled={loading}
          >
            {RECURRENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.labelKey as 'automation.recurrence.weekly')}
              </option>
            ))}
          </select>
        </div>
        <Input
          label={t('automation.amount') + ' (optional)'}
          type="number"
          step="0.01"
          min="0"
          value={defaultAmount}
          onChange={(e) => setDefaultAmount(e.target.value)}
          disabled={loading}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            {t('common.close')}
          </Button>
          <Button type="submit" disabled={loading}>
            Automate
          </Button>
        </div>
      </form>
    </Modal>
  );
}
