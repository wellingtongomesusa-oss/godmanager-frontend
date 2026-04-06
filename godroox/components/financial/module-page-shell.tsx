'use client';

interface ModulePageShellProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function ModulePageShell({ title, description, children }: ModulePageShellProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">{title}</h1>
        {description && (
          <p className="mt-1 text-secondary-600">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}
