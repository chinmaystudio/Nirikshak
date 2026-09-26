import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import type { AppRole } from './auth.types';

export function AccessDeniedPage({
  currentRole,
  allowedRoles,
}: {
  currentRole: AppRole | null;
  allowedRoles: AppRole[];
}) {
  const getPortalHome = (role: AppRole | null) => {
    if (role && (role.startsWith('government') || role === 'chief_engineer' || role === 'project_officer' || role === 'auditor')) {
      return '/government/dashboard';
    }
    if (role && role.startsWith('contractor')) {
      return '/contractor/dashboard';
    }
    return '/';
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 p-6 sm:p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center">
          <ShieldAlert className="w-8 h-8" />
        </div>
        
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            Access Restricted
          </h2>
          <p className="text-xs uppercase tracking-wider font-semibold text-red-600 dark:text-red-400">
            Role Authorization Required
          </p>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Your current authenticated profile is registered as{' '}
          <strong className="font-bold text-slate-800 dark:text-slate-200">
            {currentRole || 'Guest'}
          </strong>
          . This portal requires one of the following official authorizations:
        </p>

        <div className="flex flex-wrap justify-center gap-1.5 py-2">
          {allowedRoles.map((r) => (
            <span
              key={r}
              className="text-[11px] font-semibold px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
            >
              {r.replace(/_/g, ' ')}
            </span>
          ))}
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-center gap-2">
          <a
            href={getPortalHome(currentRole)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Home className="w-4 h-4" />
            My Authorized Portal
          </a>
          <button
            onClick={() => window.history.back()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
