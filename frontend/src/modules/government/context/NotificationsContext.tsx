import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertItem } from '@/types'
import { alertsApi } from '@/api'
import { supabase } from '@/core/supabase/client'

/**
 * Notification context — alerts feed powering the header bell and drawer.
 * Loads the signed-in user's real rows from the notifications table (via
 * alertsApi, RLS-scoped). Starts empty; nothing is seeded or simulated.
 */

interface NotificationsContextValue {
  alerts: AlertItem[]
  unreadCount: number
  markRead: (id: string) => void
  markAllRead: () => void
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<AlertItem[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) {
        if (!cancelled) setAlerts([])
        return
      }
      try {
        const rows = await alertsApi.list()
        if (!cancelled) setAlerts(rows)
      } catch (err) {
        console.error('Failed to load notifications:', err)
        if (!cancelled) setAlerts([])
      }
    }
    void load()
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      void load()
    })
    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [])

  const markRead = (id: string) => {
    setAlerts((list) => list.map((a) => (a.id === id ? { ...a, read: true } : a)))
    void supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .is('read_at', null)
      .then(({ error }) => {
        if (error) console.error('Failed to mark notification read:', error)
      })
  }

  const markAllRead = () => {
    const unreadIds = alerts.filter((a) => !a.read).map((a) => a.id)
    setAlerts((list) => list.map((a) => ({ ...a, read: true })))
    if (unreadIds.length > 0) {
      void supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadIds)
        .is('read_at', null)
        .then(({ error }) => {
          if (error) console.error('Failed to mark notifications read:', error)
        })
    }
  }

  const unreadCount = alerts.filter((a) => !a.read).length
  const value = useMemo(
    () => ({ alerts, unreadCount, markRead, markAllRead }),
    [alerts, unreadCount, markRead, markAllRead],
  )
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider')
  return ctx
}
