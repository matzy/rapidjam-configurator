import { useContext } from 'react'
import { ButtonLabelContext } from './buttonLabelContext'

export function useButtonLabels() {
  const value = useContext(ButtonLabelContext)
  if (!value) throw new Error('useButtonLabels must be used inside ButtonLabelProvider')
  return value
}
