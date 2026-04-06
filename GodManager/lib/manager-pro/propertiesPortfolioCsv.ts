/**
 * Properties portfolio CSV (GodManager.One) — todas as unidades
 * Colunas flexíveis; KPIs e grupo OUT HOMES
 */
import { csvCell, csvMoney } from '@/lib/manager-pro/csvCell';

export type PortfolioCsvRow = {
  property: string;
  admFee: number;
  commission: number;
  managedAmount: number;
  sqft: number;
  bedrooms: number;
  commChange: boolean;
  status: string;
  group: string;
  dateRaw: string;
  amount: number;
  dateParsed: Date | null;
};

/** Valores de referência quando não há CSV (GodManager.One) */
export const PORTFOLIO_ONE_REF = {
  totalHouses: 975,
  totalBedrooms: 5558,
  outHomesQty: 36,
  outHomesValue: 0,
} as const;

function parseDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseBoolCommChange(s: string): boolean {
  const t = s.trim().toLowerCase();
  return t === 'y' || t === 'yes' || t === 'true' || t === '1' || t === 'sim' || t === 's';
}

export function parsePortfolioCsvRow(r: Record<string, string>): PortfolioCsvRow | null {
  const property = csvCell(r, 'Property', 'Unit Name', 'Property Name', 'Unit', 'Listing', 'Casa');
  if (!property) return null;
  const skip = /^(total|subtotal|grand)/i.test(property);
  if (skip) return null;

  const admFee = csvMoney(
    csvCell(r, 'ADM Fee', 'Admin Fee', 'Administration Fee', 'Management Fee', 'ADM', 'Taxa ADM')
  );
  const commission = csvMoney(
    csvCell(r, 'Commission', 'Commissions', 'Commission Paid', 'Total Commission', 'Comissão', 'Comm Paid')
  );
  const managedAmount = csvMoney(
    csvCell(r, 'Managed Amount', 'Total Managed', 'Managed Value', 'GMV', 'Valor Gerenciado', 'Amount Managed')
  );
  const sqftRaw = csvCell(r, 'SQFT', 'Sq Ft', 'Square Feet', 'Area', 'm2', 'M2', 'SQM', 'Metros');
  const sqft = csvMoney(sqftRaw) || 0;
  const bedsStr = csvCell(r, 'Bedrooms', 'Beds', 'BR', 'Quartos', '# Bedrooms');
  const bedrooms = Math.max(0, Math.floor(csvMoney(bedsStr) || parseInt(bedsStr, 10) || 0));

  const commChange = parseBoolCommChange(
    csvCell(r, 'Commission Change', 'Comm Change', 'Commission Changed', 'Comm. Change', 'Mudança Comissão')
  );
  const status = csvCell(r, 'Status', 'Property Status', 'Estado');
  const group = csvCell(r, 'Group', 'Segment', 'Portfolio Group', 'Category', 'Tipo', 'Portfolio Segment');

  const dateRaw = csvCell(
    r,
    'Date',
    'As Of',
    'Effective Date',
    'Period',
    'Reference Date',
    'Data'
  );
  const amount = csvMoney(csvCell(r, 'Out Amount', 'Balance', 'Outstanding', 'Valor'));

  return {
    property,
    admFee,
    commission,
    managedAmount,
    sqft,
    bedrooms,
    commChange,
    status: status || 'Active',
    group,
    dateRaw,
    amount,
    dateParsed: parseDate(dateRaw),
  };
}

export function isOutHomeGroup(row: PortfolioCsvRow): boolean {
  const g = row.group.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!g) return false;
  if (g === 'out homes' || g === 'out home') return true;
  return g.includes('out') && g.includes('home');
}

export type PortfolioKpiAgg = {
  totalAdmFee: number;
  totalCommissions: number;
  totalHouses: number;
  housesCommChange: number;
  totalManagedAmount: number;
  avgSqft: number;
  totalBedrooms: number;
  outHomesQty: number;
  outHomesValue: number;
};

export function aggregatePortfolioKpis(rows: PortfolioCsvRow[]): PortfolioKpiAgg {
  let totalAdmFee = 0;
  let totalCommissions = 0;
  let totalManagedAmount = 0;
  let totalBedrooms = 0;
  let sqftSum = 0;
  let sqftCount = 0;
  let housesCommChange = 0;
  let outHomesQty = 0;
  let outHomesValue = 0;

  for (const r of rows) {
    totalAdmFee += r.admFee;
    totalCommissions += r.commission;
    totalManagedAmount += r.managedAmount;
    totalBedrooms += r.bedrooms;
    if (r.sqft > 0) {
      sqftSum += r.sqft;
      sqftCount += 1;
    }
    if (r.commChange) housesCommChange += 1;
    if (isOutHomeGroup(r)) {
      outHomesQty += 1;
      outHomesValue += r.amount;
    }
  }

  return {
    totalAdmFee,
    totalCommissions,
    totalHouses: rows.length,
    housesCommChange,
    totalManagedAmount,
    avgSqft: sqftCount > 0 ? sqftSum / sqftCount : 0,
    totalBedrooms,
    outHomesQty,
    outHomesValue,
  };
}

export function filterPortfolioRows(
  rows: PortfolioCsvRow[],
  opts: {
    status: string;
    bedrooms: number | 'all';
    periodMonth: string;
  }
): PortfolioCsvRow[] {
  return rows.filter((r) => {
    if (opts.status !== 'all' && r.status.toLowerCase() !== opts.status.toLowerCase()) return false;
    if (opts.bedrooms !== 'all' && r.bedrooms !== opts.bedrooms) return false;
    if (opts.periodMonth && r.dateParsed) {
      const key = `${r.dateParsed.getFullYear()}-${String(r.dateParsed.getMonth() + 1).padStart(2, '0')}`;
      if (key !== opts.periodMonth) return false;
    }
    return true;
  });
}

export function getOutHomeDetailRows(rows: PortfolioCsvRow[]): PortfolioCsvRow[] {
  return rows.filter((r) => isOutHomeGroup(r));
}
