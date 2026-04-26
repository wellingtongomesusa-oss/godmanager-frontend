'use client';

import { useEffect } from 'react';

/**
 * Abre o painel GodManager Premium (HTML estático) — não o legado manager-pro-dashboard.html.
 */
export default function ManagerProLoginPage() {
  useEffect(() => {
    window.location.replace('/GodManager_Premium.html');
  }, []);
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
        color: '#6b5c48',
        background: '#faf7f2',
      }}
    >
      A abrir GodManager…
    </div>
  );
}
