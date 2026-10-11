import { createContext } from 'react'
import type { ButtonLabelAction } from './config/buttonLabels'

export interface ButtonLabelValue {
  actionLabel: (action: ButtonLabelAction) => string
}

export const ButtonLabelContext = createContext<ButtonLabelValue | null>(null)
