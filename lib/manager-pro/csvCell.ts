/** Leitura flexível de colunas CSV */
export function csvCell(row: Record<string, string>, ...candidates: string[]): string {
  const keys = Object.keys(row);
  const norm = (x: string) => x.toLowerCase().replace(/\s+/g, ' ').trim();
  for (const c of candidates) {
    const nc = norm(c);
    for (const k of keys) {
      if (norm(k) === nc) return String(row[k] ?? '').trim();
    }
    if (row[c] != null && String(row[c]).trim() !== '') return String(row[c]).trim();
  }
  return '';
}

export function csvMoney(s: string): number {
  if (!s) return 0;
  const t = String(s).replace(/[$\s]/g, '').replace(/,/g, '');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}
