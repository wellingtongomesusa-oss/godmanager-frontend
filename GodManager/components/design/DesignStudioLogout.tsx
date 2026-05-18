'use client';

import { useState } from 'react';

/**
 * Logout for /design shell — clears session cookie via API, then redirects to app login.
 */
export function DesignStudioLogout() {
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    setBusy(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      }).catch(() => {});
    } finally {
      window.location.href = '/login?from=/design';
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={busy}
      className="rounded-md border border-[var(--border2)] px-3 py-1.5 text-xs font-semibold text-[var(--ink2)] transition hover:border-[var(--amber)] hover:text-[var(--ink)] disabled:opacity-50"
    >
      {busy ? 'A sair…' : 'Sair'}
    </button>
  );
}
