import type { HallChannel } from '../device'

export type HardwareLabel =
  | { kind: 'text', text: string }
  | { kind: 'arrow', direction: 'left' | 'down' | 'right' | 'up' }

export const HARDWARE_LABELS: Record<HallChannel, HardwareLabel | null> = {
  ch0: { kind: 'text', text: 'B' },
  ch1: { kind: 'text', text: 'RT' },
  ch2: { kind: 'text', text: 'LT' },
  ch3: { kind: 'text', text: 'X' },
  ch4: { kind: 'text', text: 'Y' },
  ch5: { kind: 'text', text: 'RB' },
  ch6: { kind: 'text', text: 'LB' },
  ch7: { kind: 'text', text: 'SL' },
  ch8: { kind: 'arrow', direction: 'left' },
  ch9: { kind: 'arrow', direction: 'down' },
  ch10: { kind: 'text', text: 'LS' },
  ch11: { kind: 'arrow', direction: 'up' },
  ch12: { kind: 'arrow', direction: 'right' },
  ch13: null,
  ch14: { kind: 'text', text: 'A' },
  ch15: { kind: 'text', text: 'RS' },
}

const ARROW_TEXT: Record<Extract<HardwareLabel, { kind: 'arrow' }>['direction'], string> = {
  left: '←',
  down: '↓',
  right: '→',
  up: '↑',
}

export function hardwareLabelText(channel: HallChannel): string | null {
  const label = HARDWARE_LABELS[channel]
  if (label === null) return null
  return label.kind === 'text' ? label.text : ARROW_TEXT[label.direction]
}
