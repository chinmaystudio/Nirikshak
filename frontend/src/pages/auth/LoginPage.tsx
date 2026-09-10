import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useI18n } from '@/context/I18nContext'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { TextField, Checkbox } from '@/components/ui/Fields'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { authApi } from '@/api'
import { DEMO_OFFICER } from '@/data/modules'

/**
 * LoginPage — officer sign-in (demo only; no real government auth integrated).
 */
export function LoginPage() {
  const { t } = useI18n()
  const { login } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const officer = await authApi.signIn(employeeId, password)
    login(officer)
    showToast('Signed in to demo session (mock).', 'success')
    setBusy(false)
    navigate('/government/dashboard')
  }

  return (
    <Card className="p-6">
      <h1 className="text-heading-1 text-fg">{t('auth.welcome')}</h1>
      <p className="mt-1 text-body-small text-fg-muted">{t('auth.subtitle')}</p>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4" noValidate={false}>
        <TextField
          label={t('auth.employeeId')}
          required
          startIcon="badge"
          placeholder={t('auth.employeeIdPlaceholder')}
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
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
            to="/forgot-password"
            className="rounded-[2px] text-body-small text-primary-strong hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            {t('auth.forgotPassword')}
          </Link>
        </div>
        <Button type="submit" size="lg" block icon="login" disabled={busy}>
          {busy ? t('common.loading') : t('auth.signIn')}
        </Button>
      </form>

      <p className="mt-4 rounded-control bg-surface-2 p-3 text-caption text-fg-muted">
        {t('auth.demoCredentials')}
      </p>

      <p className="mt-3 text-center text-caption text-fg-subtle">
        {DEMO_OFFICER.designation} — demo profile
      </p>
    </Card>
  )
}
