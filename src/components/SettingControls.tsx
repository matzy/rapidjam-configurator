interface SettingSliderProps {
  label: string
  value: number
  onChange: (value: number) => void
}

export function SettingSlider({ label, value, onChange }: SettingSliderProps) {
  return <div className="slider-field">
    <div className="slider-label"><label htmlFor={label}>{label}</label><output>{value.toFixed(2)} mm</output></div>
    <input id={label} type="range" min="0.05" max="1.5" step="0.05" value={value} onChange={(event) => onChange(Number(event.target.value))} />
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
