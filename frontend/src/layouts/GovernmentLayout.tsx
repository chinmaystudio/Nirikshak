import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { GovernmentHeader } from '@/components/layout/GovernmentHeader'
import { GovernmentSidebar } from '@/components/layout/GovernmentSidebar'
import { NotificationDrawer } from '@/components/layout/NotificationDrawer'
import { AppFooter } from '@/components/layout/AppFooter'
import { useAuth } from '@/context/AuthContext'
import { useI18n } from '@/context/I18nContext'
import { DEMO_BANNER_KEY } from '@/constants'
import { cn } from '@/utils/cn'

/**
 * GovernmentLayout — the Stitch shell preserved: fixed h-16 header + fixed
 * w-72 sidebar + pl-72 main. Mobile: header stays, sidebar becomes a drawer.
 */
export function GovernmentLayout() {
  const { officer, logout } = useAuth()
  const { t } = useI18n()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const location = useLocation()

  // Close mobile drawer on navigation.
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  // "/" focuses global search (Stitch keyboard hint).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLSelectElement)) {
        e.preventDefault()
        document.querySelector<HTMLInputElement>('input[type="search"]')?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="min-h-screen bg-canvas">
      {/* Skip link */}
      <a
        href="#main-content"
        className="skip-link"
      >
        {t('common.skipToContent')}
      </a>

      {/* Demo banner */}
      <div className="nk-demo-banner fixed inset-x-0 top-0 z-skip px-3 py-1 text-center" role="note">
        {t(DEMO_BANNER_KEY)}
      </div>

      <div className="pt-7">
        <GovernmentHeader
          officerName={officer?.name}
          officerRole={officer?.designation}
          onLogout={logout}
          onOpenNotifications={() => setNotifOpen(true)}
        />

        {/* Mobile menu button (visually below fixed header) */}
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation menu"
          className={cn(
            'fixed left-3 top-[calc(var(--header-height)+var(--banner-offset,1.75rem))] z-sticky inline-flex h-10 w-10 items-center justify-center rounded-control border border-border bg-surface text-fg-muted shadow-card lg:hidden',
          )}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            menu
          </span>
        </button>

        <GovernmentSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={() => setSidebarOpen(false)} />

        <div className="lg:pl-sidebar">
          <main
            id="main-content"
            className="mx-auto min-h-[calc(100vh-var(--header-height))] w-full max-w-content p-4 md:p-6"
            tabIndex={-1}
          >
            <Outlet />
          </main>
          <AppFooter />
        </div>
      </div>

      <NotificationDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  )
}
