'use client';

import React, { useState } from 'react';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminHeader } from '@/components/admin/admin-header';
import { PlanGuard } from '@/components/admin/plan-guard';
import { UploadBar } from '@/components/UploadBar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full min-w-0 bg-secondary-50/30 overflow-x-hidden">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col w-full lg:pl-64">
        <AdminHeader userName="Admin" onMenuToggle={() => setSidebarOpen(true)} />
        <UploadBar />
        <main className="min-h-0 flex-1 px-4 py-4 sm:py-6 sm:px-6 lg:px-8 min-w-0">
          <div className="mx-auto w-full max-w-7xl">
            <PlanGuard>{children}</PlanGuard>
          </div>
        </main>
      </div>
    </div>
  );
}
