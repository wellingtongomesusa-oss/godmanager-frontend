import { redirect } from 'next/navigation';
import { getCurrentUserFromSession } from '@/lib/authServer';
import LoginClient from './LoginClient';

export const dynamic = 'force-dynamic';

export default async function OwnerLoginPage() {
  const user = await getCurrentUserFromSession();
  if (user) {
    if (user.role === 'owner' || user.role === 'super_admin') {
      redirect('/owner-portal');
    }
    redirect('/manager-pro');
  }
  return <LoginClient />;
}
