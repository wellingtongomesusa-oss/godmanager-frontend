import { GodManagerLogo } from '@/components/layout/GodManagerLogo';
import { GodManagerWatermark } from '@/components/layout/GodManagerWatermark';
import { RegisterForm } from '@/components/auth/RegisterForm';

export default function RegisterPage() {
  return (
    <div className="godmanager-platform relative flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <GodManagerWatermark />
      <div className="relative z-10 w-full max-w-lg">
        <div className="mb-10 flex justify-center">
          <GodManagerLogo size="md" surface="light" />
        </div>
        <div className="rounded-gm-lg border border-gm-border bg-gm-paper p-8 shadow-gm-card">
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}
