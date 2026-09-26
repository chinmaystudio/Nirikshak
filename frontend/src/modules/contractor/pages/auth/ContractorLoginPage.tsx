import { useState } from 'react';
import { AuthService } from '@/core/auth/auth.service';
import { navigate } from '../../lib/router';
import { useAuth } from '@/core/auth/useAuth';

export default function ContractorLoginPage() {
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isDev = true;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg('Please enter your registered contractor email and password.');
      return;
    }

    setBusy(true);
    setErrorMsg(null);

    try {
      await AuthService.signIn(email.trim(), password);
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Contractor login error:', err);
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setBusy(false);
    }
  }

  function fillDemo() {
    setEmail('contractor.test@nirikshak.local');
    setPassword('NirikshakContractor#2026');
    setErrorMsg(null);
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center p-4"
      style={{ backgroundColor: '#f8fafc', color: '#0f172a' }}
    >
      <div className="w-full max-w-md">
        {/* Brand Header — Exact same lockup as Government Portal */}
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img
            src="/logo/nirikshak-logo.png"
            alt="NIRIKSHAK"
            className="h-12 w-auto object-contain"
            width={1937}
            height={532}
          />
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Transparent Projects • Stronger India
          </p>
        </div>

        {/* Card — Exact same institutional card as Government Portal */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-sm">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 font-display">
            Contractor Sign-In
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Official NIRIKSHAK Contractor Execution Portal
          </p>

          {errorMsg && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px] text-red-600 shrink-0 mt-0.5">
                error
              </span>
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="block text-xs font-semibold text-slate-700">
                Contractor Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span
                  className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[19px] text-slate-400"
                  aria-hidden="true"
                >
                  mail
                </span>
                <input
                  type="email"
                  required
                  placeholder="contractor@infra.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:border-[#1e40af] transition-colors"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="block text-xs font-semibold text-slate-700">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span
                  className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[19px] text-slate-400"
                  aria-hidden="true"
                >
                  lock
                </span>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:border-[#1e40af] transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-0.5">
              <label className="flex items-center gap-2 text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#1e40af] focus:ring-[#1e40af]"
                />
                <span>Remember me</span>
              </label>
              <a
                href="/contractor/forgot-password"
                className="text-xs font-medium text-[#1e40af] hover:text-[#1d4ed8] hover:underline"
              >
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#1e40af] text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#1d4ed8] disabled:opacity-50 cursor-pointer"
            >
              {busy ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">login</span>
                  <span>Sign In to Portal</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-xs sm:text-sm">
            <span className="text-slate-500">New contractor agency?</span>
            <a
              href="/contractor/register"
              className="font-medium text-[#1e40af] hover:text-[#1d4ed8] hover:underline"
            >
              Apply for Onboarding
            </a>
          </div>

          {/* Dev Demo Credentials Box — Identical to Government */}
          {isDev && (
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <span className="material-symbols-outlined text-[14px] text-amber-600">
                    terminal
                  </span>
                  Demo Credentials (Dev Only)
                </span>
                <button
                  type="button"
                  onClick={fillDemo}
                  className="cursor-pointer rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-[#1e40af] hover:underline"
                >
                  Fill Demo
                </button>
              </div>
              <div className="space-y-0.5 font-mono text-[11px] text-slate-500">
                <div>
                  Email: <span className="font-medium text-slate-800">contractor.test@nirikshak.local</span>
                </div>
                <div>
                  Password: <span className="font-medium text-slate-800">NirikshakContractor#2026</span>
                </div>
                <div>
                  Role: <span className="font-medium text-slate-800">contractor (Infrastructure Partner)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Security Note & Portal Switcher — Matching Government Portal */}
        <p className="mt-6 text-center text-xs text-slate-500">
          Official Infrastructure Monitoring &amp; Verification Network • Authorized Personnel Only
        </p>

        <div className="mt-3 text-center text-xs text-slate-400 space-x-3">
          <a href="/government" className="hover:text-slate-600 transition-colors">
            Government Portal
          </a>
          <span>•</span>
          <a href="/" className="hover:text-slate-600 transition-colors">
            Citizen Public Audit
          </a>
        </div>
      </div>
    </div>
  );
}
