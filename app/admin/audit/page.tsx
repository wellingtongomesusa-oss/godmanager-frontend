'use client';

import { AuditLogTable } from '@/components/admin/AuditLogTable';

export default function AdminAuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-gm-ink">Audit log</h1>
        <p className="mt-1 text-[13px] text-gm-ink-secondary">
          Immutable record of administrative actions across users, authentication, and configuration changes.
        </p>
      </div>
      <AuditLogTable />
    </div>
  );
}
