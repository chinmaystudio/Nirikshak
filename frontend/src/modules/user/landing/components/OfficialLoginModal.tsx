import React, { useState } from 'react';
import { X, ShieldCheck, Lock, ArrowRight, Building, HardHat, CheckCircle2, AlertCircle } from 'lucide-react';
import { AuthService } from '@/core/auth/auth.service';

interface OfficialLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRole?: 'officer' | 'contractor';
}

export const OfficialLoginModal: React.FC<OfficialLoginModalProps> = ({
  isOpen,
  onClose,
  initialRole = 'officer'
}) => {
  if (!isOpen) return null;

  const [role, setRole] = useState<'officer' | 'contractor'>(initialRole);
  const [officerId, setOfficerId] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fillDemoCredentials = () => {
    if (role === 'officer') {
      setOfficerId('government.test@nirikshak.local');
      setPassword('NirikshakGov#2026');
    } else {
      setOfficerId('contractor.test@nirikshak.local');
      setPassword('NirikshakContractor#2026');
    }
    setErrorMsg(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officerId.trim() || !password) {
      setErrorMsg('Please enter both your registered ID/email and security password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await AuthService.signIn(officerId.trim(), password);
      setLoginSuccess(true);
      setTimeout(() => {
        onClose();
        if (role === 'officer') {
          window.location.href = '/government/dashboard';
        } else {
          window.location.href = '/contractor/dashboard';
        }
      }, 700);
    } catch (err: any) {
      console.error('Portal login error:', err);
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="official-login-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        id="official-login-modal-container"
        className="bg-white backdrop-blur-2xl w-full max-w-lg rounded-3xl shadow-2xl border border-black/10 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 text-neutral-900"
      >
        <div className="bg-amber-500/10 border-b border-black/10 p-6 sm:p-8 relative">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 border border-black/10 text-neutral-900 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
            aria-label="Close login dialog"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-900 text-[11px] font-bold uppercase tracking-wider mb-3 shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
            <span>National Single Sign-On</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-black">
            Official PRAGATI Portal
          </h2>
          <p className="text-xs text-neutral-800 font-medium mt-1">
            Secure multi-factor authentication for public project governance.
          </p>
        </div>

        <div className="p-6 sm:p-8">
          {loginSuccess ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 bg-emerald-500/20 text-emerald-700 border border-emerald-400/40 rounded-full mx-auto flex items-center justify-center shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-black font-display">
                Authentication Confirmed
              </h3>
              <p className="text-xs text-neutral-800 font-medium max-w-sm mx-auto">
                Welcome back. Loading your encrypted project governance workspace.
              </p>
              <button
                onClick={() => {
                  setLoginSuccess(false);
                  onClose();
                  if (role === 'officer') {
                    window.location.href = '/government/dashboard';
                  } else {
                    window.location.href = '/contractor/dashboard';
                  }
                }}
                className="px-6 py-2.5 rounded-full bg-[#eefc55] border border-[#d6e838] text-neutral-950 text-xs font-bold shadow-md hover:bg-[#e2f23e] cursor-pointer"
              >
                {role === 'officer' ? 'Enter Government Portal' : 'Enter Contractor Portal'}
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 mb-4 p-1 bg-black/5 rounded-2xl border border-black/10">
                <button
                  type="button"
                  id="tab-role-officer"
                  onClick={() => { setRole('officer'); setErrorMsg(null); }}
                  className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    role === 'officer'
                      ? 'bg-[#eefc55] text-neutral-950 shadow-md border border-[#d6e838]'
                      : 'text-neutral-700 hover:text-black'
                  }`}
                >
                  <Building className="w-4 h-4 text-amber-600" />
                  <span>Government Officer</span>
                </button>

                <button
                  type="button"
                  id="tab-role-contractor"
                  onClick={() => { setRole('contractor'); setErrorMsg(null); }}
                  className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    role === 'contractor'
                      ? 'bg-[#eefc55] text-neutral-950 shadow-md border border-[#d6e838]'
                      : 'text-neutral-700 hover:text-black'
                  }`}
                >
                  <HardHat className="w-4 h-4 text-amber-600" />
                  <span>Contractor</span>
                </button>
              </div>

              {/* Demo auto-fill banner */}
              <div className="mb-4 p-2.5 bg-amber-500/10 border border-amber-300 rounded-xl flex items-center justify-between gap-2">
                <div className="text-[11px] text-amber-950">
                  <span className="font-bold">Test Credentials: </span>
                  <span className="font-mono">{role === 'officer' ? 'government.test@nirikshak.local' : 'contractor.test@nirikshak.local'}</span>
                </div>
                <button
                  type="button"
                  onClick={fillDemoCredentials}
                  className="px-2.5 py-1 text-[11px] font-bold bg-[#eefc55] hover:bg-[#e2f23e] border border-[#d6e838] text-neutral-900 rounded-lg shadow-2xs cursor-pointer whitespace-nowrap"
                >
                  Fill Demo
                </button>
              </div>

              {errorMsg && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider mb-1.5">
                    {role === 'officer' ? 'Officer Gov.in Email / Parichay ID' : 'Contractor Portal ID / Email'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={role === 'officer' ? 'government.test@nirikshak.local' : 'contractor.test@nirikshak.local'}
                    value={officerId}
                    onChange={(e) => setOfficerId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-black/15 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white text-neutral-900 placeholder-neutral-400 font-medium shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider mb-1.5">
                    Security Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-black/15 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white text-neutral-900 placeholder-neutral-400 font-medium shadow-xs"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-neutral-800 font-medium py-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded text-amber-600" />
                    <span>Hardware token verified</span>
                  </label>
                  <a
                    href={role === 'officer' ? '/government/login' : '/contractor/login'}
                    className="text-amber-800 font-bold hover:underline"
                  >
                    Open Full {role === 'officer' ? 'Officer' : 'Contractor'} Login →
                  </a>
                </div>

                <button
                  type="submit"
                  id="btn-portal-login-submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-6 rounded-full bg-[#eefc55] hover:bg-[#e2f23e] border border-[#d6e838] text-neutral-950 font-bold text-sm tracking-wide transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 mt-4 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
                      <span>Authenticating with Supabase...</span>
                    </>
                  ) : (
                    <>
                      <span>{role === 'officer' ? 'Officer Sign In' : 'Contractor Sign In'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-black/10 text-center">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-800">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Authorized access only.</span>
                </div>
                <p className="text-[11px] text-neutral-700 mt-1 font-medium">
                  This system is restricted to authorized Government of India officers and vetted contractors. Unauthorized attempts are punishable under the Information Technology Act.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
