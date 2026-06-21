'use client';

import LogoutButton from './LogoutButton';

interface Props {
  userName: string;
  subtitle?: string;
}

export default function TenantPortalHeader({ userName, subtitle }: Props) {
  return (
    <div className="bg-gm-sidebar text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-gm-amber">
            Manager Prop
          </p>
          <h1 className="mt-0.5 truncate font-heading text-lg font-bold">
            Portal do Inquilino
          </h1>
          {subtitle ? (
            <p className="mt-0.5 truncate text-xs text-white/70">{subtitle}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <div className="hidden text-right md:block">
            <p className="text-[10px] uppercase tracking-wider text-white/60">
              Logado como
            </p>
            <p className="max-w-[200px] truncate text-sm font-medium">{userName}</p>
          </div>
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
