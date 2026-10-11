import type { HallSetting } from '../device'
import { ratioToRaw } from './calibrationMath.ts'

export type HallInputEstimate = 'on' | 'off' | 'unknown'

export interface HallInputHistory {
  state: HallInputEstimate
  lastIncrement: number | null
}

export const initialHallInputHistory = (): HallInputHistory => ({ state: 'unknown', lastIncrement: null })

// Approximation of HETriggerAddon::preprocess(), not the firmware's triggerActive state.
// The HTTP voltage may use a different smoothing path and skips intermediate samples.
export function estimateHallInput(previous: HallInputHistory, voltage: number, setting: HallSetting): HallInputHistory {
  const { idle, pressed, pressRatio, releaseRatio, noise, polarity, calibrated, rapidTrigger } = setting
  if (!calibrated || ![voltage, idle, pressed, pressRatio, ...(rapidTrigger ? [releaseRatio, noise] : [])].every(Number.isFinite)
    || Math.abs(pressed - idle) < 1 || (rapidTrigger && (noise < 0 || noise > 4095))
    || pressRatio < 0 || pressRatio > 1 || (rapidTrigger && (releaseRatio < 0 || releaseRatio > 1))
    || (polarity !== 'N' && polarity !== 'P') || voltage < 0 || voltage > 4095) {
    return initialHallInputHistory()
  }

  const normalize = (raw: number) => polarity === 'P' ? 4095 - raw : raw
  const value = normalize(voltage)
  const active = normalize(ratioToRaw(pressRatio, idle, pressed))
  // RT OFF firmware compares only with active (strict >); it ignores release.
  if (!rapidTrigger) return { state: value > active ? 'on' : 'off', lastIncrement: value }

  const threshold = normalize(ratioToRaw(releaseRatio, idle, pressed))

  if (previous.lastIncrement === null) return { state: 'unknown', lastIncrement: value }
  const difference = value - previous.lastIncrement
  // noise is an ADC delta, not a fixed position. Equal-to-noise does not count.
  const pressing = difference > noise
  const releasing = -difference > noise
  const lastIncrement = pressing || releasing ? value : previous.lastIncrement
  let state = previous.state
  if (state !== 'on' && pressing && value >= active) state = 'on'
  else if (state !== 'off' && releasing && value <= threshold) state = 'off'
  return { state, lastIncrement }
}