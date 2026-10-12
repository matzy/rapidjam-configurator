import { median, secondDeepest } from './calibrationMath.ts'
import type { CalibrationAction } from '../types/calibration.ts'

export type PressCyclePhase = 'await-press' | 'press-sampling' | 'await-release' | 'idle-sampling'
export type PressCycleOutcome = 'in-progress' | 'complete' | 'unstable'
export type PressCycleEvent = 'none' | 'pressed' | 'released-early' | 'press-recorded' | 'released' | 'cycle-done' | 'complete' | 'unstable'

export interface PressCycleOptions {
  idle: number
  threshold: number
  sampleTarget: number
  releaseIdleSamples: number
  pressCycles: number
  maxPressCycles: number
  spreadLimit: number
}

export interface PressCycleState {
  phase: PressCyclePhase
  samples: number[]
  pressedCycles: number[]
  idleCycles: number[]
  outcome: PressCycleOutcome
  idle: number | null
  pressed: number | null
  spreadPercent: number | null
}

export interface PressCycleStep {
  state: PressCycleState
  event: PressCycleEvent
}

export interface PressCycleDecision {
  outcome: PressCycleOutcome
  idle: number
  pressed: number
  spreadPercent: number | null
}

// Returns the channels to calibrate in channel order. An empty selection means every channel.
export const normalizeCalibrationTargets = (selected: readonly number[] | undefined, channelCount = 16): number[] => {
  if (!selected || selected.length === 0) return Array.from({ length: channelCount }, (_, index) => index)
  return [...new Set(selected)].filter((index) => index >= 0 && index < channelCount).sort((a, b) => a - b)
}

export const createPressCycleState = (): PressCycleState => ({
  phase: 'await-press',
  samples: [],
  pressedCycles: [],
  idleCycles: [],
  outcome: 'in-progress',
  idle: null,
  pressed: null,
  spreadPercent: null,
})

export const isPressedValue = (value: number, options: Pick<PressCycleOptions, 'idle' | 'threshold'>): boolean =>
  Math.abs(value - options.idle) >= options.threshold

// Compares the latest press cycles with each other. Once the last `pressCycles` presses agree within the spread limit, the capture is complete.
export const evaluatePressCycles = (pressedCycles: number[], idleValues: number[], options: Pick<PressCycleOptions, 'pressCycles' | 'maxPressCycles' | 'spreadLimit'>): PressCycleDecision => {
  const idle = median(idleValues)
  const overallPressed = median(pressedCycles)
  if (pressedCycles.length < options.pressCycles) return { outcome: 'in-progress', idle, pressed: overallPressed, spreadPercent: null }
  const window = pressedCycles.slice(-options.pressCycles)
  const windowPressed = median(window)
  const spread = Math.max(...window) - Math.min(...window)
  const ratio = spread / Math.max(1, Math.abs(windowPressed - idle))
  const spreadPercent = Math.round(ratio * 1000) / 10
  if (ratio <= options.spreadLimit) return { outcome: 'complete', idle, pressed: windowPressed, spreadPercent }
  if (pressedCycles.length < options.maxPressCycles) return { outcome: 'in-progress', idle, pressed: overallPressed, spreadPercent }
  return { outcome: 'unstable', idle, pressed: overallPressed, spreadPercent }
}

// Maps the capture state to the motion the operator should make next.
export const pressCycleAction = (state: PressCycleState): CalibrationAction => {
  if (state.outcome !== 'in-progress') return 'press'
  switch (state.phase) {
    case 'press-sampling': return 'hold'
    case 'await-release':
    case 'idle-sampling': return 'release'
    case 'await-press': return 'press'
  }
}

export function advancePressCycle(state: PressCycleState, value: number, options: PressCycleOptions): PressCycleStep {
  if (state.outcome !== 'in-progress') return { state, event: 'none' }
  const pressed = isPressedValue(value, options)
  switch (state.phase) {
    case 'await-press':
      if (!pressed) return { state, event: 'none' }
      return { state: { ...state, phase: 'press-sampling', samples: [value] }, event: 'pressed' }
    case 'press-sampling': {
      // A release before the sample target only discards this press; earlier cycles are kept.
      if (!pressed) return { state: { ...state, phase: 'await-press', samples: [] }, event: 'released-early' }
      const samples = [...state.samples, value]
      if (samples.length < options.sampleTarget) return { state: { ...state, samples }, event: 'none' }
      return {
        state: { ...state, phase: 'await-release', samples: [], pressedCycles: [...state.pressedCycles, secondDeepest(samples, options.idle)] },
        event: 'press-recorded',
      }
    }
    case 'await-release':
      if (pressed) return { state, event: 'none' }
      return { state: { ...state, phase: 'idle-sampling', samples: [] }, event: 'released' }
    case 'idle-sampling': {
      // Pressing again before the post-release idle samples finish starts the next press.
      if (pressed) return { state: { ...state, phase: 'press-sampling', samples: [value] }, event: 'pressed' }
      const samples = [...state.samples, value]
      if (samples.length < options.releaseIdleSamples) return { state: { ...state, samples }, event: 'none' }
      const idleCycles = [...state.idleCycles, median(samples)]
      const decision = evaluatePressCycles(state.pressedCycles, [options.idle, ...idleCycles], options)
      const resolved = decision.outcome !== 'in-progress'
      return {
        state: {
          ...state,
          phase: 'await-press',
          samples: [],
          idleCycles,
          outcome: decision.outcome,
          idle: resolved ? decision.idle : state.idle,
          pressed: resolved ? decision.pressed : state.pressed,
          spreadPercent: decision.spreadPercent,
        },
        event: decision.outcome === 'in-progress' ? 'cycle-done' : decision.outcome,
      }
    }
  }
}
