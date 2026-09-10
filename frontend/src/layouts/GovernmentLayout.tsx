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
 * GovernmentLayout — two-row fixed header (module bar + utility bar) with a
 * route-based contextual sidebar: the sidebar exists ONLY on project
 * workspace routes (/government/projects/:id/*) and approval workspace routes
 * (/government/approvals/:id/*). Global pages render full-width under the top
 * navigation. The contextual sidebar derives from the current route — never a
 * manually toggled boolean — so back/forward, refresh and direct URLs always
 * agree with the visible layout.
 */
export function GovernmentLayout() {
  const { officer, logout } = useAuth()
  const { t } = useI18n()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const location = useLocation()

  /** Context rule (route-derived): project/approval workspace ⇒ sidebar. */
  const projectId = /^\/government\/projects\/([^/]+)$/.exec(location.pathname)?.[1]
  const approvalId = /^\/government\/approvals\/([^/]+)$/.exec(location.pathname)?.[1]
  const contextualNav = (!!projectId && projectId !== 'create') || !!approvalId

  // Close the mobile contextual drawer on navigation (incl. leaving context).
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
          showProjectNavToggle={contextualNav}
          onOpenProjectNav={() => setSidebarOpen(true)}
        />

        {/* Contextual sidebar — renders nothing outside project/approval context */}
        <GovernmentSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={() => setSidebarOpen(false)} />

        <div className={cn(contextualNav && 'lg:pl-sidebar')}>
          <main
            id="main-content"
            className="mx-auto min-h-[calc(100vh-var(--header-total))] w-full max-w-content p-4 md:p-6"
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
