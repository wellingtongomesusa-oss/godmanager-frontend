/**
 * Logs Service – trilha de auditoria para Bills Approval e demais módulos.
 * Registra: ação, usuário, IP, timestamp. Em produção persistir em BD/ELK.
 */

export type LogAction =
  | 'bill.created'
  | 'bill.reviewed'
  | 'bill.approved_l1'
  | 'bill.approved_l2'
  | 'bill.rejected'
  | 'bill.scheduled'
  | 'bill.paid'
  | 'bill.viewed'
  | 'bill.ocr_processed'
  | 'bill.webhook_received';

export interface AuditLogEntry {
  id: string;
  action: LogAction;
  entityType: string;
  entityId: string;
  userId: string;
  userEmail: string;
  ip: string;
  userAgent: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

const store: AuditLogEntry[] = [];

function generateId(): string {
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Registra um evento de auditoria. Em cliente (browser) o IP pode vir de header ou API.
 */
export function logAudit(params: {
  action: LogAction;
  entityType: string;
  entityId: string;
  userId: string;
  userEmail: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: generateId(),
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    userId: params.userId,
    userEmail: params.userEmail,
    ip: params.ip ?? '0.0.0.0',
    userAgent: params.userAgent ?? '',
    timestamp: new Date().toISOString(),
    metadata: params.metadata,
  };
  store.push(entry);
  return entry;
}

/**
 * Retorna logs de um entidade (ex: um bill).
 */
export function getLogsByEntity(entityType: string, entityId: string): AuditLogEntry[] {
  return store
    .filter((e) => e.entityType === entityType && e.entityId === entityId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Retorna todos os logs (para relatórios). Opcionalmente por ação ou usuário.
 */
export function getAllLogs(filters?: {
  action?: LogAction;
  userId?: string;
  entityId?: string;
  limit?: number;
}): AuditLogEntry[] {
  let list = [...store].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  if (filters?.action) list = list.filter((e) => e.action === filters.action);
  if (filters?.userId) list = list.filter((e) => e.userId === filters.userId);
  if (filters?.entityId) list = list.filter((e) => e.entityId === filters.entityId);
  const limit = filters?.limit ?? 500;
  return list.slice(0, limit);
}
