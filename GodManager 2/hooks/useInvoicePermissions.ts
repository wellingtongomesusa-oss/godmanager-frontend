'use client';

import { useMemo } from 'react';
import { getSession } from '@/lib/manager-pro/auth';
import {
  listPermissionsForInvoice,
  userIdFromSession,
  type InvoicePermissionRole,
} from '@/lib/manager-pro/invoicePermissionsStore';

export type InvoicePermissionFlags = {
  isPrimary: boolean;
  canView: boolean;
  canEdit: boolean;
  canSend: boolean;
  canApprove: boolean;
  canDelete: boolean;
  canInvite: boolean;
  role: InvoicePermissionRole | 'primary' | 'none';
};

/**
 * Permissões do utilizador atual sobre uma fatura. Primary: acesso total.
 * Colaboradores: conforme linha em invoice_permissions (mock localStorage).
 */
export function useInvoicePermissions(invoiceId: string | null): InvoicePermissionFlags {
  return useMemo(() => {
    const session = getSession();
    if (!session) {
      return {
        isPrimary: false,
        canView: false,
        canEdit: false,
        canSend: false,
        canApprove: false,
        canDelete: false,
        canInvite: false,
        role: 'none',
      };
    }

    const uid = userIdFromSession(session);
    const isPrimary =
      session.role === 'admin' || session.role === 'primary' || session.role === undefined;

    if (!invoiceId) {
      return {
        isPrimary,
        canView: true,
        canEdit: isPrimary,
        canSend: isPrimary,
        canApprove: isPrimary,
        canDelete: isPrimary,
        canInvite: isPrimary,
        role: isPrimary ? 'primary' : 'none',
      };
    }

    if (isPrimary) {
      return {
        isPrimary: true,
        canView: true,
        canEdit: true,
        canSend: true,
        canApprove: true,
        canDelete: true,
        canInvite: true,
        role: 'primary',
      };
    }

    const rows = listPermissionsForInvoice(invoiceId);
    const mine = rows.find((r) => r.userId === uid);
    const role = mine?.role ?? 'viewer';

    return {
      isPrimary: false,
      canView: !!mine,
      canEdit: role === 'editor' || role === 'approver',
      canSend: role === 'sender' || role === 'approver',
      canApprove: role === 'approver',
      canDelete: false,
      canInvite: false,
      role: mine ? role : 'none',
    };
  }, [invoiceId]);
}
