export type SettingMode = 'standard' | 'expert'

export const SETTING_MODE_STORAGE_KEY = 'rapidjam.settingMode'
export const DEFAULT_SETTING_MODE: SettingMode = 'standard'

export const ACTUATION_MIN_MM = 0.05
export const ACTUATION_MAX_STANDARD_MM = 1.3
export const DEFAULT_EXPERT_STROKE_MM = 1.5

export const isSettingMode = (value: unknown): value is SettingMode => value === 'standard' || value === 'expert'

export const parseSettingMode = (value: unknown): SettingMode => isSettingMode(value) ? value : DEFAULT_SETTING_MODE

export const actuationMaxFor = (mode: SettingMode, strokeMm = DEFAULT_EXPERT_STROKE_MM): number =>
  mode === 'expert' ? strokeMm : ACTUATION_MAX_STANDARD_MM

export const clampActuation = (value: number, mode: SettingMode, strokeMm = DEFAULT_EXPERT_STROKE_MM): number =>
  Math.max(ACTUATION_MIN_MM, Math.min(actuationMaxFor(mode, strokeMm), value))
