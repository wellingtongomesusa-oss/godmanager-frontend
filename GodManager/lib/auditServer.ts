import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export type RecordAuditInput = {
  request?: NextRequest | Request;
  actor?: { id?: string | null; email?: string | null };
  action: string;
  entity: string;
  entityId?: string | null;
  targetUserId?: string | null;
  details?: string;
  clientId?: string | null;
};

function requestIp(request: NextRequest | Request | undefined): string | null {
  if (!request) return null;
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null
  );
}

function requestUserAgent(request: NextRequest | Request | undefined): string | null {
  if (!request) return null;
  const ua = request.headers.get('user-agent');
  return ua ? ua.slice(0, 400) : null;
}

function clampDetails(raw: string | undefined): string {
  const s = raw ?? '';
  if (s.length <= 4000) return s;
  return s.slice(0, 4000);
}

/**
 * Persists an audit_entries row. Never throws — failures are logged only.
 */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    await prisma.auditEntry.create({
      data: {
        actorId: input.actor?.id ?? null,
        actorEmail: input.actor?.email ?? null,
        action: String(input.action || '').trim().slice(0, 80),
        entity: String(input.entity || '').trim().slice(0, 80),
        entityId:
          input.entityId != null && String(input.entityId).trim() !== ''
            ? String(input.entityId).trim().slice(0, 200)
            : null,
        targetUserId: input.targetUserId ?? null,
        details: clampDetails(input.details),
        ip: requestIp(input.request),
        userAgent: requestUserAgent(input.request),
        clientId: input.clientId ?? null,
      },
    });
  } catch (err) {
    console.error('[audit]', err);
  }
}
