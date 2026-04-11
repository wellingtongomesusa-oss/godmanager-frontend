'use client';

import { useCallback, useRef, useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  computeDpRanking,
  parseReservationsCsvForDpRanking,
  parseUnitsExcelForDpRanking,
  type DpRankingRow,
} from '@/lib/manager-pro/dpRankingMerge';

const DS = {
  sand: '#faf7f2',
  cream: '#f4efe6',
  paper: '#fffdf9',
  border: '#e2d9cc',
  border2: '#cec3b4',
  ink: '#1e160c',
  ink2: '#6b5c48',
  ink3: '#9e8e7c',
  amber: '#c47b28',
  amberBg: '#fdf0dc',
  amberBd: '#f0d09a',
  headerBg: '#1a1209',
  btnHover: '#8c4512',
} as const;

export default function DpRankingPage() {
  const csvInputRef = useRef<HTMLInputElement>(null);
  const xlsxInputRef = useRef<HTMLInputElement>(null);
  const [csvName, setCsvName] = useState<string | null>(null);
  const [xlsxName, setXlsxName] = useState<string | null>(null);
  const [csvRows, setCsvRows] = useState<Record<string, string>[] | null>(null);
  const [sheetRows, setSheetRows] = useState<unknown[][] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ranking, setRanking] = useState<DpRankingRow[] | null>(null);
  const [unmatched, setUnmatched] = useState<number | null>(null);

  const onCsv = useCallback((f: File | undefined) => {
    if (!f) return;
    setCsvName(f.name);
    setError(null);
    setRanking(null);
    setUnmatched(null);
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        setCsvRows(res.data as Record<string, string>[]);
      },
      error: (err) => setError(err.message),
    });
  }, []);

  const onXlsx = useCallback((f: File | undefined) => {
    if (!f) return;
    setXlsxName(f.name);
    setError(null);
    setRanking(null);
    setUnmatched(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]!];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
        setSheetRows(rows);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao ler Excel.');
      }
    };
    reader.readAsArrayBuffer(f);
  }, []);

  const processMerge = useCallback(() => {
    setError(null);
    if (!csvRows?.length) {
      setError('Carregue o CSV de Reservas.');
      return;
    }
    if (!sheetRows?.length) {
      setError('Carregue o Excel de Unidades.');
      return;
    }
    try {
      const reservations = parseReservationsCsvForDpRanking(csvRows);
      const units = parseUnitsExcelForDpRanking(sheetRows);
      if (!units.length) {
        setError(
          'Não foi possível ler unidades no Excel. Confirme pivot (Row Labels na linha 3) ou cabeçalhos Unit Name / Bedrooms.'
        );
        setRanking(null);
        setUnmatched(null);
        return;
      }
      if (!reservations.length) {
        setError('Não há linhas válidas no CSV (colunas Unit e Nights).');
        setRanking(null);
        setUnmatched(null);
        return;
      }
      const { rows, unmatchedReservations } = computeDpRanking(units, reservations);
      setRanking(rows);
      setUnmatched(unmatchedReservations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar.');
      setRanking(null);
      setUnmatched(null);
    }
  }, [csvRows, sheetRows]);

  return (
    <div
      className="dp-ranking-tool -mx-4 -mt-4 sm:-mx-6 sm:-mt-6"
      style={
        {
          '--sand': DS.sand,
          '--cream': DS.cream,
          '--paper': DS.paper,
          '--border': DS.border,
          '--border2': DS.border2,
          '--ink': DS.ink,
          '--ink2': DS.ink2,
          '--ink3': DS.ink3,
          '--amber': DS.amber,
          '--amber-bg': DS.amberBg,
          '--amber-bd': DS.amberBd,
        } as React.CSSProperties
      }
    >
      <header
        className="flex h-14 shrink-0 items-center gap-3 px-6"
        style={{ background: DS.headerBg }}
      >
        <div
          className="flex shrink-0 items-center justify-center rounded-lg text-[13px] font-bold text-white"
          style={{
            width: 34,
            height: 34,
            background: DS.amber,
            borderRadius: 8,
          }}
        >
          DP+
        </div>
        <h1
          className="min-w-0 text-[15px] font-semibold leading-tight"
          style={{ color: 'rgba(255,255,255,0.92)', fontFamily: 'var(--font-sora), system-ui, sans-serif' }}
        >
          Ranking DP por unidade
        </h1>
      </header>

      <div className="p-6" style={{ background: DS.sand }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-4">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => onCsv(e.target.files?.[0])}
          />
          <button
            type="button"
            className="upload-box flex-1 rounded-lg border-2 border-dashed text-center transition-[border-color] duration-[120ms] hover:border-[var(--amber)]"
            style={{
              background: DS.sand,
              borderColor: DS.border2,
              padding: '22px 28px',
              cursor: 'pointer',
            }}
            onClick={() => csvInputRef.current?.click()}
          >
            <p className="text-[14px] font-semibold" style={{ color: DS.ink }}>
              Arquivo 1 — Reservas (.csv)
            </p>
            <p className="mt-1 text-[12px]" style={{ color: DS.ink3 }}>
              Unit, ID, Source, Arrival Date, Nights, Total (inc tax)…
            </p>
            {csvName && (
              <p className="mt-2 truncate text-[11px] font-medium" style={{ color: DS.amber }}>
                {csvName}
              </p>
            )}
          </button>

          <input
            ref={xlsxInputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => onXlsx(e.target.files?.[0])}
          />
          <button
            type="button"
            className="upload-box flex-1 rounded-lg border-2 border-dashed text-center transition-[border-color] duration-[120ms] hover:border-[var(--amber)]"
            style={{
              background: DS.sand,
              borderColor: DS.border2,
              padding: '22px 28px',
              cursor: 'pointer',
            }}
            onClick={() => xlsxInputRef.current?.click()}
          >
            <p className="text-[14px] font-semibold" style={{ color: DS.ink }}>
              Arquivo 2 — Unidades (.xlsx)
            </p>
            <p className="mt-1 text-[12px] leading-snug" style={{ color: DS.ink3 }}>
              Formato pivot: linha 3 com Row Labels e Sum of Bedrooms. Ou export clássico com cabeçalhos na 2.ª linha
              (Unit Name, Bedrooms…).
            </p>
            {xlsxName && (
              <p className="mt-2 truncate text-[11px] font-medium" style={{ color: DS.amber }}>
                {xlsxName}
              </p>
            )}
          </button>
        </div>

        <p className="mt-4 text-[12px]" style={{ color: DS.ink3 }}>
          Carregue o CSV e o Excel, depois clique em <strong>Processar fusão</strong>.
        </p>

        <div className="mt-4">
          <button
            type="button"
            onClick={processMerge}
            className="inline-flex items-center gap-1.5 rounded-[7px] border-none text-[13px] font-medium text-white transition-[background] duration-[120ms]"
            style={{
              padding: '10px 24px',
              background: DS.amber,
              fontFamily: 'var(--font-sora), system-ui, sans-serif',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = DS.btnHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = DS.amber;
            }}
          >
            Processar fusão
          </button>
        </div>

        {error && (
          <p className="mt-4 text-[13px] font-medium" style={{ color: DS.ink }}>
            {error}
          </p>
        )}

        {unmatched !== null && unmatched > 0 && !error && (
          <p className="mt-3 text-[12px]" style={{ color: DS.ink3 }}>
            {unmatched} reserva(s) sem correspondência de unidade no Excel (ignoradas).
          </p>
        )}

        {ranking && ranking.length > 0 && (
          <div
            className="mt-6 overflow-auto rounded-lg border shadow-[0_1px_2px_rgba(30,22,12,0.06)]"
            style={{ borderColor: DS.border, background: DS.paper }}
          >
            <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
              <thead>
                <tr style={{ background: DS.cream }}>
                  {(['Rank', 'Unit Name', 'Bedrooms', 'Reservas', 'Nights Total', 'DP Total'] as const).map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.6px]"
                        style={{ color: DS.ink2, borderBottom: `1px solid ${DS.border}` }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {ranking.map((row, i) => (
                  <tr
                    key={`${row.unitName}-${row.rank}`}
                    style={{ background: i % 2 === 0 ? DS.paper : DS.sand }}
                  >
                    <td className="px-4 py-2.5 align-middle">
                      {row.rank === 1 ? (
                        <span
                          className="inline-flex min-w-[2rem] items-center justify-center rounded-md px-2 py-0.5 text-[12px] font-bold text-white"
                          style={{ background: DS.amber }}
                        >
                          1
                        </span>
                      ) : (
                        <span style={{ color: DS.ink2 }}>{row.rank}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-medium" style={{ color: DS.ink }}>
                      {row.unitName}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: DS.ink2 }}>
                      {row.bedrooms}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: DS.ink2 }}>
                      {row.resCount}
                    </td>
                    <td
                      className="px-4 py-2.5"
                      style={{ fontFamily: 'var(--font-jetbrains), ui-monospace, monospace', color: DS.ink2 }}
                    >
                      {row.nightsTotal.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                    </td>
                    <td
                      className="px-4 py-2.5 font-bold"
                      style={{
                        fontFamily: 'var(--font-jetbrains), ui-monospace, monospace',
                        color: DS.amber,
                      }}
                    >
                      {row.dpTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {ranking && ranking.length === 0 && !error && (
          <p className="mt-4 text-[13px]" style={{ color: DS.ink3 }}>
            Nenhuma unidade com reservas correspondentes — verifique os nomes das unidades no CSV e no Excel.
          </p>
        )}
      </div>
    </div>
  );
}
