'use client';

import { useMemo, useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { dpValue, mergeDpWithReservations, parseUnitExcelRows, type ReservationRow, type UnitRow } from '@/lib/manager-pro/dpMerge';

export default function DpPage() {
  const [status, setStatus] = useState<string[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [reservations, setReservations] = useState<ReservationRow[]>([]);

  const merged = useMemo(() => {
    if (!units.length) return null;
    return mergeDpWithReservations(units, reservations);
  }, [units, reservations]);

  const onCsv = (f: File) => {
    Papa.parse(f, {
      header: true,
      complete: (res) => {
        const rows = res.data as Record<string, string>[];
        const rev: ReservationRow[] = rows.map((r) => ({
          unit: String(r.Unit || r.unit || '').trim(),
          revenue: parseFloat(String(r.Revenue || r.revenue || '0').replace(/[^0-9.-]/g, '')) || 0,
        }));
        setReservations(rev);
        setStatus((s) => [...s, `✓ ${rows.length} linhas CSV. Aguardando Arquivo 2 (Excel)…`]);
      },
    });
  };

  const onXlsx = (f: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]!];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      const parsed = parseUnitExcelRows(rows);
      setUnits(parsed);
      setStatus((s) => [...s, `✓ ${parsed.length} unidades carregadas (header na linha 2)`]);
    };
    reader.readAsArrayBuffer(f);
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-[var(--ink)]">DP / DP+</h1>
      <p className="text-sm text-[var(--ink2)]">
        Mód. 15–16 · DP = quartos×10+9 · Excel header=2 · merge com DataGrid CSV
      </p>
      <div className="mt-4 flex flex-wrap gap-4">
        <label className="text-xs">
          1. DataGrid CSV
          <input type="file" accept=".csv" className="ml-2" onChange={(e) => e.target.files?.[0] && onCsv(e.target.files[0])} />
        </label>
        <label className="text-xs">
          2. export__88_.xlsx
          <input
            type="file"
            accept=".xlsx,.xls"
            className="ml-2"
            onChange={(e) => e.target.files?.[0] && onXlsx(e.target.files[0])}
          />
        </label>
      </div>
      <ul className="mt-4 space-y-1 text-sm text-[var(--ink2)]">
        {status.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
      {merged && (
        <>
        <p className="mt-2 text-sm font-medium text-[var(--green)]">
          ✓ Fusão: {merged.withRes} com reservas, {merged.withoutRes} sem · DP Total:{' '}
          {merged.dpTotal.toLocaleString()} · DP Volume: {merged.dpVolumeTotal.toLocaleString()} · Receita: $
          {merged.revenueTotal.toLocaleString()}
        </p>
        <div className="mp-table-wrap mt-6 max-h-[480px]">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="p-2">Unidade</th>
                <th className="p-2">Q</th>
                <th className="p-2">DP</th>
                <th className="p-2 text-right">Reservas</th>
                <th className="p-2 text-right">DP Vol</th>
                <th className="p-2 text-right">Receita</th>
              </tr>
            </thead>
            <tbody>
              {merged.rows.slice(0, 80).map((r) => (
                <tr key={r.unit} className="border-t border-[var(--border)]">
                  <td className="max-w-[200px] truncate p-2">{r.unit}</td>
                  <td className="p-2">{r.bedrooms}</td>
                  <td className="p-2 font-mono">${r.dp}</td>
                  <td className="p-2 text-right">{r.resCount}</td>
                  <td className="p-2 text-right font-mono">{r.dpVolume.toLocaleString()}</td>
                  <td className="p-2 text-right font-mono">${r.revenue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
      <p className="mt-4 text-xs text-[var(--ink3)]">
        Referência DP: 5 quartos → ${dpValue(5)} · 7 quartos → ${dpValue(7)}
      </p>
    </div>
  );
}
