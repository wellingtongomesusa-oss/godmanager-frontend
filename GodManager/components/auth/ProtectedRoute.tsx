'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { Skeleton } from '@/components/ui/skeleton';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="godmanager-platform flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-64 w-full max-w-md" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
