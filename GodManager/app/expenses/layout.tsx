import { redirect } from 'next/navigation';
import { getCurrentUserFromSession } from '@/lib/authServer';

export default async function ExpensesLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    redirect('/login?from=/expenses');
  }
  return <>{children}</>;
}
