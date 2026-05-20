import { prisma } from '@/lib/db';

/**
 * Garante que o fornecedor pertence ao tenant (clientId) da sessão.
 */
export async function assertVendorBelongsToClient(
  vendorId: string,
  clientId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const vid = vendorId.trim();
  const cid = clientId.trim();
  if (!vid || !cid) {
    return { ok: false, status: 400, error: 'vendorId e clientId são obrigatórios.' };
  }

  const vendor = await prisma.pmVendor.findFirst({
    where: { id: vid, clientId: cid },
    select: { id: true },
  });
  if (!vendor) {
    return {
      ok: false,
      status: 403,
      error: 'Fornecedor não pertence a este cliente.',
    };
  }
  return { ok: true };
}
