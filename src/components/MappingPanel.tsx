import { SlidersHorizontal, Zap } from 'lucide-react'
import type { Action, DeviceConfig, GpioAssignment, GpioPin, HallChannel } from '../device'
import { ACTIONS, GPIO_ASSIGNMENTS, GPIO_LABELS, HALL_LABELS } from '../config/constants'
import { ControllerDisplay } from './ControllerDisplay'

interface MappingPanelProps {
  config: DeviceConfig
  savedConfig: DeviceConfig
  activeButton: HallChannel
  onSelect: (id: HallChannel) => void
  onChange: (id: HallChannel, action: Action) => void
  onGpioChange: (id: GpioPin, action: GpioAssignment) => void
}

export function MappingPanel({ config, savedConfig, activeButton, onSelect, onChange, onGpioChange }: MappingPanelProps) {
  return <div className="mapping-stack">
    <div className="panel-grid">
      <div className="preview-panel">
        <div className="panel-topline"><span>LIVE PREVIEW · HALL CH 0–15</span><span className="live-chip"><span />Connected</span></div>
        <ControllerDisplay config={config} savedConfig={savedConfig} activeButton={activeButton} onSelect={onSelect} />
        <p className="helper"><SlidersHorizontal size={15} /> Select a channel to edit its assignment</p>
      </div>
      <div className="editor-panel">
        <div className="selected-label">SELECTED CHANNEL</div>
        <h2>{activeButton.toUpperCase()} <span>· {HALL_LABELS[activeButton]}</span></h2>
        <label className="field-label" htmlFor="action">Gamepad action</label>
        <select id="action" value={config.hallMappings[activeButton]} onChange={(event) => onChange(activeButton, event.target.value as Action)}>{ACTIONS.map((action) => <option key={action} value={action}>{action === 'NONE' ? 'Disabled' : action}</option>)}</select>
        <div className="info-box"><Zap size={16} /><div><strong>Physical Hall channel</strong><p>ADC29 · 16-channel multiplexer · Select pins 13 / 14 / 15 / 26</p></div></div>
      </div>
    </div>
    <div className="gpio-panel">
      <div><div className="selected-label">GPIO ASSIGNMENTS · GP0–GP5</div><p>GP13–GP15, GP25–GP26 and GP29 are reserved for add-ons and are hidden.</p></div>
      <div className="gpio-grid">{(Object.keys(GPIO_LABELS) as GpioPin[]).map((id) => <label className={config.gpioMappings[id] !== savedConfig.gpioMappings[id] ? 'changed' : ''} key={id}><span>{GPIO_LABELS[id]}</span><select value={config.gpioMappings[id]} onChange={(event) => onGpioChange(id, event.target.value as GpioAssignment)}>{GPIO_ASSIGNMENTS.map((assignment) => <option key={assignment.value} value={assignment.value}>{assignment.label}</option>)}</select></label>)}</div>
    </div>
  </div>
}
