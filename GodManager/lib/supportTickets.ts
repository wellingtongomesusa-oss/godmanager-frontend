import type { PrismaClient } from '@prisma/client';
import { PORTAL_ROLES } from '@/lib/clientPlanLimits';

type SupportTicketDb = Pick<PrismaClient, 'supportTicket'>;

function formatDateSuffix(dateRef: Date): string {
  const d = String(dateRef.getDate()).padStart(2, '0');
  const m = String(dateRef.getMonth() + 1).padStart(2, '0');
  const y = String(dateRef.getFullYear());
  return `${d}${m}${y}`;
}

export function isStaffUser(user: { role: string }): boolean {
  return !(PORTAL_ROLES as readonly string[]).includes(user.role);
}

export function supportTicketUserDisplayName(user: {
  firstName: string;
  lastName: string;
  email: string;
}): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email || 'Unknown';
}

/**
 * GM0001-DDMMYYYY — sequência incremental por dia (sufixo global por data).
 */
export async function genTicketCode(db: SupportTicketDb, dateRef?: Date): Promise<string> {
  const ref = dateRef ?? new Date();
  const endsWith = `-${formatDateSuffix(ref)}`;

  const baseCount = await db.supportTicket.count({
    where: { code: { endsWith } },
  });

  for (let attempt = 0; attempt < 5; attempt++) {
    const seq = baseCount + 1 + attempt;
    const code = `GM${String(seq).padStart(4, '0')}${endsWith}`;
    const existing = await db.supportTicket.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!existing) return code;
  }

  throw new Error('Failed to allocate support ticket code');
}

export const SUPPORT_TICKET_STATUSES = [
  'open',
  'in_progress',
  'answered',
  'resolved',
  'closed',
] as const;

export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];

export function isAllowedTicketStatus(value: string): value is SupportTicketStatus {
  return (SUPPORT_TICKET_STATUSES as readonly string[]).includes(value);
}
