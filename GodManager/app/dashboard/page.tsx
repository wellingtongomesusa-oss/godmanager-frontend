import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getPostLoginUrlForProductType } from '@/lib/productRoutes';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getCurrentUserFromSession();
  if (!user) {
    redirect('/login?from=/dashboard');
  }

  const client =
    user.clientId != null
      ? await prisma.client.findUnique({
          where: { id: user.clientId },
          select: { productType: true },
        })
      : null;

  const url = getPostLoginUrlForProductType(client?.productType);
  redirect(url);
}
