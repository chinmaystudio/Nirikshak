import { NavLink } from 'react-router-dom'
import { GOVERNMENT_NAV } from '@/constants'
import { useI18n } from '@/context/I18nContext'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/utils/cn'
import { LogoLockup } from '@/components/ui/Logo'

/**
 * GovernmentSidebar — fixed 288px left rail (Stitch skeleton): grouped nav
 * (Core / Governance & Finance / Accountability & Oversight / Citizen &
 * Settings) with count badges. Collapses to icon rail on md, drawer on small.
 */
export function GovernmentSidebar({
  open,
  onClose,
  onNavigate,
}: {
  /** Mobile drawer state. */
  open: boolean
  onClose: () => void
  onNavigate?: () => void
}) {
  const { t } = useI18n()
  const { isAuthenticated } = useAuth()
  void isAuthenticated

  return (
    <>
      {/* Scrim (mobile) */}
      {open && (
        <div className="fixed inset-0 top-header z-sidebar bg-[var(--scrim)] lg:hidden" onClick={onClose} aria-hidden="true" />
      )}
      <nav
        aria-label="Primary"
        className={cn(
          'fixed left-0 top-header z-sidebar flex h-[calc(100vh-var(--header-height))] w-sidebar flex-col overflow-y-auto border-r border-border bg-surface transition-transform duration-base',
          // Mobile: off-canvas unless open; Desktop: always visible
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="border-b border-border p-4">
          <LogoLockup />
        </div>
        <div className="flex-1 py-2">
          {GOVERNMENT_NAV.map((group) => (
            <div key={group.titleKey} className="mb-2">
              <p className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-fg-subtle">
                {t(group.titleKey)}
              </p>
              <ul>
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'relative flex min-h-10 items-center gap-3 px-4 py-2 text-body-small transition-colors duration-fast',
                          isActive
                            ? 'bg-primary-soft font-semibold text-primary-strong'
                            : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                          'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span className="absolute inset-y-0 left-0 w-1 rounded-r bg-primary" aria-hidden="true" />
                          )}
                          <span className="material-symbols-outlined shrink-0 text-[20px]" aria-hidden="true">
                            {item.icon}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{t(item.labelKey)}</span>
                          {item.badge != null && item.badge > 0 && (
                            <span
                              className={cn(
                                'inline-flex min-w-5 shrink-0 items-center justify-center rounded-badge border px-1 py-0.5 text-[11px] tabular-nums',
                                item.badgeTone === 'secondary'
                                  ? 'border-primary-border bg-primary-soft text-primary-strong'
                                  : 'border-border bg-surface-2 text-fg-muted',
                              )}
                            >
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border p-3 text-[11px] text-fg-subtle">
          <p className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
            {t('common.footerSystemStatus')}
          </p>
        </div>
      </nav>
    </>
  )
}
