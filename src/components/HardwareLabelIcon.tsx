import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
import { HARDWARE_LABELS } from '../config/hardwareLabels'
import type { HallChannel } from '../device'

interface HardwareLabelIconProps {
  channel: HallChannel
}

export function HardwareLabelIcon({ channel }: HardwareLabelIconProps) {
  const label = HARDWARE_LABELS[channel]
  if (!label) return null
  if (label.kind === 'text') return <span className="hardware-label" aria-hidden="true">{label.text}</span>

  const Icon = {
    left: ChevronLeft,
    down: ChevronDown,
    right: ChevronRight,
    up: ChevronUp,
  }[label.direction]

  return <span className="hardware-label hardware-label-arrow" aria-hidden="true"><Icon /></span>
}
