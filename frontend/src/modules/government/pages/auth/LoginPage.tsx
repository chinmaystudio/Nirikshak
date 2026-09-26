import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '@/context/I18nContext';
import { useToast } from '@/context/ToastContext';
import { TextField, Checkbox } from '@/components/ui/Fields';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AuthService } from '@/core/auth/auth.service';

export function LoginPage() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isDev = !import.meta.env.PROD || import.meta.env.VITE_SHOW_DEMO_CREDENTIALS === 'true';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg('Please enter both your official email and password.');
      return;
    }

    setBusy(true);
    setErrorMsg(null);
    try {
      const session = await AuthService.signIn(email.trim(), password);
      showToast(`Welcome back, ${session.profile?.full_name || 'Officer'}!`, 'success');
      navigate('/government/dashboard');
    } catch (err: any) {
      console.error('Government login error:', err);
      setErrorMsg(err.message || 'Authentication failed. Please verify your credentials.');
      showToast(err.message || 'Login failed', 'danger');
    } finally {
      setBusy(false);
    }
  }

  function fillDemo() {
    setEmail('government.test@nirikshak.local');
    setPassword('NirikshakGov#2026');
    setErrorMsg(null);
  }

  return (
    <Card className="p-6">
      <h1 className="text-heading-1 text-fg">{t('auth.welcome')}</h1>
      <p className="mt-1 text-body-small text-fg-muted">Official NIRIKSHAK Government Infrastructure Portal</p>

      {errorMsg && (
        <div className="mt-4 rounded-control border border-danger-border bg-danger-tint p-3 text-body-small text-danger-strong flex items-start gap-2">
          <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4" noValidate={false}>
        <TextField
          label="Official Email"
          type="email"
          required
          startIcon="mail"
          placeholder="officer@nirikshak.local"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
        />
        <TextField
          label={t('auth.password')}
          type="password"
          required
          startIcon="lock"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        <div className="flex items-center justify-between">
          <Checkbox label="Remember me" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <Link
            to="/government/forgot-password"
            className="rounded-[2px] text-body-small text-primary-strong hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            {t('auth.forgotPassword')}
          </Link>
        </div>
        <Button type="submit" size="lg" block icon="login" disabled={busy}>
          {busy ? t('common.loading') : 'Sign In to Portal'}
        </Button>
      </form>

      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-body-small">
        <span className="text-fg-muted">New government official?</span>
        <Link
          to="/government/register"
          className="font-medium text-primary-strong hover:underline"
        >
          Register for Clearance
        </Link>
      </div>

      {isDev && (
        <div className="mt-5 rounded-control border border-border bg-surface-2 p-3 text-caption text-fg-muted">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-semibold text-fg flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-accent">terminal</span>
              Demo Credentials (Dev Only)
            </span>
            <button
              type="button"
              onClick={fillDemo}
              className="text-[11px] font-semibold text-primary-strong hover:underline cursor-pointer bg-primary-tint px-2 py-0.5 rounded"
            >
              Fill Demo
            </button>
          </div>
          <div className="font-mono text-[11px] text-fg-subtle space-y-0.5">
            <div>Email: <span className="text-fg">government.test@nirikshak.local</span></div>
            <div>Password: <span className="text-fg">NirikshakGov#2026</span></div>
            <div>Role: <span className="text-fg">government_admin (Pune Authority)</span></div>
          </div>
        </div>
      )}
    </Card>
  );
}
