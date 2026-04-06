'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { MonthlyTrendItem } from '@/services/reports/ap-reports.service';
import type { VendorConcentrationItem } from '@/services/reports/ap-reports.service';
import type { MastercardInsightsSpendItem } from '@/services/reports/ap-reports.service';

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function ApLineChart({ data, title }: { data: MonthlyTrendItem[]; title: string }) {
  const maxVal = Math.max(...data.flatMap((d) => [d.outstanding, d.paid, d.overdue]), 1);
  return (
    <Card variant="elevated" className="border-secondary-200 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-secondary-800">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex h-40 items-end justify-between gap-1">
          {data.map((d) => {
            const hOut = (d.outstanding / maxVal) * 100;
            const hPaid = (d.paid / maxVal) * 100;
            const hOver = (d.overdue / maxVal) * 100;
            return (
              <div key={d.month} className="flex flex-1 flex-col items-center gap-0.5">
                <div
                  className="flex w-full flex-col-reverse overflow-hidden rounded-t"
                  style={{ height: '100%', minHeight: 60 }}
                >
                  <div className="min-h-[2px] w-full rounded-t bg-red-400/80" style={{ height: `${Math.max(hOver, 2)}%` }} />
                  <div className="min-h-[2px] w-full rounded-t bg-green-500/80" style={{ height: `${Math.max(hPaid, 2)}%` }} />
                  <div className="min-h-[2px] w-full rounded-t bg-blue-500/80" style={{ height: `${Math.max(hOut, 2)}%` }} />
                </div>
                <span className="mt-1 truncate text-[10px] text-secondary-500">{d.label.split(' ')[0]}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs text-secondary-600">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-blue-500" /> Outstanding</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-green-500" /> Paid</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-red-400" /> Overdue</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function ApBarChart({ data, title }: { data: VendorConcentrationItem[]; title: string }) {
  const maxVal = Math.max(...data.map((d) => d.amount), 1);
  return (
    <Card variant="elevated" className="border-secondary-200 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-secondary-800">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex h-48 flex-col justify-end gap-2">
          {data.slice(0, 8).map((d, i) => (
            <div key={d.vendor} className="flex items-center gap-2">
              <span className="w-24 truncate text-xs text-secondary-600">{d.vendor}</span>
              <div className="flex-1 overflow-hidden rounded bg-secondary-100">
                <div
                  className="h-6 rounded bg-primary-500"
                  style={{ width: `${(d.amount / maxVal) * 100}%`, minWidth: 4 }}
                />
              </div>
              <span className="w-14 text-right text-xs font-medium text-secondary-700">{d.percent}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ApPieChart({ data, title }: { data: MastercardInsightsSpendItem[]; title: string }) {
  const total = data.reduce((s, d) => s + d.amount, 0) || 1;
  let acc = 0;
  const conic = data.map((d, i) => {
    const start = (acc / total) * 360;
    acc += d.amount;
    const end = (acc / total) * 360;
    return `${PIE_COLORS[i % PIE_COLORS.length]} ${start}deg ${end}deg`;
  }).join(', ');
  return (
    <Card variant="elevated" className="border-secondary-200 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-secondary-800">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div
            className="h-28 w-28 shrink-0 rounded-full border-4 border-secondary-100 shadow-inner"
            style={{ background: `conic-gradient(${conic})` }}
          />
          <ul className="flex flex-col gap-1 text-sm">
            {data.map((d, i) => (
              <li key={d.category} className="flex items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded"
                  style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                />
                <span className="text-secondary-700">{d.category}</span>
                <span className="font-medium text-secondary-800">{d.percent}%</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export function ApHeatmap({ vendors, months, values, title }: {
  vendors: string[];
  months: string[];
  values: number[][];
  title: string;
}) {
  const flat = values.flat();
  const maxVal = Math.max(...flat, 1);
  return (
    <Card variant="elevated" className="overflow-hidden border-secondary-200 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-secondary-800">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border border-secondary-200 bg-secondary-50 p-1 text-left font-medium text-secondary-700">Vendor</th>
              {months.map((m) => (
                <th key={m} className="border border-secondary-200 bg-secondary-50 p-1 font-medium text-secondary-700">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vendors.map((v, i) => (
              <tr key={v}>
                <td className="max-w-[100px] truncate border border-secondary-200 p-1 text-secondary-700">{v}</td>
                {values[i]?.map((val, j) => (
                  <td
                    key={j}
                    className={cn(
                      'border border-secondary-200 p-1 text-center font-medium',
                      (val / maxVal) > 0.7 && 'bg-primary-100 text-primary-800',
                      (val / maxVal) <= 0.7 && (val / maxVal) > 0.3 && 'bg-primary-50 text-primary-700',
                      (val / maxVal) <= 0.3 && (val / maxVal) > 0 && 'bg-secondary-50 text-secondary-600'
                    )}
                  >
                    {val.toLocaleString()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
