'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const user = localStorage.getItem('user');
    try {
      const u = user ? JSON.parse(user) : null;
      if (u?.role === 'admin') {
        router.replace('/dashboard');
        return;
      }
    } catch {
      // invalid JSON
    }
    router.replace('/login');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-charcoal">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-500 border-r-transparent" />
        <p className="mt-4 text-brand-muted">Redirecionando...</p>
      </div>
    </div>
  );
}
