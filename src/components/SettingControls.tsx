import { POSITION_STEP_MM } from '../utils/calibrationMath'

interface SettingSliderProps {
  label: string
  value: number
  max: number
  onChange: (value: number) => void
}

export function SettingSlider({ label, value, max, onChange }: SettingSliderProps) {
  return <div className="slider-field">
    <div className="slider-label"><label htmlFor={label}>{label}</label><output>{value.toFixed(2)} mm</output></div>
    <input id={label} type="range" min={POSITION_STEP_MM} max={max} step={POSITION_STEP_MM} value={Math.min(max, Math.max(POSITION_STEP_MM, value))} onChange={(event) => onChange(Number(event.target.value))} />
  </div>
}

interface SettingNumberProps {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}

export function SettingNumber({ label, value, min, max, onChange }: SettingNumberProps) {
  return <div className="slider-field">
    <div className="slider-label"><label htmlFor={label}>{label}</label><output>{value}</output></div>
    <input id={label} type="number" min={min} max={max} step="1" value={value} onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value))))} />
  </div>
}
