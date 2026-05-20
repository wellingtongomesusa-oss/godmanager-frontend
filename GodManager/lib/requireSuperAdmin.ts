import { getCurrentUserFromSession } from '@/lib/authServer';

type SessionUser = NonNullable<Awaited<ReturnType<typeof getCurrentUserFromSession>>>;

export async function requireSuperAdmin(): Promise<
  { error: string; status: number; user: null } | { error: null; status: number; user: SessionUser }
> {
  const user = await getCurrentUserFromSession();
  if (!user) return { error: 'Nao autenticado', status: 401, user: null };
  if (user.role !== 'super_admin') {
    return { error: 'Acesso negado. Apenas super administrador da plataforma.', status: 403, user: null };
  }
  return { error: null, status: 200, user };
}
