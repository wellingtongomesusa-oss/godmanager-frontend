'use client';

import { useEffect, useState } from 'react';
import { listAudit } from '@/lib/audit';
import type { AuditEntry } from '@/lib/types';
import { listUsers } from '@/lib/users';

export function AuditLogTable() {
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [nameById, setNameById] = useState<Record<string, string>>({});

  useEffect(() => {
    setRows(listAudit());
    listUsers().then((users) => {
      const m: Record<string, string> = {};
      for (const u of users) {
        m[u.id] = `${u.firstName} ${u.lastName}`;
      }
      setNameById(m);
    });
  }, []);

  return (
    <div className="overflow-hidden rounded-gm border border-gm-border bg-gm-paper">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-gm-border bg-gm-cream">
              <th className="px-[14px] py-2.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-gm-ink-tertiary">
                Timestamp
              </th>
              <th className="px-[14px] py-2.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-gm-ink-tertiary">
                Actor
              </th>
              <th className="px-[14px] py-2.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-gm-ink-tertiary">
                Action
              </th>
              <th className="px-[14px] py-2.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-gm-ink-tertiary">
                Details
              </th>
              <th className="px-[14px] py-2.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-gm-ink-tertiary">IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gm-ink-secondary">
                  No audit events recorded yet. Administrative actions will appear here automatically.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => {
                const actorLabel = nameById[r.adminId] ?? r.adminId;
                return (
                  <tr
                    key={r.id}
                    className="gm-stagger-item border-b border-gm-border transition-colors hover:bg-gm-amber/[0.04]"
                    style={{ animationDelay: `${Math.min(i * 50, 500)}ms` }}
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gm-ink-secondary">
                      {new Date(r.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gm-ink">{actorLabel}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gm-amber">{r.action}</td>
                    <td className="max-w-md px-4 py-3 text-gm-ink-secondary">{r.details}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gm-ink-secondary">{r.ip}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
