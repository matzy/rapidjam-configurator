import { SlidersHorizontal, Zap } from 'lucide-react'
import { keyboardActionFor, type Action, type DeviceConfig, type GpioAssignment, type GpioPin, type HallChannel, type InputModeConfig, type KeyboardAction } from '../device'
import { ACTIONS, GPIO_ASSIGNMENTS, GPIO_LABELS, HALL_LABELS } from '../config/constants'
import { ControllerDisplay } from './ControllerDisplay'
import { INPUT_MODE_OPTIONS, KEY_CODES, keyboardKeyLabel } from '../config/inputModes'

interface MappingPanelProps {
  config: DeviceConfig
  savedConfig: DeviceConfig
  activeButton: HallChannel
  onSelect: (id: HallChannel) => void
  onChange: (id: HallChannel, action: Action) => void
  onGpioChange: (id: GpioPin, action: GpioAssignment) => void
  onInputModeChange: (patch: Partial<InputModeConfig>) => void
  onKeyboardMappingChange: (action: KeyboardAction, key: number) => void
}

export function MappingPanel({ config, savedConfig, activeButton, onSelect, onChange, onGpioChange, onInputModeChange, onKeyboardMappingChange }: MappingPanelProps) {
  const keyboardMode = config.inputMode.inputMode === 3
  const mode = INPUT_MODE_OPTIONS.find((option) => option.value === config.inputMode.inputMode)
  const authField = mode?.authFields?.[0]
  const activeAction = config.hallMappings[activeButton]
  const activeKeyboardAction = keyboardActionFor(activeAction)
  const keyOptions = (value: number) => KEY_CODES.some((key) => key.value === value) ? KEY_CODES : [...KEY_CODES, { label: keyboardKeyLabel(value), value }]
  const keySelect = (action: KeyboardAction) => <select value={config.keyboardMappings[action]} onChange={(event) => onKeyboardMappingChange(action, Number(event.target.value))}>{keyOptions(config.keyboardMappings[action]).map((key) => <option value={key.value} key={`${key.value}-${key.label}`}>{key.label}</option>)}</select>
  return <div className="mapping-stack">
    <div className="editor-panel mode-bar">
      <div><div className="selected-label">INPUT MODE</div><strong>{keyboardMode ? 'Keyboard mapping' : 'Controller mapping'}</strong><p>{keyboardMode ? 'Assign HID keys to the existing Gamepad actions.' : 'Choose the protocol used after the next restart.'}</p></div>
      <select aria-label="Current Input Mode" value={config.inputMode.inputMode} onChange={(event) => onInputModeChange({ inputMode: Number(event.target.value) })}>{INPUT_MODE_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select>
    </div>
    <details className="advanced-settings">
      <summary>Advanced input mode settings</summary>
      <div className="advanced-grid">
        {mode?.deviceTypes?.length ? <label>Controller type<select value={config.inputMode.inputDeviceType} onChange={(event) => onInputModeChange({ inputDeviceType: Number(event.target.value) })}>{mode.deviceTypes.map((value) => <option value={value} key={value}>{['Gamepad', 'Wheel', 'HOTAS', 'Guitar', 'Drums', 'Arcade stick'][value] ?? `Type ${value}`}</option>)}</select></label> : null}
        {authField ? <label>Authentication<select value={config.inputMode[authField]} onChange={(event) => onInputModeChange({ [authField]: Number(event.target.value) })}><option value={0}>None</option><option value={1}>Keys</option><option value={2}>USB host</option><option value={3}>I2C</option></select></label> : null}
        {(config.inputMode.inputMode === 4 || config.inputMode.inputMode === 13) ? <><label className="toggle-row"><span>Swap Share and Touchpad labels</span><input type="checkbox" checked={config.inputMode.switchTpShareForDs4} onChange={(event) => onInputModeChange({ switchTpShareForDs4: event.target.checked })} /></label><label>Controller identification<select value={config.inputMode.ps4ControllerIDMode} onChange={(event) => onInputModeChange({ ps4ControllerIDMode: Number(event.target.value) })}><option value={0}>Default</option><option value={1}>Board identity</option></select></label></> : null}
        {mode?.usbOverride ? <><label className="toggle-row"><span>Override USB descriptor</span><input type="checkbox" checked={config.inputMode.usbDescOverride} onChange={(event) => onInputModeChange({ usbDescOverride: event.target.checked })} /></label>{config.inputMode.usbDescOverride ? <><label>Product<input maxLength={32} value={config.inputMode.usbDescProduct} onChange={(event) => onInputModeChange({ usbDescProduct: event.target.value })} /></label><label>Manufacturer<input maxLength={32} value={config.inputMode.usbDescManufacturer} onChange={(event) => onInputModeChange({ usbDescManufacturer: event.target.value })} /></label><label>Version<input maxLength={8} value={config.inputMode.usbDescVersion} onChange={(event) => onInputModeChange({ usbDescVersion: event.target.value })} /></label></> : null}<label className="toggle-row"><span>Override Vendor/Product ID</span><input type="checkbox" checked={config.inputMode.usbOverrideID} onChange={(event) => onInputModeChange({ usbOverrideID: event.target.checked })} /></label>{config.inputMode.usbOverrideID ? <><label>Vendor ID<input maxLength={4} value={config.inputMode.usbVendorID} onChange={(event) => onInputModeChange({ usbVendorID: event.target.value.toUpperCase().replace(/[^0-9A-F]/g, '') })} /></label><label>Product ID<input maxLength={4} value={config.inputMode.usbProductID} onChange={(event) => onInputModeChange({ usbProductID: event.target.value.toUpperCase().replace(/[^0-9A-F]/g, '') })} /></label></> : null}</> : null}
      </div>
    </details>
    <div className="panel-grid">
      <div className="preview-panel">
        <div className="panel-topline"><span>LIVE PREVIEW · HALL CH 0–15</span><span className="live-chip"><span />Connected</span></div>
        <ControllerDisplay config={config} savedConfig={savedConfig} activeButton={activeButton} onSelect={onSelect} keyboardMode={keyboardMode} />
        <p className="helper"><SlidersHorizontal size={15} /> {keyboardMode ? 'Keys follow each input’s existing Gamepad action' : 'Select a channel to edit its assignment'}</p>
      </div>
      <div className="editor-panel">
        <div className="selected-label">SELECTED CHANNEL</div>
        <h2>{activeButton.toUpperCase()} <span>· {HALL_LABELS[activeButton]}</span></h2>
        <label className="field-label" htmlFor="action">{keyboardMode ? 'Existing Gamepad action' : 'Gamepad action'}</label>
        {keyboardMode ? <><input id="action" value={activeAction} readOnly />{activeKeyboardAction ? <><label className="field-label" htmlFor="keyboard-key">HID key for {activeKeyboardAction}</label><div id="keyboard-key">{keySelect(activeKeyboardAction)}</div></> : <p className="mapping-unavailable">This action has no Keyboard HID mapping.</p>}</> : <select id="action" value={activeAction} onChange={(event) => onChange(activeButton, event.target.value as Action)}>{ACTIONS.map((action) => <option key={action} value={action}>{action === 'NONE' ? 'Disabled' : action}</option>)}</select>}
        <div className="info-box"><Zap size={16} /><div><strong>Physical Hall channel</strong><p>ADC29 · 16-channel multiplexer · Select pins 13 / 14 / 15 / 26</p></div></div>
      </div>
    </div>
    <div className="gpio-panel">
      <div><div className="selected-label">GPIO ASSIGNMENTS · GP0–GP5</div><p>GP13–GP15, GP25–GP26 and GP29 are reserved for add-ons and are hidden.</p></div>
      <div className="gpio-grid">{(Object.keys(GPIO_LABELS) as GpioPin[]).map((id) => { const assignment = config.gpioMappings[id]; const action = keyboardActionFor(assignment); const changed = config.gpioMappings[id] !== savedConfig.gpioMappings[id] || (action !== null && config.keyboardMappings[action] !== savedConfig.keyboardMappings[action]); return <label className={changed ? 'changed' : ''} key={id}><span>{GPIO_LABELS[id]}</span>{keyboardMode ? action ? <>{action}{keySelect(action)}</> : <><span>{assignment}</span><small className="mapping-unavailable">No Keyboard HID mapping</small></> : <select value={assignment} onChange={(event) => onGpioChange(id, event.target.value as GpioAssignment)}>{GPIO_ASSIGNMENTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>}</label> })}</div>
    </div>
  </div>
}
