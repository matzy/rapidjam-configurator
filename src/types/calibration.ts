import type { HallChannel } from '../device'

export type CalibrationStage = 'idle' | 'baseline' | 'capture' | 'review' | 'error'

export type CalibrationResult = {
  idle: number
  pressed: number | null
  polarity: 'N' | 'P' | null
  status: 'preparing' | 'waiting' | 'pressing' | 'complete' | 'skipped' | 'excluded' | 'unstable' | 'error'
  attempt?: number
  sampleCount?: number
  pressCount?: number
  pressTarget?: number
  spreadPercent?: number | null
  latestVoltage?: number
  error?: string
}

export type CalibrationResults = Record<HallChannel, CalibrationResult>

// The motion the guide illustrates: 'press' pushes the key down, 'hold' keeps it down, 'release' lets it up.
export type CalibrationAction = 'none' | 'hands-off' | 'press' | 'hold' | 'release'

export type CalibrationProgress = {
  phase: string
  channel: number | null
  attempt: number
  successful: number
  total: number
  action: CalibrationAction
}
