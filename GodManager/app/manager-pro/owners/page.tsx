'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/manager-pro/auth';
import OwnersClient from './OwnersClient';

export default function OwnersPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace('/manager-pro/login');
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="p-8 text-sm text-neutral-500">Loading…</div>
    );
  }

  return <OwnersClient />;
}
