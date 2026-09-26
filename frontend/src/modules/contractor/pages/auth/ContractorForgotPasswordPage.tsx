import { useState } from 'react';
import { supabase } from '@/core/supabase/client';

export default function ContractorForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setBusy(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      console.error('Password reset error:', err);
      // For user privacy/demo, show confirmation message
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <h1 className="text-xl font-bold font-display text-white">Reset Contractor Password</h1>
        <p className="text-xs text-slate-400 mt-1">
          Enter your registered contractor email to receive reset instructions
        </p>

        {sent ? (
          <div className="mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300">
            <p className="font-semibold mb-1">Check your inbox</p>
            <p className="text-[11px] text-emerald-200/80">
              If an active contractor account is associated with <span className="text-white font-mono">{email}</span>, a secure password reset link has been dispatched.
            </p>
            <div className="mt-4">
              <a href="/contractor/login" className="inline-block text-xs font-semibold text-blue-400 hover:underline">
                Back to Sign In
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {errorMsg && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                {errorMsg}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Corporate Email Address
              </label>
              <input
                type="email"
                required
                placeholder="contractor@infra.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-3.5 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {busy ? 'Sending Reset Instructions...' : 'Send Password Reset Link'}
            </button>
            <div className="pt-2 text-center">
              <a href="/contractor/login" className="text-xs text-slate-400 hover:text-slate-200">
                Return to Login
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
