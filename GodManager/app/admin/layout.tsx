import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <ProtectedRoute>
        <main className="min-h-screen">{children}</main>
      </ProtectedRoute>
    </div>
  );
}
