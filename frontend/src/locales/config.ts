export type Locale = 'en' | 'hi' | 'mr'

export const LOCALE_STORAGE_KEY = 'nirikshak.locale'

export const LOCALES: { code: Locale; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी' },
]

export const DEFAULT_LOCALE: Locale =
  (import.meta.env.VITE_DEFAULT_LOCALE as Locale | undefined) ?? 'en'

/** English is the complete base dictionary; hi/mr fall back to it per key. */
import { en } from './en'
import { hi } from './hi'
import { mr } from './mr'

export const DICTIONARIES: Record<Locale, Record<string, string>> = { en, hi, mr }
