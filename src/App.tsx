import { useEffect, useRef, useState } from 'react'
import type { SelectModifiers } from './components/ControllerDisplay'
import { AlertTriangle, Check, ChevronRight, CircleHelp, Link2, RotateCcw, Save, ShieldAlert, Usb, Zap } from 'lucide-react'
import { Action, DeviceConfig, DeviceTransport, GpioAssignment, GpioPin, HallCalibrationPatch, HallChannel, HallSetting } from './device'
import { rawToRatio } from './utils/calibrationMath'
import type { CalibrationResults } from './types/calibration'
import { ControllerDisplay as Controller } from './components/ControllerDisplay'
import { SettingNumber, SettingSlider } from './components/SettingControls'
import { MappingPanel as MappingPanelComponent } from './components/MappingPanel'
import { HallPanel as HallPanelComponent } from './components/HallPanel'
import { CalibrationPanel as CalibrationPanelComponent, CalibrationWorkspace as CalibrationWorkspaceComponent } from './components/CalibrationWorkspace'
import { createTransport } from './transport/createTransport'
import { useDeviceConfig } from './hooks/useDeviceConfig'
import { useStrokeSetting } from './hooks/useStrokeSetting'
import { useHallCalibration } from './hooks/useHallCalibration'
import { useHallTravel } from './hooks/useHallTravel'
import { HallLiveReadCoordinator, LiveHallReadTimeoutError } from './transport/HallLiveReadCoordinator'
import { useLocale } from './useLocale'
import { useSettingMode } from './hooks/useSettingMode'
import { actuationMaxFor } from './config/settingMode'
import { ButtonLabelProvider } from './ButtonLabelProvider'

const transport: DeviceTransport = createTransport()
const hallChannels = Array.from({ length: 16 }, (_, index) => `ch${index}` as HallChannel)

export function App() {
  const { locale, setLocale, t } = useLocale()
  const { settingMode, setSettingMode } = useSettingMode()
  const [expertConfirmOpen, setExpertConfirmOpen] = useState(false)
  const deviceConfig = useDeviceConfig(transport)
  const { device, config, savedConfig, dirty, busy, notice, diagnostic, connectionFailed, restartComplete, setNotice, connect, restartToGamepad, updateMapping, updateHallMany, updateGpio, updateInputMode, updateKeyboardMapping, save, discard, saveHallCalibration } = deviceConfig
  const strokeSetting = useStrokeSetting(device, settingMode)
  const [activeButton, setActiveButton] = useState<HallChannel>('ch14')
  const [selectedHallButtons, setSelectedHallButtons] = useState<HallChannel[]>(['ch14'])
  const [section, setSection] = useState<'mapping' | 'hall'>('mapping')
  const [hallLiveReads] = useState(() => new HallLiveReadCoordinator())
  const [calibrationStarting, setCalibrationStarting] = useState(false)
  const calibrationStartInFlight = useRef(false)
  const calibrationStartToken = useRef(0)
  const calibrationStartCancelRequested = useRef(false)
  const calibration = useHallCalibration(transport, setNotice)
  const { calibrationStage, calibrationResults, calibrationProgress } = { calibrationStage: calibration.stage, calibrationResults: calibration.results, calibrationProgress: calibration.progress }

  const activeHall = config.hall[activeButton]
  const hallTravel = useHallTravel(transport, activeButton, section === 'hall' && calibrationStage === 'idle' && !busy && !connectionFailed && !restartComplete && device !== null && device.transport !== 'mock', hallLiveReads, activeHall)

  useEffect(() => {
    if (!expertConfirmOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpertConfirmOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [expertConfirmOpen])

  function requestSettingMode(mode: 'standard' | 'expert') {
    if (mode === settingMode) return
    if (mode === 'expert') setExpertConfirmOpen(true)
    else setSettingMode('standard')
  }

  function confirmExpertMode() {
    setSettingMode('expert')
    setExpertConfirmOpen(false)
  }

  function selectHallButton(id: HallChannel, event?: SelectModifiers) {
    if (!event?.shiftKey && !event?.ctrlKey && !event?.metaKey) {
      setSelectedHallButtons([id])
      setActiveButton(id)
      return
    }
    setSelectedHallButtons((current) => {
      if (current.includes(id)) {
        if (current.length === 1) return current
        const remaining = current.filter((button) => button !== id)
        if (activeButton === id) setActiveButton(remaining[0])
        return remaining
      }
      return [...current, id]
    })
    setActiveButton(id)
  }

  function selectAllHallButtons() {
    setSelectedHallButtons(hallChannels)
  }

  async function startCalibration(targets?: HallChannel[]) {
    if (calibrationStartInFlight.current || hallLiveReads.requiresReconnect) return
    if (!transport.supportsLiveHallCalibration()) {
      await calibration.startCalibration(targets)
      return
    }
    calibrationStartInFlight.current = true
    calibrationStartCancelRequested.current = false
    setCalibrationStarting(true)
    const token = ++calibrationStartToken.current
    try {
      await hallLiveReads.pauseAndDrain()
      if (token !== calibrationStartToken.current || section !== 'hall' || connectionFailed || restartComplete) {
        hallLiveReads.resumeAfterCalibration()
        return
      }
      await calibration.startCalibration(targets)
    } catch (error) {
      if (error instanceof LiveHallReadTimeoutError) {
        setNotice('Calibration is blocked because a live request timed out. Reconnect the controller first.')
      } else {
        setNotice('Unable to stop live Hall reading safely. Calibration was not started.')
      }
    } finally {
      if (calibrationStartCancelRequested.current) {
        await calibration.waitForCaptureDrain()
        hallLiveReads.resumeAfterCalibration()
      }
      calibrationStartCancelRequested.current = false
      calibrationStartInFlight.current = false
      setCalibrationStarting(false)
    }
  }

  async function reconnectDevice() {
    calibrationStartToken.current += 1
    const connected = await connect()
    if (connected) hallLiveReads.resetAfterReconnect()
  }

  async function applyCalibration() {
    if (!calibrationResults || busy) return
    const nextHall = { ...config.hall }
    const patches: Partial<Record<HallChannel, HallCalibrationPatch>> = {}
    Object.entries(calibrationResults).forEach(([key, result]) => {
      if ((result.status !== 'complete' && result.status !== 'unstable') || result.pressed === null || result.polarity === null) return
      const id = key as HallChannel
      const old = config.hall[id]
      const sign = result.polarity === 'N' ? 1 : -1
      const span = Math.abs(result.pressed - result.idle)
      const activeFraction = Math.max(0.05, Math.min(0.95, rawToRatio(old.active, old.idle, old.pressed)))
      const releaseFraction = Math.max(0.05, Math.min(0.95, rawToRatio(old.threshold, old.idle, old.pressed)))
      const activeRaw = Math.round(result.idle + sign * span * activeFraction)
      const releaseRaw = Math.round(result.idle + sign * span * releaseFraction)
      nextHall[id] = { ...old, idle: result.idle, pressed: result.pressed, active: activeRaw, threshold: releaseRaw, pressRatio: rawToRatio(activeRaw, result.idle, result.pressed), releaseRatio: rawToRatio(releaseRaw, result.idle, result.pressed), polarity: result.polarity, calibrated: true }
      patches[id] = { idle: result.idle, active: activeRaw, pressed: result.pressed, threshold: releaseRaw, polarity: result.polarity }
    })
    if (!Object.keys(patches).length) {
      setNotice('No completed calibration results to apply')
      return
    }
    try {
      const nextConfig = { ...config, hall: nextHall }
      await saveHallCalibration(patches, nextConfig)
      calibration.cancel()
      hallLiveReads.resumeAfterCalibration()
    } catch (error) {
      setNotice('Calibration save failed')
    }
  }

  function cancelCalibration() {
    calibrationStartToken.current += 1
    if (calibrationStartInFlight.current) calibrationStartCancelRequested.current = true
    calibration.cancel()
    if (!calibrationStartInFlight.current) {
      void calibration.waitForCaptureDrain().then(() => hallLiveReads.resumeAfterCalibration())
    }
    setNotice('Calibration cancelled')
  }

  function handleCalibrationCircle(channel: HallChannel) {
    if (!calibrationResults || (calibrationStage !== 'capture' && calibrationStage !== 'review')) return
    const status = calibrationResults[channel].status
    if (status === 'excluded') return
    if (calibrationStage === 'review') {
      if (status !== 'complete' && status !== 'unstable' && status !== 'error') return
      calibration.remeasureFromReview(channel)
      return
    }
    if (status === 'waiting') {
      calibration.skipChannel(channel)
    } else {
      void calibration.retryChannel(channel)
    }
  }

  return <ButtonLabelProvider inputMode={config.inputMode.inputMode} swapTouchpadShare={config.inputMode.switchTpShareForDs4}>
    <div className="app-shell">
    {(connectionFailed || restartComplete) && <div className="connect-error-overlay">
      <div className="connect-error-card">
        {restartComplete ? <Check size={40} /> : <AlertTriangle size={40} />}
        {restartComplete ? <><h2>{t('RapidJAM is restarting in gamepad mode')}</h2><p>{t('The configurator connection will close while RapidJAM returns to normal gamepad operation.')}</p></> : <><h2>{t('Cannot connect to RapidJAM')}</h2><p>{t('Check the USB connection and make sure RapidJAM is running in WebConfig/RNDIS mode, then press Retry. Other controls are unavailable until the connection is restored.')}</p>{diagnostic && <code>{diagnostic}</code>}<button className="primary-button" onClick={() => void reconnectDevice()} disabled={busy}>{t(busy ? 'Connecting...' : 'Retry')}</button></>}
      </div>
    </div>}
    {expertConfirmOpen && <div className="connect-error-overlay">
      <div className="connect-error-card" role="alertdialog" aria-modal="true" aria-labelledby="expert-mode-title" aria-describedby="expert-mode-description">
        <ShieldAlert size={40} />
        <h2 id="expert-mode-title">{t('Switch to Expert mode?')}</h2>
        <p id="expert-mode-description">{t('Switch to Expert mode, which allows settings that are not recommended. Continue?')}</p>
        <div className="confirm-actions">
          <button className="secondary-button" autoFocus onClick={() => setExpertConfirmOpen(false)}>{t('Cancel')}</button>
          <button className="primary-button" onClick={confirmExpertMode}>{t('Switch mode')}</button>
        </div>
      </div>
    </div>}
    <header className="topbar" inert={expertConfirmOpen || undefined}>
      <div className="brand"><div className="brand-mark">RJ</div><div><strong>RapidJAM</strong><span>{t('CONFIGURATOR')}</span></div></div>
      <div className="device-status"><span className={`status-dot ${device ? 'online' : ''}`} />{device ? device.product : t('No device connected')}<span className="firmware">{device?.firmware ?? t('Connect a controller to begin')}</span></div>
      <button type="button" className={`setting-mode-switch ${settingMode === 'expert' ? 'selected' : ''}`} aria-pressed={settingMode === 'expert'} onClick={() => requestSettingMode(settingMode === 'expert' ? 'standard' : 'expert')}>{t('Expert mode')}</button>
      <label className="language-picker"><span className="visually-hidden">{t('Select language')}</span><select aria-label={t('Select language')} value={locale} onChange={(event) => setLocale(event.target.value as 'en' | 'ja')}><option value="ja">日本語</option><option value="en">English</option></select></label>
      <button className="icon-button" title={t('Help')} aria-label={t('Help')}><CircleHelp size={18} /></button>
    </header>

    <main className="workspace" inert={connectionFailed || restartComplete || expertConfirmOpen || undefined}>
      <aside className="sidebar">
        <div className="sidebar-heading">{t('CONFIGURATION')}</div>
        <button className={`nav-item ${section === 'mapping' ? 'selected' : ''}`} onClick={() => { calibrationStartToken.current += 1; setSection('mapping') }}><Link2 size={17} /> {t('Button mapping')} <ChevronRight size={15} /></button>
        <button className={`nav-item ${section === 'hall' ? 'selected' : ''}`} onClick={() => setSection('hall')}><Zap size={17} /> {t('Magnetic switches')} <ChevronRight size={15} /></button>
        <div className="sidebar-foot"><div className="connection-card"><Usb size={17} /><div><strong>{device ? t('RapidJAM connected') : t('Looking for device')}</strong><span>{device ? t(device.transport === 'tauri' ? 'WebConfig HTTP via desktop app' : device.transport === 'http' ? 'WebConfig HTTP via local proxy' : 'Mock transport') : t('Connect RapidJAM by USB')}</span></div></div><button className="text-button" onClick={() => void reconnectDevice()} disabled={busy || restartComplete || calibrationStage !== 'idle' || calibrationStarting}>{t(busy ? 'Connecting...' : 'Reconnect device')}</button><button className="text-button" onClick={() => void restartToGamepad()} disabled={busy || connectionFailed || restartComplete || calibrationStage !== 'idle' || calibrationStarting}>{t('Restart in gamepad mode')}</button>{diagnostic && <details className="diagnostic"><summary>{t('Connection diagnostic')}</summary><code>{diagnostic}</code></details>}</div>
      </aside>

      <section className="content">
        <div className="content-heading"><div><p className="eyebrow">{t(section === 'mapping' ? 'INPUT LAYOUT' : 'MAGNETIC INPUT')}</p><h1>{t(section === 'mapping' ? 'Button mapping' : 'Magnetic switches')}</h1><p className="lede">{t(section === 'mapping' ? 'Tune every input for the way you play.' : 'Shape the exact moment each button responds.')}</p></div><div className="notice"><span className="notice-dot" />{t(notice)}</div></div>
        {calibrationStage !== 'idle' && calibrationResults ? <CalibrationWorkspaceComponent config={config} savedConfig={savedConfig} stage={calibrationStage} results={calibrationResults} progress={calibrationProgress} onCircleClick={handleCalibrationCircle} onFinish={calibration.finishCapture} onApply={applyCalibration} onCancel={cancelCalibration} /> : section === 'mapping' ? <MappingPanelComponent config={config} savedConfig={savedConfig} activeButton={activeButton} onSelect={setActiveButton} onChange={updateMapping} onGpioChange={updateGpio} onInputModeChange={updateInputMode} onKeyboardMappingChange={updateKeyboardMapping} /> : <HallPanelComponent config={config} savedConfig={savedConfig} activeButton={activeButton} selectedButtons={selectedHallButtons} hall={activeHall} travelReading={hallTravel} strokeMm={strokeSetting.strokeMm} strokeLabel={strokeSetting.label} strokeSource={strokeSetting.source} showStrokeEditor={strokeSetting.showEditor} unsupportedDevice={strokeSetting.unsupportedDevice} onStrokeChange={strokeSetting.setCustomStroke} onStrokeReset={strokeSetting.resetStroke} isDemo={device?.transport === 'mock'} calibrationStarting={calibrationStarting} calibrationBlocked={hallLiveReads.requiresReconnect} onSelect={selectHallButton} onSelectAll={selectAllHallButtons} onChange={updateHallMany} calibrationAvailable={transport.supportsLiveHallCalibration()} onStartCalibration={startCalibration} actuationMax={actuationMaxFor(settingMode, strokeSetting.strokeMm)} calibrationPanel={<CalibrationPanelComponent stage={calibrationStage} results={calibrationResults} onFinish={calibration.finishCapture} onApply={applyCalibration} onCancel={cancelCalibration} />} />}
      </section>
    </main>

    <footer className="actionbar" inert={connectionFailed || restartComplete || expertConfirmOpen || undefined}><div className="draft-state">{dirty ? <><span className="draft-dot" />{t('Unsaved changes')}</> : <><Check size={15} />{t('All changes saved')}</>}<span className="separator" />{t(device?.transport === 'mock' ? 'Demo device' : 'RapidJAM')}</div><div className="actions"><button className="secondary-button" onClick={() => void discard()} disabled={!dirty || busy}><RotateCcw size={16} />{t('Discard')}</button><button className="primary-button" onClick={() => void save()} disabled={!dirty || busy}><Save size={16} />{t(busy ? 'Saving...' : 'Save to device')}</button></div></footer>
  </div>
  </ButtonLabelProvider>
}
