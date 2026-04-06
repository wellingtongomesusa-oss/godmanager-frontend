'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/language-context';
import { schedulePayment } from '@/services/automation/automation.service';
import type { RecurrenceType } from '@/services/automation/automation.service';

interface SchedulePaymentAutomationModalProps {
  open: boolean;
  onClose: () => void;
  onScheduled: () => void;
}

const RECURRENCE_OPTIONS: { value: RecurrenceType; labelKey: string }[] = [
  { value: 'once', labelKey: 'automation.recurrence.once' },
  { value: 'weekly', labelKey: 'automation.recurrence.weekly' },
  { value: 'monthly', labelKey: 'automation.recurrence.monthly' },
];

export function SchedulePaymentAutomationModal({
  open,
  onClose,
  onScheduled,
}: SchedulePaymentAutomationModalProps) {
  const { t } = useLanguage();
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recurrence, setRecurrence] = useState<RecurrenceType>('once');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!vendor.trim() || isNaN(amt) || amt <= 0 || !date) return;
    setLoading(true);
    try {
      schedulePayment({
        vendor: vendor.trim(),
        amount: amt,
        currency: 'USD',
        scheduledDate: date,
        recurrence,
        reference: reference.trim() || undefined,
      });
      onScheduled();
      onClose();
      setVendor('');
      setAmount('');
      setReference('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('automation.schedulePayment')} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('automation.vendor')}
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          placeholder="Vendor name"
          required
          disabled={loading}
        />
        <Input
          label={t('automation.amount')}
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          disabled={loading}
        />
        <Input
          label={t('automation.date')}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
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
                {t(o.labelKey as 'automation.recurrence.once')}
              </option>
            ))}
          </select>
        </div>
        <Input
          label={t('payments.reference')}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          disabled={loading}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            {t('common.close')}
          </Button>
          <Button type="submit" disabled={loading}>
            Schedule
          </Button>
        </div>
      </form>
    </Modal>
  );
}
