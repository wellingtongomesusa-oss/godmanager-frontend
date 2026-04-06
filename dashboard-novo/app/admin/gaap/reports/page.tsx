'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/language-context';
import { listGaapReports, getMonthName, type GaapReport } from '@/services/gaap.service';
import { gaapReportToCsvRows } from '@/services/gaap.service';
import { downloadCsv } from '@/lib/csv-export';
import { downloadGaapReportPdf } from '@/services/gaap-pdf';
import { sendGaapReportEmail } from '@/services/email';

export default function GaapReportsPage() {
  const { t } = useLanguage();
  const [reports, setReports] = useState<GaapReport[]>([]);
  const [emailSending, setEmailSending] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setReports(listGaapReports());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDownloadPdf = useCallback((r: GaapReport) => {
    downloadGaapReportPdf(r);
  }, []);

  const handleDownloadCsv = useCallback((r: GaapReport) => {
    const rows = gaapReportToCsvRows(r);
    downloadCsv(rows, `gaap-report-${r.period.year}-${String(r.period.month).padStart(2, '0')}.csv`);
  }, []);

  const handleSendEmail = useCallback(
    async (r: GaapReport) => {
      const to = r.client.email;
      if (!to) return;
      setEmailSending(r.id);
      try {
        const res = await sendGaapReportEmail(r, to);
        if (res.success) alert(t('inv.email.success'));
        else alert(t('inv.email.error') + (res.error ? `: ${res.error}` : ''));
      } finally {
        setEmailSending(null);
      }
    },
    [t]
  );

  const handleSendWhatsApp = useCallback((r: GaapReport) => {
    const phone = r.client.phone?.replace(/\D/g, '') ?? '';
    if (!phone) return;
    const prefix = phone.startsWith('55') ? '' : '55';
    const num = prefix + phone;
    const text = encodeURIComponent(
      `GAAP Monthly Report – ${getMonthName(r.period.month)} ${r.period.year}. Client: ${r.client.clientName}. Download: dashboard GAAP reports.`
    );
    window.open(`https://wa.me/${num}?text=${text}`, '_blank', 'noopener,noreferrer');
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-secondary-900">{t('gaap.reports')}</h1>
        <Link href="/admin/gaap">
          <Button variant="outline">{t('gaap.generateReport')}</Button>
        </Link>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('gaap.reports')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-secondary-600">{t('gaap.reports.empty')}</p>
            <Link href="/admin/gaap">
              <Button className="mt-4">{t('gaap.generateReport')}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reports.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                  <span>
                    {getMonthName(r.period.month)} {r.period.year} – {r.client.clientName}
                  </span>
                  <span className="text-sm font-normal text-secondary-500">
                    {r.period.periodStart} – {r.period.periodEnd}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(r)}>
                    {t('gaap.downloadPdf')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDownloadCsv(r)}>
                    {t('gaap.downloadCsv')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSendEmail(r)}
                    disabled={!r.client.email || emailSending === r.id}
                  >
                    {t('gaap.sendEmail')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleSendWhatsApp(r)} disabled={!r.client.phone}>
                    {t('gaap.sendWhatsApp')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
