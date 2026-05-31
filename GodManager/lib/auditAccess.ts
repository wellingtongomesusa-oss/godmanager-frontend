/** Roles allowed to read audit log (GET /api/audit, /api/audit/facets). */
const AUDIT_VIEW_ROLES = new Set(['admin', 'manager', 'super_admin']);

export function canViewAuditLog(role: string | null | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return AUDIT_VIEW_ROLES.has(r);
}
