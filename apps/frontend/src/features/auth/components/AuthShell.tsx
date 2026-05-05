import { type ReactNode } from 'react';

interface AuthShellProps {
  children: ReactNode;
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-md md:p-0">
      <div className="w-full max-w-[400px]">
        {children}
      </div>
    </main>
  );
}
