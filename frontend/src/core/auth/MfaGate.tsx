import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/core/supabase/client';
import { useAuthContext } from './AuthProvider';

/**
 * Multi-factor authentication gate for government and contractor portals.
 *
 * Supabase Auth TOTP (any authenticator app: Google Authenticator, Microsoft
 * Authenticator, etc.). A password-only session is "aal1"; after a verified
 * code it becomes "aal2". The database refuses writes from aal1 government
 * and contractor sessions (migration 043), so this screen is not cosmetic:
 * it is the only way to obtain an aal2 session.
 *
 * Set VITE_REQUIRE_MFA=false only for a local development build.
 */
export const MFA_REQUIRED = import.meta.env.VITE_REQUIRE_MFA !== 'false';

type Stage =
  | { kind: 'checking' }
  | { kind: 'verified' }
  | { kind: 'challenge'; factorId: string }
  | { kind: 'enroll'; factorId: string; qrCode: string; secret: string }
  | { kind: 'error'; message: string };

export function MfaGate({ children, portalName }: { children: ReactNode; portalName: string }) {
  const { logout } = useAuthContext();
  const [stage, setStage] = useState<Stage>({ kind: 'checking' });
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  const evaluate = useCallback(async () => {
    try {
      const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) throw aalError;
      if (aal?.currentLevel === 'aal2') {
        setStage({ kind: 'verified' });
        return;
      }

      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      const verified = factors?.totp?.find((f) => f.status === 'verified');
      if (verified) {
        setStage({ kind: 'challenge', factorId: verified.id });
        return;
      }

      // Remove abandoned (never verified) enrolments before starting a new one.
      for (const f of factors?.all ?? []) {
        if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `NIRIKSHAK ${portalName}`,
      });
      if (enrollError || !enrolled) throw enrollError ?? new Error('Enrolment failed');
      setStage({ kind: 'enroll', factorId: enrolled.id, qrCode: enrolled.totp.qr_code, secret: enrolled.totp.secret });
    } catch (err: any) {
      setStage({ kind: 'error', message: err?.message || 'Two-step verification could not be started.' });
    }
  }, [portalName]);

  useEffect(() => {
    if (!MFA_REQUIRED) {
      setStage({ kind: 'verified' });
      return;
    }
    void evaluate();
  }, [evaluate]);

  const verify = async (factorId: string) => {
    const clean = code.replace(/\D/g, '');
    if (clean.length !== 6) {
      setCodeError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setSubmitting(true);
    setCodeError(null);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: clean });
      if (error) throw error;
      setCode('');
      setStage({ kind: 'verified' });
    } catch (err: any) {
      setCodeError(/invalid|expired/i.test(err?.message || '') ? 'That code is not valid. Check the time on your phone and try the current code.' : err?.message || 'Verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (stage.kind === 'verified') return <>{children}</>;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-800">
      <main className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-7" aria-labelledby="mfa-title">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">NIRIKSHAK · {portalName}</p>
        <h1 id="mfa-title" className="mt-1 text-xl font-bold text-slate-900">Two-step verification</h1>

        {stage.kind === 'checking' && <p className="mt-4 text-sm text-slate-600">Checking your sign-in…</p>}

        {stage.kind === 'error' && (
          <>
            <p className="mt-4 text-sm text-red-700" role="alert">{stage.message}</p>
            <button type="button" onClick={() => { setStage({ kind: 'checking' }); void evaluate(); }} className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
              Try again
            </button>
          </>
        )}

        {stage.kind === 'enroll' && (
          <>
            <p className="mt-3 text-sm text-slate-600">
              Official accounts need an authenticator app. Scan this code with Google Authenticator, Microsoft Authenticator or any TOTP app, then enter the 6-digit code it shows.
            </p>
            <img src={stage.qrCode} alt="QR code for your authenticator app" className="mx-auto mt-4 h-44 w-44 rounded-lg border border-slate-200 bg-white p-2" />
            <p className="mt-3 text-xs text-slate-500">
              Can't scan? Enter this key manually: <span className="select-all break-all font-mono text-slate-800">{stage.secret}</span>
            </p>
          </>
        )}

        {stage.kind === 'challenge' && (
          <p className="mt-3 text-sm text-slate-600">Enter the 6-digit code from your authenticator app to continue.</p>
        )}

        {(stage.kind === 'enroll' || stage.kind === 'challenge') && (
          <form
            className="mt-5 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void verify(stage.factorId);
            }}
          >
            <label htmlFor="mfa-code" className="text-xs font-semibold text-slate-700">Verification code</label>
            <input
              id="mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              aria-invalid={Boolean(codeError)}
              aria-describedby={codeError ? 'mfa-code-error' : undefined}
              className="rounded-lg border border-slate-300 px-3 py-2.5 text-center font-mono text-lg tracking-[0.4em] focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            {codeError && <p id="mfa-code-error" className="text-xs text-red-700" role="alert">{codeError}</p>}
            <button type="submit" disabled={submitting} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
              {submitting ? 'Verifying…' : 'Verify and continue'}
            </button>
          </form>
        )}

        <button type="button" onClick={() => void logout()} className="mt-5 text-xs font-semibold text-slate-500 hover:text-slate-800 underline">
          Sign out
        </button>
        <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
          Lost access to your authenticator? Ask your organization's administrator to reset your second factor.
        </p>
      </main>
    </div>
  );
}
