'use client';

import Link from 'next/link';
import LogoutButton from './LogoutButton';

interface Props {
  userName: string;
  subtitle?: string;
  rightLabel?: string;
  rightValue?: string;
  showBack?: boolean;
}

export default function OwnerPortalHeader({
  userName,
  subtitle,
  rightLabel,
  rightValue,
  showBack = false,
}: Props) {
  return (
    <div className="bg-gm-sidebar text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
        <div className="flex min-w-0 items-center gap-4">
          {showBack ? (
            <Link
              href="/owner-portal"
              className="flex items-center gap-1 rounded-md border border-white/25 px-3 py-1.5 text-xs transition hover:bg-white/10"
              aria-label="Voltar para lista de propriedades"
            >
              Voltar
            </Link>
          ) : null}
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-gm-amber">
              Manager Prop
            </p>
            <h1 className="mt-0.5 truncate font-heading text-lg font-bold">
              Portal do Proprietario
            </h1>
            {subtitle ? (
              <p className="mt-0.5 truncate text-xs text-white/70">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          {rightLabel && rightValue ? (
            <div className="hidden text-right sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gm-amber">
                {rightLabel}
              </p>
              <p className="text-sm font-medium">{rightValue}</p>
            </div>
          ) : null}
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
