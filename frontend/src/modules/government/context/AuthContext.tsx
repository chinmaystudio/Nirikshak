import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Officer } from '@/types'

/**
 * Auth context — demo authentication ONLY. No real government authentication
 * integration is implemented or claimed; the login flow is a front-end demo
 * that stores a mock officer session locally.
 */

export type AuthScreen = 'password' | 'otp' | '2fa' | 'select-role' | 'select-department'

const SESSION_KEY = 'nirikshak.session'

interface AuthContextValue {
  officer: Officer | null
  isAuthenticated: boolean
  login: (officer: Officer) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readSession(): Officer | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Officer
    if (parsed && typeof parsed.id === 'string') return parsed
    return null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [officer, setOfficer] = useState<Officer | null>(readSession)

  const login = useCallback((o: Officer) => {
    setOfficer(o)
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(o))
    } catch {
      /* ignore */
    }
  }, [])

  const logout = useCallback(() => {
    setOfficer(null)
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const value = useMemo(
    () => ({ officer, isAuthenticated: officer !== null, login, logout }),
    [officer, login, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
