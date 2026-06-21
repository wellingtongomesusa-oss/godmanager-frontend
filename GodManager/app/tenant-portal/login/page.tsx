import { redirect } from 'next/navigation';
import { getCurrentUserFromSession } from '@/lib/authServer';
import LoginClient from './LoginClient';

export const dynamic = 'force-dynamic';

export default async function TenantLoginPage() {
  const user = await getCurrentUserFromSession();
  if (user) {
    if (user.role === 'tenant' || user.role === 'super_admin') {
      redirect('/tenant-portal');
    }
    redirect('/manager-pro');
  }
  return <LoginClient />;
}
