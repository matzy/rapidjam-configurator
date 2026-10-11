import { useState } from 'react'
import type { DeviceInfo } from '../device'
import {
  readStrokeOverrides,
  resolveStrokeForMode,
  STROKE_MAX_MM,
  STROKE_MIN_MM,
  STROKE_STEP_MM,
  strokeDeviceKey,
  writeStrokeOverrides,
} from '../config/strokeProfiles'
import type { SettingMode } from '../config/settingMode'

export function useStrokeSetting(device: DeviceInfo | null, settingMode: SettingMode) {
  const [overrides, setOverrides] = useState(readStrokeOverrides)
  // TODO(expert-mode): keep this editor gated by the merged mode state; Standard mode intentionally ignores per-device overrides.
  const stroke = resolveStrokeForMode(device, settingMode, overrides)
  const deviceKey = strokeDeviceKey(device)

  function setCustomStroke(strokeMm: number) {
    const steps = (strokeMm - STROKE_MIN_MM) / STROKE_STEP_MM
    if (!Number.isFinite(strokeMm) || strokeMm < STROKE_MIN_MM || strokeMm > STROKE_MAX_MM
      || Math.abs(steps - Math.round(steps)) > 1e-8) {
      throw new RangeError(`Stroke must be between ${STROKE_MIN_MM} and ${STROKE_MAX_MM} mm in ${STROKE_STEP_MM} mm increments`)
    }
    if (!deviceKey) throw new Error('Cannot save a stroke override without a device identity')
    const next = { ...overrides, [deviceKey]: Number(strokeMm.toFixed(1)) }
    writeStrokeOverrides(next)
    setOverrides(next)
  }

  function resetStroke() {
    if (!deviceKey) throw new Error('Cannot reset a stroke override without a device identity')
    if (!(deviceKey in overrides)) return
    const next = { ...overrides }
    delete next[deviceKey]
    writeStrokeOverrides(next)
    setOverrides(next)
  }

  return { ...stroke, canEdit: stroke.showEditor && deviceKey !== null, setCustomStroke, resetStroke }
}
