'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { UserKPICards } from '@/components/admin/UserKPICards';
import { UserTable } from '@/components/admin/UserTable';
import { AddUserModal } from '@/components/admin/AddUserModal';
import { EditUserPanel } from '@/components/admin/EditUserPanel';
import { DeleteUserDialog } from '@/components/admin/DeleteUserDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { appendAudit } from '@/lib/audit';
import { hashPassword } from '@/lib/password';
import type { User, UserRole, UserStatus } from '@/lib/types';
import { getUsers, updateUser } from '@/lib/users';

type SortKey = 'newest' | 'az' | 'active';

export function UsersAdminPage() {
  const { user: current } = useAuth();
  const { toast } = useToast();
  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUserState, setDeleteUserState] = useState<User | null>(null);

  const allUsers = useMemo(() => {
    void tick;
    return getUsers();
  }, [tick]);

  const filtered = useMemo(() => {
    let list = [...allUsers];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q),
      );
    }
    if (roleFilter !== 'all') list = list.filter((u) => u.role === roleFilter);
    if (statusFilter !== 'all') list = list.filter((u) => u.status === statusFilter);

    if (sort === 'az') list.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
    else if (sort === 'active') list.sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());
    else list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return list;
  }, [allUsers, search, roleFilter, statusFilter, sort]);

  const refresh = () => setTick((t) => t + 1);
  const start = (page - 1) * pageSize;

  const exportCsv = () => {
    const headers = ['firstName', 'lastName', 'email', 'role', 'status', 'createdAt', 'lastActive'];
    const rows = filtered.map((u) =>
      headers.map((h) => JSON.stringify(String((u as unknown as Record<string, string>)[h] ?? ''))).join(','),
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `godmanager-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Export ready — file downloaded.', 'success');
  };

  const onResetPassword = (u: User) => {
    const np = `Reset${Math.random().toString(36).slice(2, 10)}!`;
    updateUser(u.id, { passwordHash: hashPassword(np) });
    appendAudit({
      adminId: current?.id ?? 'unknown',
      action: 'user.password_reset',
      targetUserId: u.id,
      details: `Password reset for ${u.email}`,
    });
    refresh();
    toast('Password reset email sent', 'info');
  };

  function handleQuickApprove(userId: string) {
    const result = updateUser(userId, { status: 'active' });
    if (!result) {
      toast('Falha ao aprovar utilizador.', 'error');
      return;
    }
    appendAudit({
      adminId: current?.id ?? 'unknown',
      action: 'user.approve',
      targetUserId: userId,
      details: `Approved pending user ${result.email}`,
    });
    refresh();
    toast('User approved.', 'success');
  }

  const onToggleSuspend = (u: User) => {
    if (u.id === current?.id) {
      toast('You cannot suspend your own account.', 'warning');
      return;
    }
    const next = u.status === 'suspended' ? 'active' : 'suspended';
    updateUser(u.id, { status: next });
    appendAudit({
      adminId: current?.id ?? 'unknown',
      action: next === 'suspended' ? 'user.suspend' : 'user.activate',
      targetUserId: u.id,
      details: `${u.email} → ${next}`,
    });
    refresh();
    toast(next === 'suspended' ? 'User suspended.' : 'User activated.', 'success');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-gm-ink">User Management</h1>
          <p className="mt-1 text-[13px] text-gm-ink-secondary">
            Provision accounts, enforce segregation of duties, and maintain a complete audit trail across your
            organization.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setAddOpen(true)} aria-label="Add user">
            + Add User
          </Button>
          <Button type="button" variant="outline" onClick={exportCsv} aria-label="Export CSV">
            Export CSV
          </Button>
        </div>
      </div>

      <UserKPICards users={allUsers} />

      <div className="flex flex-col gap-3 rounded-gm border border-gm-border bg-gm-paper p-4 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gm-ink-secondary" />
          <Input
            placeholder="Search by name, email or role…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10"
            aria-label="Search users"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value as typeof roleFilter);
            setPage(1);
          }}
          className="rounded-[10px] border border-gm-border bg-gm-cream px-4 py-3 text-sm text-gm-ink"
          aria-label="Filter by role"
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="accountant">Accountant</option>
          <option value="leasing">Leasing</option>
          <option value="maintenance">Maintenance</option>
          <option value="viewer">Viewer</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as typeof statusFilter);
            setPage(1);
          }}
          className="rounded-[10px] border border-gm-border bg-gm-cream px-4 py-3 text-sm text-gm-ink"
          aria-label="Filter by status"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="pending">Pending</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-[10px] border border-gm-border bg-gm-cream px-4 py-3 text-sm text-gm-ink"
          aria-label="Sort users"
        >
          <option value="newest">Newest first</option>
          <option value="az">A–Z</option>
          <option value="active">Last active</option>
        </select>
      </div>

      <UserTable
        users={filtered}
        page={page}
        pageSize={pageSize}
        onEdit={(u) => setEditUser(u)}
        onResetPassword={onResetPassword}
        onToggleSuspend={onToggleSuspend}
        onQuickApprove={handleQuickApprove}
        onDelete={(u) => {
          if (u.id === current?.id) {
            toast('You cannot delete your own account.', 'error');
            return;
          }
          setDeleteUserState(u);
        }}
      />

      {filtered.length > pageSize ? (
        <div className="flex justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={start + pageSize >= filtered.length}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Next page"
          >
            Next
          </Button>
        </div>
      ) : null}

      <AddUserModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(u) => {
          appendAudit({
            adminId: current?.id ?? 'unknown',
            action: 'user.create',
            targetUserId: u.id,
            details: `Created ${u.email}`,
          });
          refresh();
          toast('User created successfully', 'success');
        }}
      />

      <EditUserPanel
        user={editUser}
        open={!!editUser}
        onClose={() => setEditUser(null)}
        onSaved={() => {
          if (editUser) {
            appendAudit({
              adminId: current?.id ?? 'unknown',
              action: 'user.update',
              targetUserId: editUser.id,
              details: `Updated ${editUser.email}`,
            });
          }
          refresh();
          toast('User updated successfully', 'success');
        }}
      />

      <DeleteUserDialog
        user={deleteUserState}
        open={!!deleteUserState}
        onClose={() => setDeleteUserState(null)}
        onDeleted={() => {
          if (deleteUserState) {
            appendAudit({
              adminId: current?.id ?? 'unknown',
              action: 'user.delete',
              targetUserId: deleteUserState.id,
              details: `Deleted ${deleteUserState.email}`,
            });
          }
          refresh();
          toast('User removed from organization', 'success');
        }}
      />
    </div>
  );
}
