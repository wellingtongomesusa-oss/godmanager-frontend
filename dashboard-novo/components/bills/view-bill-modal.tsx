'use client';

import React from 'react';
import { Modal } from '@/components/ui/modal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/language-context';
import { formatCurrency } from '@/lib/utils';
import type { Bill } from '@/services/bills/bills-approval.service';
import type { AuditLogEntry } from '@/services/logs.service';
import { getLogsByEntity } from '@/services/logs.service';

interface ViewBillModalProps {
  open: boolean;
  onClose: () => void;
  bill: Bill | null;
  logs: AuditLogEntry[];
}

const STATUS_ACTION_MAP: Record<string, string> = {
  'bill.created': 'Created',
  'bill.reviewed': 'Reviewed',
  'bill.approved_l1': 'Approved (L1)',
  'bill.approved_l2': 'Approved (L2)',
  'bill.rejected': 'Rejected',
  'bill.scheduled': 'Scheduled',
  'bill.paid': 'Paid',
  'bill.viewed': 'Viewed',
  'bill.ocr_processed': 'OCR processed',
  'bill.webhook_received': 'Webhook received',
};

export function ViewBillModal({ open, onClose, bill, logs }: ViewBillModalProps) {
  const { t } = useLanguage();

  if (!bill) return null;

  return (
    <Modal open={open} onClose={onClose} title={t('bills.view.title')} size="lg">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase text-secondary-500">{t('bills.number')}</p>
            <p className="text-sm font-medium text-secondary-900">{bill.number}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-secondary-500">{t('bills.vendor')}</p>
            <p className="text-sm font-medium text-secondary-900">{bill.vendor}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-secondary-500">{t('bills.amount')}</p>
            <p className="text-sm font-medium text-secondary-900">
              {formatCurrency(bill.amount, bill.currency)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-secondary-500">{t('bills.dueDate')}</p>
            <p className="text-sm font-medium text-secondary-900">{bill.dueDate}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-secondary-500">{t('bills.status')}</p>
            <p className="text-sm font-medium text-secondary-900">{bill.status}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-medium uppercase text-secondary-500">
              {t('bills.view.description')}
            </p>
            <p className="text-sm text-secondary-700">{bill.description}</p>
          </div>
          {bill.approvedBy1 && (
            <div>
              <p className="text-xs font-medium uppercase text-secondary-500">
                {t('bills.view.approvedBy1')}
              </p>
              <p className="text-sm text-secondary-700">
                {bill.approvedBy1} {bill.approvedAt1 && `(${bill.approvedAt1.slice(0, 10)})`}
              </p>
            </div>
          )}
          {bill.approvedBy2 && (
            <div>
              <p className="text-xs font-medium uppercase text-secondary-500">
                {t('bills.view.approvedBy2')}
              </p>
              <p className="text-sm text-secondary-700">
                {bill.approvedBy2} {bill.approvedAt2 && `(${bill.approvedAt2.slice(0, 10)})`}
              </p>
            </div>
          )}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('bills.view.auditLog')}</CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-secondary-500">No audit entries yet.</p>
            ) : (
              <ul className="space-y-2 max-h-48 overflow-y-auto">
                {logs.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-baseline gap-2 text-xs text-secondary-600 border-b border-secondary-100 pb-2 last:border-0"
                  >
                    <span className="font-medium text-secondary-800">
                      {STATUS_ACTION_MAP[entry.action] ?? entry.action}
                    </span>
                    <span>{entry.userEmail}</span>
                    <span>{entry.timestamp.slice(0, 19).replace('T', ' ')}</span>
                    {entry.ip && entry.ip !== '0.0.0.0' && <span>IP: {entry.ip}</span>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </Modal>
  );
}

export function getBillLogs(billId: string): AuditLogEntry[] {
  return getLogsByEntity('bill', billId);
}
