'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FinancialSidebar } from '@/components/financial/financial-sidebar';
import { FinancialHeader } from '@/components/financial/financial-header';

export default function FinancialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<{ email?: string; name?: string; role?: string } | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setChecking(false);
      return;
    }
    const stored = localStorage.getItem('user');
    if (!stored) {
      setChecking(false);
      router.push('/login');
      return;
    }
    try {
      const u = JSON.parse(stored);
      setUser(u);
    } catch {
      router.push('/login');
    }
    setChecking(false);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/login');
  };

  if (checking || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent" />
          <p className="mt-4 text-secondary-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full">
      <FinancialSidebar />
      <div className="flex flex-1 flex-col pl-72">
        <FinancialHeader
          userName={user.email ?? user.name ?? 'Usuário'}
          onLogout={handleLogout}
        />
        <main className="flex-1 bg-secondary-50/50 p-6">{children}</main>
      </div>
    </div>
  );
}
