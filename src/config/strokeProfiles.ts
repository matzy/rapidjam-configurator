import type { DeviceInfo } from '../device'
import type { SettingMode } from './settingMode'

export const DEFAULT_STROKE_MM = 1.5
export const STROKE_MIN_MM = 0.5
export const STROKE_MAX_MM = 4
export const STROKE_STEP_MM = 0.1

export interface StrokeProfile {
  label: string
  strokeMm: number
}

export const STROKE_PROFILES: Readonly<Record<string, StrokeProfile>> = {
  rapidjam: { label: 'RapidJAM', strokeMm: 1.5 },
}

export type StrokeSource = 'preset' | 'custom' | 'fallback'

export interface ResolvedStroke {
  strokeMm: number
  label: string
  source: StrokeSource
}

export type StrokeOverrides = Record<string, number>

const STORAGE_KEY = 'rapidjam.stroke-overrides'

export const strokeDeviceKey = (device: Pick<DeviceInfo, 'product' | 'boardConfig' | 'boardConfigLabel'> | null): string | null => {
  const boardConfig = device?.boardConfig?.trim()
  const boardLabel = device?.boardConfigLabel?.trim()
  const identity = boardConfig || boardLabel || device?.product.trim()
  return identity ? identity.toLowerCase().replace(/[^a-z0-9]/g, '') : null
}

export const hasStrokePreset = (device: Pick<DeviceInfo, 'product' | 'boardConfig' | 'boardConfigLabel'> | null): boolean => {
  const key = strokeDeviceKey(device)
  return key !== null && key in STROKE_PROFILES
}

export function resolveStroke(
  device: Pick<DeviceInfo, 'product' | 'boardConfig' | 'boardConfigLabel'> | null,
  overrides: StrokeOverrides = {},
): ResolvedStroke {
  const key = strokeDeviceKey(device)
  const profile = key ? STROKE_PROFILES[key] : undefined
  const label = profile?.label ?? device?.boardConfigLabel?.trim() ?? device?.boardConfig?.trim() ?? device?.product.trim() ?? 'Unknown device'
  const custom = key ? overrides[key] : undefined

  if (custom !== undefined && Number.isFinite(custom) && custom >= STROKE_MIN_MM && custom <= STROKE_MAX_MM) {
    return { strokeMm: custom, label, source: 'custom' }
  }
  if (profile) return { ...profile, source: 'preset' }
  return { strokeMm: DEFAULT_STROKE_MM, label, source: 'fallback' }
}

export function resolveStrokeForMode(
  device: Pick<DeviceInfo, 'product' | 'boardConfig' | 'boardConfigLabel'> | null,
  settingMode: SettingMode,
  overrides: StrokeOverrides = {},
) {
  const showEditor = settingMode === 'expert'
  return {
    ...resolveStroke(device, showEditor ? overrides : {}),
    showEditor,
    unsupportedDevice: device !== null && !hasStrokePreset(device),
  }
}

export function readStrokeOverrides(storage: Pick<Storage, 'getItem'> = window.localStorage): StrokeOverrides {
  const serialized = storage.getItem(STORAGE_KEY)
  if (serialized === null) return {}

  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch (error) {
    console.warn('Ignoring invalid saved stroke overrides', error)
    return {}
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    console.warn('Ignoring invalid saved stroke overrides')
    return {}
  }

  const validEntries = Object.entries(parsed).filter((entry): entry is [string, number] =>
    typeof entry[1] === 'number' && Number.isFinite(entry[1])
      && entry[1] >= STROKE_MIN_MM && entry[1] <= STROKE_MAX_MM)
  return Object.fromEntries(validEntries)
}

export function writeStrokeOverrides(overrides: StrokeOverrides, storage: Pick<Storage, 'setItem'> = window.localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(overrides))
}
