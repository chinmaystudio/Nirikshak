import type { ReactNode } from 'react';
import { useAuthContext } from './AuthProvider';

export function ProtectedRoute({
  children,
  redirectTo = '/login',
}: {
  children: ReactNode;
  redirectTo?: string;
}) {
  const { session, loading } = useAuthContext();

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 p-8">
        <div className="w-8 h-8 rounded-full border-3 border-blue-600 border-t-transparent animate-spin" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Verifying security clearance…
        </span>
      </div>
    );
  }

  if (!session) {
    if (typeof window !== 'undefined') {
      window.location.href = redirectTo;
    }
    return null;
  }

  return <>{children}</>;
}
