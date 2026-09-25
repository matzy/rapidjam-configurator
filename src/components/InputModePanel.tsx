import type { DeviceConfig, InputModeConfig, KeyboardAction } from '../device'
import { AUTH_OPTIONS, DEVICE_TYPE_OPTIONS, INPUT_MODE_OPTIONS, keyboardLabels } from '../config/inputModes'

interface InputModePanelProps {
  config: DeviceConfig
  onInputModeChange: (patch: Partial<InputModeConfig>) => void
  onKeyboardChange: (action: KeyboardAction, key: number) => void
}

const inputModeName = (value: number) => INPUT_MODE_OPTIONS.find((option) => option.value === value)?.label ?? `Legacy mode (${value})`

export function InputModePanel({ config, onInputModeChange, onKeyboardChange }: InputModePanelProps) {
  const mode = INPUT_MODE_OPTIONS.find((option) => option.value === config.inputMode.inputMode)
  const showKeyboard = config.inputMode.inputMode === 3
  const showDeviceType = Boolean(mode?.deviceTypes?.length)
  const authField = mode?.authFields?.[0]
  const showUsb = Boolean(mode?.usbOverride)

  return <div className="settings-stack">
    <section className="editor-panel settings-section">
      <div className="selected-label">INPUT MODE SETTINGS</div>
      <h2>Current Input Mode</h2>
      <p className="panel-copy">Choose the USB or console protocol RapidJAM exposes after the next restart.</p>
      <label className="field-label" htmlFor="current-input-mode">Current Input Mode</label>
      <select id="current-input-mode" value={config.inputMode.inputMode} onChange={(event) => onInputModeChange({ inputMode: Number(event.target.value) })}>
        {(['PC / current', 'console'] as const).map((group) => <optgroup label={group} key={group}>
          {INPUT_MODE_OPTIONS.filter((option) => option.group === group).map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
        </optgroup>)}
      </select>
      {!mode && <p className="calibration-unavailable">The current firmware mode is not in the modern catalogue. Select a supported mode to replace it.</p>}
      <div className="info-box"><div><strong>{inputModeName(config.inputMode.inputMode)}</strong><p>Input mode changes are saved to the device but require a restart in gamepad mode to enumerate the new protocol.</p></div></div>
    </section>

    {showKeyboard && <section className="editor-panel settings-section">
      <div className="selected-label">KEYBOARD MAPPING</div>
      <h2>Keyboard Mapping</h2>
      <p className="panel-copy">Assign USB HID keyboard usages to each RapidJAM action.</p>
      <div className="keyboard-grid">{keyboardLabels.map((action) => <label key={action}><span>{action}</span><input type="number" min={0} max={255} value={config.keyboardMappings[action]} onChange={(event) => onKeyboardChange(action, Number(event.target.value))} /></label>)}</div>
      <p className="helper">Values are USB HID usage IDs. Use 0 to leave an action unassigned.</p>
    </section>}

    {showDeviceType && <section className="editor-panel settings-section">
      <div className="selected-label">DEVICE PROFILE</div>
      <h2>Input Mode Controller Type</h2>
      <select value={config.inputMode.inputDeviceType} onChange={(event) => onInputModeChange({ inputDeviceType: Number(event.target.value) })}>{(mode?.deviceTypes ?? []).map((value) => <option value={value} key={value}>{DEVICE_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? `Type ${value}`}</option>)}</select>
    </section>}

    {authField && <section className="editor-panel settings-section">
      <div className="selected-label">AUTHENTICATION</div>
      <h2>Authentication Settings</h2>
      <select value={config.inputMode[authField]} onChange={(event) => onInputModeChange({ [authField]: Number(event.target.value) })}>{AUTH_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select>
      <p className="helper">Authentication availability depends on the connected hardware and firmware add-ons.</p>
    </section>}

    {(config.inputMode.inputMode === 4 || config.inputMode.inputMode === 13) && <section className="editor-panel settings-section">
      <div className="selected-label">CONTROLLER IDENTITY</div>
      <h2>Console compatibility</h2>
      <label className="toggle-row"><span><strong>Swap Share and Touchpad labels</strong><small>Use the alternate physical button labels for this mode.</small></span><input type="checkbox" checked={config.inputMode.switchTpShareForDs4} onChange={(event) => onInputModeChange({ switchTpShareForDs4: event.target.checked })} /><span className="toggle" /></label>
      <label className="field-label" htmlFor="controller-id-mode">Controller identification mode</label>
      <select id="controller-id-mode" value={config.inputMode.ps4ControllerIDMode} onChange={(event) => onInputModeChange({ ps4ControllerIDMode: Number(event.target.value) })}><option value={0}>Default</option><option value={1}>Board identity</option></select>
    </section>}

    {showUsb && <section className="editor-panel settings-section">
      <div className="selected-label">ADVANCED USB IDENTITY</div>
      <h2>USB descriptor override</h2>
      <label className="toggle-row"><span><strong>Override USB descriptor</strong><small>Use custom product, manufacturer, and version strings.</small></span><input type="checkbox" checked={config.inputMode.usbDescOverride} onChange={(event) => onInputModeChange({ usbDescOverride: event.target.checked })} /><span className="toggle" /></label>
      {config.inputMode.usbDescOverride && <div className="form-grid"><label>Product<input maxLength={32} value={config.inputMode.usbDescProduct} onChange={(event) => onInputModeChange({ usbDescProduct: event.target.value })} /></label><label>Manufacturer<input maxLength={32} value={config.inputMode.usbDescManufacturer} onChange={(event) => onInputModeChange({ usbDescManufacturer: event.target.value })} /></label><label>Version<input maxLength={8} value={config.inputMode.usbDescVersion} onChange={(event) => onInputModeChange({ usbDescVersion: event.target.value })} /></label></div>}
      <label className="toggle-row"><span><strong>Override Vendor/Product ID</strong><small>Only use IDs assigned to your hardware.</small></span><input type="checkbox" checked={config.inputMode.usbOverrideID} onChange={(event) => onInputModeChange({ usbOverrideID: event.target.checked })} /><span className="toggle" /></label>
      {config.inputMode.usbOverrideID && <div className="form-grid"><label>Vendor ID<input maxLength={4} value={config.inputMode.usbVendorID} onChange={(event) => onInputModeChange({ usbVendorID: event.target.value.toUpperCase().replace(/[^0-9A-F]/g, '') })} /></label><label>Product ID<input maxLength={4} value={config.inputMode.usbProductID} onChange={(event) => onInputModeChange({ usbProductID: event.target.value.toUpperCase().replace(/[^0-9A-F]/g, '') })} /></label></div>}
    </section>}
  </div>
}
