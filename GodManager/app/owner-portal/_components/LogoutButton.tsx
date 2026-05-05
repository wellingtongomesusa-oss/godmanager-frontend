'use client';

import { useState } from 'react';

export default function LogoutButton() {
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    setBusy(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      }).catch(() => {});
    } finally {
      window.location.href = '/owner-portal/login';
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={busy}
      className="rounded-md border border-white/25 px-3 py-1.5 text-xs transition hover:bg-white/10 disabled:opacity-50"
    >
      {busy ? 'Saindo...' : 'Sair'}
    </button>
  );
}
