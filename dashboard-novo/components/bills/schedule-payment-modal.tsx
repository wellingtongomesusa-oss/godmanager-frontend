'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/language-context';
import type { Bill } from '@/services/bills/bills-approval.service';
import { setBillScheduled } from '@/services/bills/bills-approval.service';

interface SchedulePaymentModalProps {
  open: boolean;
  onClose: () => void;
  bill: Bill | null;
  onScheduled: () => void;
}

export function SchedulePaymentModal({
  open,
  onClose,
  bill,
  onScheduled,
}: SchedulePaymentModalProps) {
  const { t } = useLanguage();
  const [date, setDate] = useState(() =>
    bill?.dueDate ? bill.dueDate : new Date().toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState(false);

  if (!bill) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      setBillScheduled(bill.id, date);
      onScheduled();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('bills.schedule.title')} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-secondary-600">
          {bill.number} – {bill.vendor} – {bill.currency} {bill.amount.toFixed(2)}
        </p>
        <Input
          label={t('bills.schedule.date')}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={loading}
          required
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            {t('common.close')}
          </Button>
          <Button type="submit" disabled={loading}>
            {t('bills.schedule.confirm')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
