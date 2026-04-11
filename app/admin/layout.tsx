import { PlatformShell } from '@/components/layout/PlatformShell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <PlatformShell>{children}</PlatformShell>;
}
