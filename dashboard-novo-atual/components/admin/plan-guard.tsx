'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePlan } from '@/contexts/plan-context';
import { getMinPlanForPath } from '@/lib/plans';

export function PlanGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { plan } = usePlan();
  const [allowed, setAllowed] = useState<boolean>(true);

  useEffect(() => {
    if (!pathname) {
      setAllowed(true);
      return;
    }
    const min = getMinPlanForPath(pathname);
    if (min === 0) {
      setAllowed(true);
      return;
    }
    if (plan < min) {
      router.replace('/admin/painel');
      setAllowed(false);
      return;
    }
    setAllowed(true);
  }, [pathname, plan, router]);

  if (allowed === false) return null;
  return <>{children}</>;
}
