'use client';

import { useEffect } from 'react';
import { getGodManagerPremiumUrl } from '@/lib/godmanager-premium-url';

export default function DashboardPage() {
  useEffect(() => {
    window.location.replace(getGodManagerPremiumUrl());
  }, []);

  return (
    <div className="flex min-h-[40vh] items-center justify-center bg-[#141416] text-sm text-white/70">
      A carregar o painel…
    </div>
  );
}
