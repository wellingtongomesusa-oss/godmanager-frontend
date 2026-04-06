'use client';

export default function AdminRolesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-gm-ink">Roles &amp; permissions</h1>
        <p className="mt-1 text-[13px] text-gm-ink-secondary">
          Map operational responsibilities to least-privilege access. Fine-grained policy editing ships in the next
          release cycle.
        </p>
      </div>
      <div className="rounded-gm border border-gm-border bg-gm-paper p-6">
        <p className="text-sm text-gm-ink-secondary">
          Today, role assignment is managed per user in User Management. Granular permission matrices and approval
          workflows will appear here for enterprise tenants.
        </p>
      </div>
    </div>
  );
}
