export const POSITION_STEP_MM = 0.05

export const rawToRatio = (value: number, idle: number, pressed: number): number =>
  Math.max(0, Math.min(1, Math.abs(value - idle) / Math.max(1, Math.abs(pressed - idle))))

export const ratioToMillimeters = (ratio: number, strokeMm: number): number =>
  Math.max(0, Math.min(1, ratio)) * strokeMm

export const millimetersToRatio = (millimeters: number, strokeMm: number): number =>
  Math.max(0, Math.min(1, millimeters / strokeMm))

export const rawToTravelMillimeters = (value: number, idle: number, pressed: number, calibrated: boolean, strokeMm: number): number | null => {
  if (!calibrated || !Number.isFinite(value) || !Number.isFinite(idle) || !Number.isFinite(pressed)) return null
  const span = pressed - idle
  if (Math.abs(span) < 1) return null
  return Math.max(0, Math.min(1, (value - idle) / span)) * strokeMm
}

export const ratioToRaw = (ratio: number, idle: number, pressed: number): number =>
  Math.round(idle + (Math.max(0, Math.min(1, ratio)) * (pressed - idle)))

export const meterClientXToMillimeters = (clientX: number, left: number, width: number, strokeMm: number): number | null => {
  if (![clientX, left, width].every(Number.isFinite) || width <= 0) return null
  const ratio = Math.max(0, Math.min(1, (clientX - left) / width))
  const snapped = Math.round((ratio * strokeMm) / POSITION_STEP_MM) * POSITION_STEP_MM
  return Math.max(POSITION_STEP_MM, Math.min(strokeMm, Number(snapped.toFixed(2))))
}

export const secondLowest = (values: number[]): number => {
  if (values.length < 3) throw new Error('At least three values are required')
  return [...values].sort((a, b) => a - b)[1]
}

export const secondHighest = (values: number[]): number => {
  if (values.length < 3) throw new Error('At least three values are required')
  return [...values].sort((a, b) => b - a)[1]
}
