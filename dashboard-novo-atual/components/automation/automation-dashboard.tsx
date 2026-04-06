'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/language-context';
import { formatCurrency, cn } from '@/lib/utils';
import {
  getUpcomingPayments,
  getNotifications,
  predictCashFlow,
  suggestPaymentDates,
  detectAnomalies,
  markNotificationRead,
  type ScheduledPayment,
  type AutomationNotification,
  type CashFlowPrediction,
  type PaymentDateSuggestion,
  type AnomalyAlert,
} from '@/services/automation/automation.service';
import { SchedulePaymentAutomationModal } from './schedule-payment-automation-modal';
import { AutomateVendorModal } from './automate-vendor-modal';

const RECURRENCE_LABELS: Record<string, string> = {
  once: 'Once',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export function AutomationDashboard() {
  const { t } = useLanguage();
  const [upcoming, setUpcoming] = useState<ScheduledPayment[]>([]);
  const [notifications, setNotifications] = useState<AutomationNotification[]>([]);
  const [predictions, setPredictions] = useState<CashFlowPrediction[]>([]);
  const [suggestions, setSuggestions] = useState<PaymentDateSuggestion[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyAlert[]>([]);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [automateModalOpen, setAutomateModalOpen] = useState(false);
  const [predictLoading, setPredictLoading] = useState(false);

  const refresh = useCallback(() => {
    setUpcoming(getUpcomingPayments(10));
    setNotifications(getNotifications(false).slice(0, 10));
    setAnomalies(detectAnomalies().slice(0, 5));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handlePredictCashFlow = useCallback(() => {
    setPredictLoading(true);
    try {
      setPredictions(predictCashFlow(14));
      setSuggestions(suggestPaymentDates());
    } finally {
      setPredictLoading(false);
    }
  }, []);

  const handleScheduled = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleAutomated = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleMarkRead = useCallback((id: string) => {
    markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setScheduleModalOpen(true)}>{t('automation.schedulePayment')}</Button>
        <Button variant="outline" onClick={() => setAutomateModalOpen(true)}>
          {t('automation.automateVendor')}
        </Button>
        <Button
          variant="outline"
          onClick={handlePredictCashFlow}
          disabled={predictLoading}
        >
          {predictLoading ? '...' : t('automation.predictCashFlow')}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('automation.upcomingPayments')}</CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-secondary-500">{t('automation.noUpcoming')}</p>
            ) : (
              <ul className="space-y-3">
                {upcoming.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-secondary-100 pb-2 text-sm last:border-0"
                  >
                    <span className="font-medium text-secondary-800">{p.vendor}</span>
                    <span>{formatCurrency(p.amount, p.currency)}</span>
                    <span className="text-secondary-600">{p.nextRunAt}</span>
                    <span
                      className={cn(
                        'rounded px-2 py-0.5 text-xs',
                        p.status === 'pending' && 'bg-amber-100 text-amber-800',
                        p.status === 'processed' && 'bg-green-100 text-green-800'
                      )}
                    >
                      {RECURRENCE_LABELS[p.recurrence] ?? p.recurrence}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('automation.predictions')}</CardTitle>
          </CardHeader>
          <CardContent>
            {predictions.length === 0 ? (
              <p className="text-sm text-secondary-500">
                Click &quot;Predict Cash Flow&quot; to see AI-powered projections.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-medium text-secondary-600">
                  {t('automation.idealDates')}
                </p>
                <ul className="max-h-32 space-y-1 overflow-y-auto text-xs">
                  {suggestions.slice(0, 5).map((s, i) => (
                    <li key={i}>
                      {s.date} – score {s.score} – {s.reason}
                    </li>
                  ))}
                </ul>
                <p className="text-xs font-medium text-secondary-600 mt-2">Balance (next 7 days)</p>
                <ul className="max-h-24 space-y-0.5 overflow-y-auto text-xs text-secondary-600">
                  {predictions.slice(0, 7).map((pr, i) => (
                    <li key={i}>
                      {pr.date}: {formatCurrency(pr.balance, 'USD')}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('automation.alerts')}</CardTitle>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 && anomalies.length === 0 ? (
              <p className="text-sm text-secondary-500">{t('automation.noAlerts')}</p>
            ) : (
              <div className="space-y-3">
                {notifications.slice(0, 5).map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm',
                      n.read ? 'border-secondary-100 bg-secondary-50/50' : 'border-primary-200 bg-primary-50/50'
                    )}
                  >
                    <p className="font-medium text-secondary-800">{n.title}</p>
                    <p className="text-secondary-600">{n.message}</p>
                    <p className="mt-1 text-xs text-secondary-500">{n.createdAt.slice(0, 10)}</p>
                    {!n.read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1"
                        onClick={() => handleMarkRead(n.id)}
                      >
                        Mark read
                      </Button>
                    )}
                  </div>
                ))}
                {anomalies.length > 0 && (
                  <>
                    <p className="text-xs font-medium text-secondary-600 mt-2">
                      {t('automation.anomalies')}
                    </p>
                    {anomalies.map((a) => (
                      <div
                        key={a.id}
                        className={cn(
                          'rounded-lg border px-3 py-2 text-sm',
                          a.severity === 'high' && 'border-red-200 bg-red-50/50',
                          a.severity === 'medium' && 'border-amber-200 bg-amber-50/50',
                          a.severity === 'low' && 'border-secondary-200 bg-secondary-50/50'
                        )}
                      >
                        <p className="font-medium text-secondary-800">{a.type}</p>
                        <p className="text-secondary-600">{a.message}</p>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <SchedulePaymentAutomationModal
        open={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        onScheduled={handleScheduled}
      />
      <AutomateVendorModal
        open={automateModalOpen}
        onClose={() => setAutomateModalOpen(false)}
        onAutomated={handleAutomated}
      />
    </div>
  );
}
