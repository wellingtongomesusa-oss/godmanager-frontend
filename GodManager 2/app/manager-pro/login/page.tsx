'use client';

import { useEffect } from 'react';

/**
 * Abre o mesmo HTML do dashboard em página inteira (fora do shell React), sem redirect 307.
 */
export default function ManagerProLoginPage() {
  useEffect(() => {
    window.location.replace('/manager-pro-dashboard.html');
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
      A abrir Manager PRO…
    </div>
  );
}
