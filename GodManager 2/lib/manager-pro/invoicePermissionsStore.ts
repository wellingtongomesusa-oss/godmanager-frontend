import { getSession, type ManagerProSession } from '@/lib/manager-pro/auth';

const LS = 'invoice_permissions_v1';

export type InvoicePermissionRole = 'viewer' | 'editor' | 'sender' | 'approver';

export type InvoicePermissionRow = {
  invoiceId: string;
  userId: string;
  email: string;
  role: InvoicePermissionRole;
};

function readAll(): InvoicePermissionRow[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as InvoicePermissionRow[]) : [];
  } catch {
    return [];
  }
}

function writeAll(rows: InvoicePermissionRow[]) {
  localStorage.setItem(LS, JSON.stringify(rows));
}

export function listPermissionsForInvoice(invoiceId: string): InvoicePermissionRow[] {
  return readAll().filter((r) => r.invoiceId === invoiceId);
}

export function setPermission(row: InvoicePermissionRow): void {
  const rest = readAll().filter(
    (r) => !(r.invoiceId === row.invoiceId && r.userId === row.userId),
  );
  writeAll([...rest, row]);
}

export function removePermission(invoiceId: string, userId: string): void {
  writeAll(readAll().filter((r) => !(r.invoiceId === invoiceId && r.userId === userId)));
}

export function userIdFromSession(s: ManagerProSession | null): string {
  return s?.email?.toLowerCase().trim() ?? 'anon';
}

/** Colaborador só vê faturas com linha de permissão; admin/primary veem todas. */
export function canUserViewInvoice(invoiceId: string): boolean {
  if (typeof window === 'undefined') return true;
  const s = getSession();
  if (!s) return false;
  if (s.role !== 'collaborator') return true;
  const uid = userIdFromSession(s);
  return listPermissionsForInvoice(invoiceId).some((r) => r.userId === uid);
}
