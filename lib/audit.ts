import { STORAGE_KEYS } from '@/lib/constants';
import type { AuditEntry } from '@/lib/types';

function read(): AuditEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.audit);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AuditEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(entries: AuditEntry[]) {
  localStorage.setItem(STORAGE_KEYS.audit, JSON.stringify(entries));
}

export function listAudit(): AuditEntry[] {
  return read().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function appendAudit(
  entry: Omit<AuditEntry, 'id' | 'timestamp' | 'ip'> & { timestamp?: string; ip?: string },
) {
  const entries = read();
  const row: AuditEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    adminId: entry.adminId,
    action: entry.action,
    targetUserId: entry.targetUserId,
    details: entry.details,
    timestamp: entry.timestamp ?? new Date().toISOString(),
    ip: entry.ip ?? 'client',
  };
  write([row, ...entries].slice(0, 500));
}
