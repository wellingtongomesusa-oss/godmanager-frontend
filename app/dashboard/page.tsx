'use client';

import { useEffect } from 'react';

export default function DashboardPage() {
  useEffect(() => {
    window.location.replace('/GodManager_Premium.html#longterm');
  }, []);

  return (
    <div className="flex min-h-[40vh] items-center justify-center bg-[#141416] text-sm text-white/70">
      A carregar o painel…
    </div>
  );
}
