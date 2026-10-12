import type { HallChannel } from '../device'

export type CalibrationStage = 'idle' | 'baseline' | 'capture' | 'review' | 'error'

export type CalibrationResult = {
  idle: number
  pressed: number | null
  polarity: 'N' | 'P' | null
  status: 'preparing' | 'waiting' | 'pressing' | 'complete' | 'skipped' | 'unstable' | 'error'
  attempt?: number
  sampleCount?: number
  pressCount?: number
  pressTarget?: number
  spreadPercent?: number | null
  latestVoltage?: number
  error?: string
}

export type CalibrationResults = Record<HallChannel, CalibrationResult>

export type CalibrationProgress = {
  phase: string
  channel: number | null
  attempt: number
  successful: number
  total: number
}
