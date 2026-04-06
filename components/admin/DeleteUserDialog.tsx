'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import type { User } from '@/lib/types';
import { deleteUser } from '@/lib/users';

export function DeleteUserDialog({
  user,
  open,
  onClose,
  onDeleted,
}: {
  user: User | null;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirm, setConfirm] = useState('');

  useEffect(() => {
    if (!open) setConfirm('');
  }, [open, user?.id]);

  if (!user) return null;

  const match = confirm.trim().toLowerCase() === user.email.toLowerCase();

  const del = () => {
    if (!match) return;
    deleteUser(user.id);
    setConfirm('');
    onDeleted();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="" showClose className="max-w-[400px]">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gm-red/15">
          <AlertTriangle className="h-8 w-8 text-gm-red" aria-hidden />
        </div>
        <h2 className="mt-4 font-heading text-xl font-semibold text-gm-ink">Delete User</h2>
        <p className="mt-2 text-sm text-gm-ink-secondary">
          Are you sure you want to delete <strong className="text-gm-ink">{user.firstName} {user.lastName}</strong>
          ? This action cannot be undone. All associated data will be permanently removed.
        </p>
        <div className="mt-6 text-left">
          <label htmlFor="delete-confirm-email" className="mb-1 block text-xs font-medium text-gm-ink-secondary">
            Type the user&apos;s email to confirm
          </label>
          <Input
            id="delete-confirm-email"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={user.email}
            autoComplete="off"
          />
        </div>
        <div className="mt-6 flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="danger" className="flex-1" disabled={!match} onClick={del}>
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  );
}
