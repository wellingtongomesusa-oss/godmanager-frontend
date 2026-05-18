import Link from 'next/link';
import { DesignStudioLogout } from '@/components/design/DesignStudioLogout';

export default function DesignLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--sand)] text-[var(--ink)]">
      <header
        className="flex h-[54px] items-center justify-between border-b border-[var(--border)] bg-[rgba(248,246,242,0.95)] px-6 backdrop-blur-[16px]"
        style={{ WebkitFontSmoothing: 'antialiased' as const }}
      >
        <Link
          href="/design"
          className="font-[family-name:var(--font-dm)] text-sm font-semibold tracking-tight text-[var(--ink)]"
        >
          GodManager — Design Studio
        </Link>
        <DesignStudioLogout />
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </div>
  );
}
