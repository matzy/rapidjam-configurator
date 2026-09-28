import { useContext } from 'react'
import { LocalizationContext } from './i18nContext'

export function useLocale() {
  const value = useContext(LocalizationContext)
  if (!value) throw new Error('useLocale must be used inside LocalizationProvider')
  return value
}
