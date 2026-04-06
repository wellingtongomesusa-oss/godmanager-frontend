import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminMobileNav } from '@/components/layout/AdminMobileNav';
import { GodManagerWatermark } from '@/components/layout/GodManagerWatermark';
import { MainSidebar } from '@/components/layout/MainSidebar';
import { TopBar } from '@/components/layout/TopBar';

export function PlatformShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="godmanager-platform relative min-h-screen">
      <GodManagerWatermark />
      <ProtectedRoute>
        <MainSidebar />
        <div className="relative z-10 flex min-h-screen flex-col lg:pl-[240px]">
          <TopBar />
          <main className="min-h-[calc(100vh-54px)] flex-1 px-4 py-8 pb-24 sm:px-6 lg:px-8 lg:pb-10">{children}</main>
        </div>
        <AdminMobileNav />
      </ProtectedRoute>
    </div>
  );
}
