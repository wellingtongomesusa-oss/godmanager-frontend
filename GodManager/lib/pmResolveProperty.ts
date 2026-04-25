import { prisma } from '@/lib/db';

export async function resolvePropertyId(
  codeOrId: string | undefined | null
): Promise<{ id: string; code: string } | null> {
  if (!codeOrId || !String(codeOrId).trim()) return null;
  const s = String(codeOrId).trim();
  const byId = await prisma.property.findFirst({
    where: { OR: [{ id: s }, { code: s }] },
    select: { id: true, code: true },
  });
  return byId;
}
