import type { DeviceConfig } from '../device'
import type { CalibrationResults } from '../types/calibration'
import type { HallChannel } from '../device'

const layout: HallChannel[] = ['ch7', 'ch6', 'ch5', 'ch4', 'ch3', 'ch2', 'ch8', 'ch9', 'ch11', 'ch12', 'ch14', 'ch0', 'ch1', 'ch15', 'ch10', 'ch13']

interface ControllerDisplayProps {
  config: DeviceConfig
  savedConfig: DeviceConfig
  activeButton: HallChannel
  onSelect: (id: HallChannel) => void
  calibrationMode?: boolean
  calibrationResults?: CalibrationResults
  readingChannel?: number | null
}

export function ControllerDisplay({ config, savedConfig, activeButton, onSelect, calibrationMode = false, calibrationResults, readingChannel = null }: ControllerDisplayProps) {
  return <div className="controller">
    <div className="controller-brand">RAPID<span>JAM</span><small>MAGNETIC INPUT · ADC29</small></div>
    <div className="button-grid">
      {layout.map((id) => {
        const changed = config.hallMappings[id] !== savedConfig.hallMappings[id] || JSON.stringify(config.hall[id]) !== JSON.stringify(savedConfig.hall[id])
        const state = calibrationResults?.[id]?.status
        const reading = calibrationMode && readingChannel === Number(id.slice(2))
        return <button key={id} className={`controller-key key-${id} ${activeButton === id ? 'active' : ''} ${changed ? 'changed' : ''} ${calibrationMode && state ? `calibration-${state}` : ''} ${reading ? 'calibration-reading' : ''}`} onClick={() => onSelect(id)}>
          <span>{calibrationMode ? id.toUpperCase() : config.hallMappings[id]}</span>
        </button>
      })}
    </div>
    <div className="controller-edge" />
  </div>
}
