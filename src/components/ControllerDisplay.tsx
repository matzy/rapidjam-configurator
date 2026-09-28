import { keyboardActionFor, type DeviceConfig } from '../device'
import type { CalibrationResults } from '../types/calibration'
import type { HallChannel } from '../device'
import type { MouseEvent } from 'react'
import { keyboardKeyLabel } from '../config/inputModes'
import { useLocale } from '../useLocale'
import { HALL_LABELS } from '../config/constants'

const layout: HallChannel[] = ['ch7', 'ch6', 'ch5', 'ch4', 'ch3', 'ch2', 'ch8', 'ch9', 'ch11', 'ch12', 'ch14', 'ch0', 'ch1', 'ch15', 'ch10', 'ch13']

interface ControllerDisplayProps {
  config: DeviceConfig
  savedConfig: DeviceConfig
  activeButton: HallChannel
  selectedButtons?: ReadonlyArray<HallChannel>
  onSelect: (id: HallChannel, event?: MouseEvent<HTMLButtonElement>) => void
  calibrationMode?: boolean
  calibrationResults?: CalibrationResults
  readingChannel?: number | null
  keyboardMode?: boolean
}

export function ControllerDisplay({ config, savedConfig, activeButton, selectedButtons = [], onSelect, calibrationMode = false, calibrationResults, readingChannel = null, keyboardMode = false }: ControllerDisplayProps) {
  const { t } = useLocale()
  return <div className="controller">
    <div className="controller-brand">RAPID<span>JAM</span><small>MAGNETIC INPUT · ADC29</small></div>
    <div className="button-grid">
      {layout.map((id) => {
        const action = keyboardActionFor(config.hallMappings[id])
        const savedAction = keyboardActionFor(savedConfig.hallMappings[id])
        const changed = keyboardMode
          ? action !== savedAction || (action !== null && config.keyboardMappings[action] !== savedConfig.keyboardMappings[action])
          : config.hallMappings[id] !== savedConfig.hallMappings[id] || JSON.stringify(config.hall[id]) !== JSON.stringify(savedConfig.hall[id])
        const state = calibrationResults?.[id]?.status
        const reading = calibrationMode && readingChannel === Number(id.slice(2))
        const selected = selectedButtons.includes(id)
        const label = calibrationMode ? id.toUpperCase() : keyboardMode ? action === null ? t(config.hallMappings[id]) : t(keyboardKeyLabel(config.keyboardMappings[action])) : t(config.hallMappings[id])
        return <button key={id} className={`controller-key key-${id} ${activeButton === id ? 'active' : ''} ${selected ? 'selected' : ''} ${changed ? 'changed' : ''} ${calibrationMode && state ? `calibration-${state}` : ''} ${reading ? 'calibration-reading' : ''}`} aria-label={`${id.toUpperCase()} · ${HALL_LABELS[id]} · ${label}`} onClick={(event) => onSelect(id, event)}>
          <span>{label}</span>
        </button>
      })}
    </div>
    <div className="controller-edge" />
  </div>
}
