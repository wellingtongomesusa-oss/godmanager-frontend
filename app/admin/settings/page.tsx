'use client';

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-gm-ink">System settings</h1>
        <p className="mt-1 text-[13px] text-gm-ink-secondary">
          Configure retention policies, notification routing, and integration credentials for your GodManager tenant.
        </p>
      </div>
      <div className="rounded-gm border border-gm-border bg-gm-paper p-6">
        <p className="text-sm text-gm-ink-secondary">
          Advanced controls are not enabled in this local demonstration. Connect your environment variables and API keys
          to unlock production-grade configuration.
        </p>
      </div>
    </div>
  );
}
