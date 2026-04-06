/**
 * CSV export – converte dados tabulares em CSV e dispara download.
 */

export function downloadCsv(data: Record<string, string | number | null | undefined>[], filename: string): void {
  if (data.length === 0) return;
  const keys = Object.keys(data[0]!);
  const header = keys.join(',');
  const rows = data.map((row) =>
    keys.map((k) => {
      const v = row[k];
      if (v == null) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
