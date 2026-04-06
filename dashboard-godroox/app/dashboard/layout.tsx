'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminSidebar, AdminHeader } from '@/components/admin';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<{ email?: string; name?: string } | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setChecking(false);
      return;
    }
    const masterSession = localStorage.getItem('masterSession');
    const stored = localStorage.getItem('user');
    if (!masterSession || !stored) {
      setChecking(false);
      router.replace('/login');
      return;
    }
    try {
      const u = JSON.parse(stored);
      if (u?.role !== 'admin') {
        setChecking(false);
        router.replace('/login');
        return;
      }
      setUser(u);
    } catch {
      router.replace('/login');
    }
    setChecking(false);
  }, [router]);

  useEffect(() => {
    if (typeof document !== 'undefined') document.title = 'Dashboard Godroox';
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('masterSession');
    router.replace('/login');
  };

  if (checking || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-dark">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-500 border-r-transparent" />
          <p className="mt-4 text-brand-muted">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-brand-charcoal">
      <AdminSidebar />
      <div className="flex flex-1 flex-col pl-64">
        <AdminHeader userName={user.email ?? user.name ?? 'Admin'} onLogout={handleLogout} />
        <main className="flex-1 bg-brand-charcoal p-6">{children}</main>
      </div>
    </div>
  );
}
