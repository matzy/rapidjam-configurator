import { useMemo, type ReactNode } from 'react'
import { ButtonLabelContext, type ButtonLabelValue } from './buttonLabelContext'
import { buttonLabel, type ButtonLabelAction } from './config/buttonLabels'
import { useLocale } from './useLocale'

interface ButtonLabelProviderProps {
  inputMode: number
  swapTouchpadShare: boolean
  children: ReactNode
}

export function ButtonLabelProvider({ inputMode, swapTouchpadShare, children }: ButtonLabelProviderProps) {
  const { t } = useLocale()
  const value = useMemo<ButtonLabelValue>(() => ({
    actionLabel: (action: ButtonLabelAction) => {
      const result = buttonLabel(inputMode, action, swapTouchpadShare)
      return result.unused
        ? t('{{button}} (unused)', { button: result.label })
        : t(result.label)
    },
  }), [inputMode, swapTouchpadShare, t])

  return <ButtonLabelContext.Provider value={value}>{children}</ButtonLabelContext.Provider>
}
