'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/language-context';
import { formatCurrency, cn } from '@/lib/utils';
import {
  getBills,
  getBillById,
  sortBills,
  seedBills,
  setBillReviewed,
  setBillApprovedL1,
  setBillApprovedL2,
  setBillRejected,
  type Bill,
  type BillFilters,
  type BillStatus,
  type BillSortField,
  type BillSortOrder,
} from '@/services/bills/bills-approval.service';
import { getLogsByEntity } from '@/services/logs.service';
import { logAudit } from '@/services/logs.service';
import { ViewBillModal } from './view-bill-modal';
import { SchedulePaymentModal } from './schedule-payment-modal';

const PER_PAGE = 10;
const STATUS_OPTIONS: { value: BillStatus | ''; labelKey: string }[] = [
  { value: '', labelKey: 'bills.filters.status' },
  { value: 'pending', labelKey: 'bills.status.pending' },
  { value: 'reviewed', labelKey: 'bills.status.reviewed' },
  { value: 'approved_l1', labelKey: 'bills.status.approved_l1' },
  { value: 'approved_l2', labelKey: 'bills.status.approved_l2' },
  { value: 'scheduled', labelKey: 'bills.status.scheduled' },
  { value: 'paid', labelKey: 'bills.status.paid' },
  { value: 'rejected', labelKey: 'bills.status.rejected' },
];

export function BillsApprovalTable() {
  const { t } = useLanguage();
  const [filters, setFilters] = useState<BillFilters>({});
  const [sortField, setSortField] = useState<BillSortField>('dueDate');
  const [sortOrder, setSortOrder] = useState<BillSortOrder>('asc');
  const [page, setPage] = useState(1);
  const [viewBillId, setViewBillId] = useState<string | null>(null);
  const [scheduleBillId, setScheduleBillId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    seedBills();
  }, []);

  const filtered = useMemo(() => getBills(filters), [filters, refreshKey]);
  const sorted = useMemo(
    () => sortBills(filtered, sortField, sortOrder),
    [filtered, sortField, sortOrder]
  );
  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const paginated = useMemo(
    () => sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [sorted, page]
  );

  const viewBill = viewBillId ? getBillById(viewBillId) : null;
  const viewLogs = viewBillId ? getLogsByEntity('bill', viewBillId) : [];
  const scheduleBill = scheduleBillId ? getBillById(scheduleBillId) : null;

  const handleFilter = useCallback((key: keyof BillFilters, value: string | undefined) => {
    setFilters((f) => ({ ...f, [key]: value || undefined }));
    setPage(1);
  }, []);

  const handleSort = useCallback((field: BillSortField) => {
    setSortField(field);
    setSortOrder((o) => (sortField === field && o === 'asc' ? 'desc' : 'asc'));
  }, [sortField]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const openView = useCallback((bill: Bill) => {
    logAudit({
      action: 'bill.viewed',
      entityType: 'bill',
      entityId: bill.id,
      userId: 'admin',
      userEmail: 'admin@dashboard.local',
    });
    setViewBillId(bill.id);
  }, []);

  const handleApproveL1 = useCallback(
    (b: Bill) => {
      setBillApprovedL1(b.id);
      if (b.status === 'pending') setBillReviewed(b.id);
      refresh();
    },
    [refresh]
  );
  const handleApproveL2 = useCallback(
    (b: Bill) => {
      setBillApprovedL2(b.id);
      refresh();
    },
    [refresh]
  );
  const handleReview = useCallback(
    (b: Bill) => {
      setBillReviewed(b.id);
      refresh();
    },
    [refresh]
  );
  const handleReject = useCallback(
    (b: Bill) => {
      setBillRejected(b.id);
      refresh();
    },
    [refresh]
  );
  const handleScheduled = useCallback(() => {
    refresh();
  }, [refresh]);

  const statusLabel = (s: BillStatus) => t(`bills.status.${s}` as 'bills.status.pending');

  const canReview = (b: Bill) => b.status === 'pending';
  const canApproveL1 = (b: Bill) => b.status === 'reviewed';
  const canApproveL2 = (b: Bill) => b.status === 'approved_l1';
  const canSchedule = (b: Bill) => b.status === 'approved_l2';
  const canReject = (b: Bill) =>
    ['pending', 'reviewed', 'approved_l1'].includes(b.status);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">{t('bills.approval')}</CardTitle>
          <p className="text-sm text-secondary-600">{t('bills.approvalDesc')}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="min-w-[140px]">
              <label className="mb-1 block text-xs font-medium text-secondary-600">
                {t('bills.filters.status')}
              </label>
              <select
                value={filters.status ?? ''}
                onChange={(e) => handleFilter('status', e.target.value || undefined)}
                className="h-10 w-full rounded-lg border border-secondary-300 bg-white px-3 py-2 text-sm text-secondary-900"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(o.labelKey as 'bills.filters.status')}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label={t('bills.filters.vendor')}
              value={filters.vendor ?? ''}
              onChange={(e) => handleFilter('vendor', e.target.value)}
              className="max-w-[180px]"
              placeholder="Vendor"
            />
            <Input
              label={t('bills.filters.dateFrom')}
              type="date"
              value={filters.dateFrom ?? ''}
              onChange={(e) => handleFilter('dateFrom', e.target.value)}
              className="max-w-[160px]"
            />
            <Input
              label={t('bills.filters.dateTo')}
              type="date"
              value={filters.dateTo ?? ''}
              onChange={(e) => handleFilter('dateTo', e.target.value)}
              className="max-w-[160px]"
            />
            <Input
              label={t('bills.search')}
              value={filters.search ?? ''}
              onChange={(e) => handleFilter('search', e.target.value)}
              placeholder="Number, vendor..."
              className="max-w-[200px]"
            />
          </div>

          <div className="overflow-x-auto rounded-lg border border-secondary-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-secondary-200 bg-secondary-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-secondary-800">
                    {t('bills.number')}
                  </th>
                  <th className="px-4 py-3 font-semibold text-secondary-800">
                    <button
                      type="button"
                      onClick={() => handleSort('vendor')}
                      className="hover:text-primary-600"
                    >
                      {t('bills.vendor')} {sortField === 'vendor' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-semibold text-secondary-800">
                    <button
                      type="button"
                      onClick={() => handleSort('amount')}
                      className="hover:text-primary-600"
                    >
                      {t('bills.amount')} {sortField === 'amount' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-semibold text-secondary-800">
                    <button
                      type="button"
                      onClick={() => handleSort('dueDate')}
                      className="hover:text-primary-600"
                    >
                      {t('bills.dueDate')} {sortField === 'dueDate' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-semibold text-secondary-800">
                    <button
                      type="button"
                      onClick={() => handleSort('status')}
                      className="hover:text-primary-600"
                    >
                      {t('bills.status')} {sortField === 'status' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-semibold text-secondary-800">{t('bills.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-secondary-500">
                      {t('bills.empty')}
                    </td>
                  </tr>
                ) : (
                  paginated.map((b) => (
                    <tr
                      key={b.id}
                      className="border-b border-secondary-100 hover:bg-secondary-50/50"
                    >
                      <td className="px-4 py-3 font-medium text-secondary-900">{b.number}</td>
                      <td className="px-4 py-3 text-secondary-700">{b.vendor}</td>
                      <td className="px-4 py-3 text-secondary-700">
                        {formatCurrency(b.amount, b.currency)}
                      </td>
                      <td className="px-4 py-3 text-secondary-700">{b.dueDate}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            b.status === 'rejected' && 'bg-danger-100 text-danger-700',
                            b.status === 'paid' && 'bg-green-100 text-green-700',
                            b.status === 'pending' && 'bg-amber-100 text-amber-700',
                            ['reviewed', 'approved_l1', 'approved_l2', 'scheduled'].includes(
                              b.status
                            ) && 'bg-primary-100 text-primary-700'
                          )}
                        >
                          {statusLabel(b.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openView(b)}
                          >
                            {t('bills.viewBill')}
                          </Button>
                          {canReview(b) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReview(b)}
                            >
                              {t('bills.review')}
                            </Button>
                          )}
                          {canApproveL1(b) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleApproveL1(b)}
                            >
                              {t('bills.approveL1')}
                            </Button>
                          )}
                          {canApproveL2(b) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleApproveL2(b)}
                            >
                              {t('bills.approveL2')}
                            </Button>
                          )}
                          {canSchedule(b) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setScheduleBillId(b.id)}
                            >
                              {t('bills.schedulePayment')}
                            </Button>
                          )}
                          {canReject(b) && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleReject(b)}
                            >
                              {t('bills.reject')}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-secondary-200 pt-4">
              <p className="text-sm text-secondary-600">
                Page {page} of {totalPages} ({sorted.length} bills)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ViewBillModal
        open={!!viewBillId}
        onClose={() => setViewBillId(null)}
        bill={viewBill}
        logs={viewLogs}
      />
      <SchedulePaymentModal
        open={!!scheduleBillId}
        onClose={() => setScheduleBillId(null)}
        bill={scheduleBill}
        onScheduled={handleScheduled}
      />
    </div>
  );
}
