import { createContext } from 'react'

export type Locale = 'en' | 'ja'
export type TranslationValues = Record<string, string | number>

export interface LocalizationValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (text: string, values?: TranslationValues) => string
}

export const LocalizationContext = createContext<LocalizationValue | null>(null)
