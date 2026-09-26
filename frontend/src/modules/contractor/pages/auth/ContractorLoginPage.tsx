import { useState } from 'react';
import { AuthService } from '@/core/auth/auth.service';
import { navigate } from '../../lib/router';
import { useAuth } from '@/core/auth/useAuth';

export default function ContractorLoginPage() {
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isDev = !import.meta.env.PROD || import.meta.env.VITE_SHOW_DEMO_CREDENTIALS === 'true';

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
    <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/30 text-blue-400 mb-4 shadow-lg shadow-blue-500/10">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-white">NIRIKSHAK</h1>
          <p className="text-xs font-semibold tracking-wider uppercase text-blue-400 mt-1">Contractor Execution Portal</p>
          <p className="text-xs text-slate-400 mt-1">Sign in to manage bids, awarded projects, and milestone progress</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
          {errorMsg && (
            <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-400 flex items-start gap-2">
              <span className="shrink-0 mt-0.5 font-bold">⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Contractor Email Address
              </label>
              <input
                type="email"
                required
                placeholder="contractor@infra.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-3.5 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Portal Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 px-3.5 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                autoComplete="current-password"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500" />
                <span>Remember session</span>
              </label>
              <a
                href="#/forgot-password"
                className="text-xs text-blue-400 hover:text-blue-300 hover:underline"
              >
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full h-11 mt-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {busy ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                'Sign In to Contractor Portal'
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Unregistered agency?</span>
            <a href="#/register" className="font-semibold text-blue-400 hover:text-blue-300 hover:underline">
              Apply for Onboarding
            </a>
          </div>

          {/* Dev Demo Accounts Box */}
          {isDev && (
            <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 text-xs text-slate-400">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Demo Account (Development)
                </span>
                <button
                  type="button"
                  onClick={fillDemo}
                  className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 bg-blue-950/60 border border-blue-800/60 px-2 py-0.5 rounded cursor-pointer"
                >
                  Fill Demo
                </button>
              </div>
              <div className="font-mono text-[11px] text-slate-400 space-y-0.5">
                <div>Email: <span className="text-slate-200">contractor.test@nirikshak.local</span></div>
                <div>Pass: <span className="text-slate-200">NirikshakContractor#2026</span></div>
                <div>Org: <span className="text-slate-200">Nirikshak Test Infrastructure Pvt Ltd</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Link back to Citizens / Government */}
        <div className="text-center mt-6 text-xs text-slate-500 space-x-4">
          <a href="/government" className="hover:text-slate-300 transition-colors">Government Portal</a>
          <span>•</span>
          <a href="/" className="hover:text-slate-300 transition-colors">Citizen Public Audit</a>
        </div>
      </div>
    </div>
  );
}
