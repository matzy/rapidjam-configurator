export const rawToMillimeters = (value: number, idle: number, pressed: number): number =>
  Math.max(0.05, Math.min(1.5, Math.abs(value - idle) / Math.max(1, Math.abs(pressed - idle)) * 1.5))

export const millimetersToRaw = (value: number, idle: number, pressed: number): number =>
  Math.round(idle + (Math.max(0, Math.min(1.5, value)) / 1.5) * (pressed - idle))

export const secondLowest = (values: number[]): number => {
  if (values.length < 3) throw new Error('At least three values are required')
  return [...values].sort((a, b) => a - b)[1]
}

export const secondHighest = (values: number[]): number => {
  if (values.length < 3) throw new Error('At least three values are required')
  return [...values].sort((a, b) => b - a)[1]
}
