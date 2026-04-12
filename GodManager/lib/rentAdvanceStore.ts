import { randomUUID } from 'crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

export type RentAdvanceStatus = 'pending' | 'approved' | 'paid' | 'cancelled';

export type RentAdvanceRecord = {
  id: string;
  owner_id: string;
  property_ids: string[];
  months: number;
  gross_amount: number;
  present_value: number;
  annual_rate: number;
  period_start: string;
  period_end: string;
  status: RentAdvanceStatus;
  created_at: string;
  updated_at: string;
};

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'rent-advances.json');

function ensureFile(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DATA_FILE)) writeFileSync(DATA_FILE, '[]', 'utf8');
}

export function loadAdvances(): RentAdvanceRecord[] {
  try {
    ensureFile();
    const raw = readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw) as RentAdvanceRecord[];
  } catch {
    return [];
  }
}

export function saveAdvances(rows: RentAdvanceRecord[]): void {
  ensureFile();
  writeFileSync(DATA_FILE, JSON.stringify(rows, null, 2), 'utf8');
}

export function addAdvance(row: Omit<RentAdvanceRecord, 'id' | 'created_at' | 'updated_at'>): RentAdvanceRecord {
  const now = new Date().toISOString();
  const rec: RentAdvanceRecord = {
    ...row,
    id: randomUUID(),
    created_at: now,
    updated_at: now,
  };
  const all = loadAdvances();
  all.push(rec);
  saveAdvances(all);
  return rec;
}

/** Antecipações ativas (bloqueiam período sobreposto) */
const ACTIVE: RentAdvanceStatus[] = ['pending', 'approved', 'paid'];

export function hasOverlappingAdvance(
  ownerId: string,
  periodStart: string,
  periodEnd: string,
  excludeId?: string,
): boolean {
  const ps = new Date(periodStart).getTime();
  const pe = new Date(periodEnd).getTime();
  return loadAdvances().some((a) => {
    if (a.owner_id !== ownerId) return false;
    if (excludeId && a.id === excludeId) return false;
    if (!ACTIVE.includes(a.status)) return false;
    const as = new Date(a.period_start).getTime();
    const ae = new Date(a.period_end).getTime();
    return ps <= ae && pe >= as;
  });
}

export function listByOwner(ownerId: string): RentAdvanceRecord[] {
  return loadAdvances()
    .filter((a) => a.owner_id === ownerId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
