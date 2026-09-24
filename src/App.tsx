import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, ChevronRight, CircleHelp, Link2, RotateCcw, Save, SlidersHorizontal, Usb, Zap } from 'lucide-react'
import { Action, defaultConfig, DeviceConfig, DeviceInfo, DeviceTransport, GpioAssignment, GpioPin, HallChannel, HallSetting, HttpTransport, MockTransport } from './device'

const transport: DeviceTransport = new URLSearchParams(window.location.search).get('transport') === 'http'
  ? new HttpTransport('/rapidjam-api')
  : new MockTransport()
const hallLabels: Record<HallChannel, string> = { ch0: 'B2', ch1: 'R2', ch2: 'L2', ch3: 'B3', ch4: 'B4', ch5: 'R1', ch6: 'L1', ch7: 'S1', ch8: 'LEFT', ch9: 'DOWN', ch10: 'L3', ch11: 'UP', ch12: 'RIGHT', ch13: 'S2', ch14: 'B1', ch15: 'R3' }
const gpioLabels: Record<GpioPin, string> = { gp0: 'GP0', gp1: 'GP1', gp2: 'GP2', gp3: 'GP3', gp4: 'GP4', gp5: 'GP5' }
const actions: Action[] = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'B1', 'B2', 'B3', 'B4', 'L1', 'R1', 'L2', 'R2', 'L3', 'R3', 'S1', 'S2', 'A1', 'A2', 'NONE']
const gpioAssignments: Array<{ value: GpioAssignment, label: string }> = [
  ...actions.map((action) => ({ value: action, label: action === 'NONE' ? 'Unassigned' : action })),
  { value: 'TURBO_B1', label: 'Turbo · B1' }, { value: 'TURBO_B2', label: 'Turbo · B2' }, { value: 'TURBO_B3', label: 'Turbo · B3' }, { value: 'TURBO_B4', label: 'Turbo · B4' },
  { value: 'MACRO_1', label: 'Macro 1' }, { value: 'MACRO_2', label: 'Macro 2' }, { value: 'MACRO_3', label: 'Macro 3' }, { value: 'MACRO_4', label: 'Macro 4' },
  { value: 'ACCELERATOR', label: 'Accelerator' }, { value: 'BRAKE', label: 'Brake' }, { value: 'HOME', label: 'Home' }, { value: 'MENU_DOWN', label: 'Menu Down' }, { value: 'MENU_SELECT', label: 'Menu Select' }, { value: 'MENU_BACK', label: 'Menu Back' }, { value: 'FN', label: 'Function (Fn)' },
]
const rawToMm = (value: number, idle: number, pressed: number): number => Math.max(0.05, Math.min(1.5, Math.abs(value - idle) / Math.max(1, Math.abs(pressed - idle)) * 1.5))
const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
const calibrationPollIntervalMs = 250
type CalibrationStage = 'idle' | 'baseline' | 'capture' | 'review' | 'error'
type CalibrationResult = { idle: number, pressed: number | null, polarity: 'N' | 'P' | null, status: 'preparing' | 'waiting' | 'pressing' | 'complete' | 'skipped' | 'unstable' | 'error', attempt?: number, sampleCount?: number, latestVoltage?: number, error?: string }
type CalibrationResults = Record<HallChannel, CalibrationResult>
type CalibrationProgress = { phase: string, channel: number | null, attempt: number, successful: number, total: number }

export function App() {
  const [device, setDevice] = useState<DeviceInfo | null>(null)
  const [config, setConfig] = useState<DeviceConfig>(structuredClone(defaultConfig))
  const [savedConfig, setSavedConfig] = useState<DeviceConfig>(structuredClone(defaultConfig))
  const [activeButton, setActiveButton] = useState<HallChannel>('ch14')
  const [section, setSection] = useState<'mapping' | 'hall'>('mapping')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [diagnostic, setDiagnostic] = useState('')
  const [connectionFailed, setConnectionFailed] = useState(false)
  const [restartComplete, setRestartComplete] = useState(false)
  const [calibrationStage, setCalibrationStage] = useState<CalibrationStage>('idle')
  const [calibrationResults, setCalibrationResults] = useState<CalibrationResults | null>(null)
  const [calibrationProgress, setCalibrationProgress] = useState<CalibrationProgress>({ phase: 'Idle', channel: null, attempt: 0, successful: 0, total: 16 })
  const calibrationBaselines = useRef<number[]>([])
  const calibrationPeaks = useRef<number[]>([])
  const calibrationPressSamples = useRef<number[][]>(Array.from({ length: 16 }, () => []))
  const calibrationSkipped = useRef(new Set<HallChannel>())
  const calibrationCancelled = useRef(false)

  const dirty = JSON.stringify(config) !== JSON.stringify(savedConfig)
  const activeHall = config.hall[activeButton]

  useEffect(() => {
    void connect()
  }, [])

  async function connect() {
    setBusy(true)
    try {
      const info = await transport.connect()
      const next = await transport.readConfig()
      setDevice(info)
      setConfig(next)
      setSavedConfig(structuredClone(next))
      setNotice('Ready to configure')
      setConnectionFailed(false)
      setRestartComplete(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to connect'
      setNotice(message)
      setDiagnostic(`${new Date().toLocaleTimeString()}  ${message}`)
      setConnectionFailed(true)
    } finally { setBusy(false) }
  }

  async function restartToGamepad() {
    setBusy(true)
    try {
      await transport.restartToGamepad()
      setDevice(null)
      setRestartComplete(true)
      setNotice('RapidJAM is restarting in gamepad mode')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to restart RapidJAM'
      setNotice(message)
      setDiagnostic(`${new Date().toLocaleTimeString()}  ${message}`)
    } finally { setBusy(false) }
  }

  async function updateConfig(next: DeviceConfig) {
    setConfig(next)
    try {
      await transport.previewConfig(next)
      setNotice('Preview active on device')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Preview failed') }
  }

  function updateMapping(button: HallChannel, action: Action) {
    void updateConfig({ ...config, hallMappings: { ...config.hallMappings, [button]: action } })
  }

  function updateHall(button: HallChannel, patch: Partial<HallSetting>) {
    void updateConfig({ ...config, hall: { ...config.hall, [button]: { ...config.hall[button], ...patch } } })
  }

  function updateGpio(button: GpioPin, action: GpioAssignment) {
    void updateConfig({ ...config, gpioMappings: { ...config.gpioMappings, [button]: action } })
  }

  async function save() {
    setBusy(true)
    try {
      await transport.commitConfig(config)
      const confirmed = await transport.readConfig()
      setConfig(confirmed)
      setSavedConfig(structuredClone(confirmed))
      setNotice('Saved to RapidJAM')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Save failed') }
    finally { setBusy(false) }
  }

  async function discard() {
    await transport.discardPreview()
    setConfig(structuredClone(savedConfig))
    setNotice('Changes discarded')
  }

  async function startCalibration() {
    if (!transport.supportsLiveHallCalibration()) {
      setNotice('Live Hall calibration is disabled: the current firmware cannot read RapidJAM ADC29')
      return
    }
    calibrationCancelled.current = false
    calibrationSkipped.current.clear()
    calibrationPressSamples.current = Array.from({ length: 16 }, () => [])
    setCalibrationProgress({ phase: 'Preparing device', channel: null, attempt: 0, successful: 0, total: 16 })
    setCalibrationResults(Object.fromEntries(Array.from({ length: 16 }, (_, channel) => [`ch${channel}`, { idle: 0, pressed: null, polarity: null, status: 'preparing' }])) as CalibrationResults)
    setCalibrationStage('baseline')
    setNotice('Leave all Hall buttons untouched while measuring idle values')
    try {
      await transport.prepareHallCalibration()
      const samples: number[][] = Array.from({ length: 16 }, () => [])
      const baselineErrors: Array<string | undefined> = Array.from({ length: 16 })
      for (let round = 0; round < 6 && samples.some((values) => values.length < 3); round++) {
        for (let channel = 0; channel < 16; channel++) {
          if (samples[channel].length >= 3) continue
          setCalibrationProgress((current) => ({ ...current, phase: `Baseline sample ${round + 1} / 6`, channel, attempt: 0 }))
          try {
            samples[channel].push(await transport.readHallVoltage(channel, (attempt) => {
              setCalibrationProgress((current) => ({ ...current, channel, attempt }))
              setCalibrationResults((current) => current ? { ...current, [`ch${channel}`]: { ...current[`ch${channel}`], status: 'waiting', attempt, sampleCount: samples[channel].length } } : current)
            }))
          } catch (error) {
            baselineErrors[channel] = error instanceof Error ? error.message : 'Voltage read failed'
          }
          setCalibrationResults((current) => current ? { ...current, [`ch${channel}`]: { ...current[`ch${channel}`], sampleCount: samples[channel].length, latestVoltage: samples[channel][samples[channel].length - 1] } } : current)
          await wait(45)
          setCalibrationProgress((current) => ({ ...current, successful: samples.filter((values) => values.length >= 3).length }))
        }
      }
      const baselines = samples.map((values) => values.length >= 3 ? [...values].sort((a, b) => a - b)[1] : 0)
      calibrationBaselines.current = baselines
      calibrationPeaks.current = [...baselines]
      setCalibrationResults(Object.fromEntries(baselines.map((idle, channel) => [`ch${channel}`, samples[channel].length >= 3 ? { idle, pressed: null, polarity: null, status: 'waiting', sampleCount: samples[channel].length, latestVoltage: samples[channel][samples[channel].length - 1] } : { idle, pressed: null, polarity: null, status: 'error', sampleCount: samples[channel].length, latestVoltage: samples[channel][samples[channel].length - 1], error: baselineErrors[channel] ?? 'Fewer than 3 successful baseline samples' }])) as CalibrationResults)
      setCalibrationStage('capture')
      setCalibrationProgress({ phase: 'Press phase ready', channel: null, attempt: 0, successful: 0, total: 16 })
      setNotice('Press each Hall button fully once, in any order')
    } catch (error) {
      setCalibrationStage('error')
      setNotice(error instanceof Error ? error.message : 'Calibration failed')
    }
  }

  useEffect(() => {
    if (calibrationStage !== 'capture') return
    let cancelled = false
    const capture = async () => {
      while (!cancelled && !calibrationCancelled.current && calibrationStage === 'capture') {
        for (let channel = 0; channel < 16 && !cancelled; channel++) {
          if (calibrationPressSamples.current[channel].length >= 3 || calibrationSkipped.current.has(`ch${channel}` as HallChannel)) continue
          setCalibrationProgress((current) => ({ ...current, phase: 'Checking for button press', channel, attempt: 0 }))
          let value: number
          try {
            value = await transport.readHallVoltage(channel)
          } catch {
            await wait(calibrationPollIntervalMs)
            continue
          }
          const idle = calibrationBaselines.current[channel]
          const previous = calibrationPeaks.current[channel]
          if (Math.abs(value - idle) > Math.abs(previous - idle)) calibrationPeaks.current[channel] = value
          const peak = calibrationPeaks.current[channel]
          if (Math.abs(peak - idle) >= 150) {
            setCalibrationResults((current) => current ? { ...current, [`ch${channel}`]: { ...current[`ch${channel}`], status: 'pressing', latestVoltage: value } } : current)
            while (calibrationPressSamples.current[channel].length < 3 && !cancelled && !calibrationCancelled.current) {
              let pressedValue: number
              try {
                pressedValue = await transport.readHallVoltage(channel, (attempt) => {
                  setCalibrationProgress((current) => ({ ...current, phase: 'Reading pressed channel', channel, attempt }))
                  setCalibrationResults((current) => current ? { ...current, [`ch${channel}`]: { ...current[`ch${channel}`], status: 'pressing', attempt } } : current)
                })
              } catch (error) {
                setCalibrationResults((current) => current ? { ...current, [`ch${channel}`]: { ...current[`ch${channel}`], status: 'error', error: error instanceof Error ? error.message : 'Voltage read failed' } } : current)
                setCalibrationProgress((current) => ({ ...current, phase: 'Moving to next channel', channel, attempt: 30 }))
                break
              }
              if (Math.abs(pressedValue - idle) < 150) {
                calibrationPressSamples.current[channel] = []
                setCalibrationResults((current) => current ? { ...current, [`ch${channel}`]: { ...current[`ch${channel}`], status: 'waiting', sampleCount: 0, latestVoltage: pressedValue, error: 'Button released before three samples' } } : current)
                break
              }
              calibrationPressSamples.current[channel].push(pressedValue)
              const samples = calibrationPressSamples.current[channel]
              const pressed = [...samples].sort((a, b) => b - a)[1]
              setCalibrationProgress((current) => ({ ...current, phase: `Collecting press samples ${samples.length} / 3`, channel, attempt: 0 }))
              setCalibrationResults((current) => current ? { ...current, [`ch${channel}`]: { ...current[`ch${channel}`], status: 'waiting', sampleCount: samples.length, latestVoltage: pressedValue } } : current)
              if (samples.length >= 3) {
                setCalibrationResults((current) => current ? { ...current, [`ch${channel}`]: { idle, pressed, polarity: pressed >= idle ? 'N' : 'P', status: 'complete', sampleCount: 3, latestVoltage: pressedValue } } : current)
                setCalibrationProgress((current) => ({ ...current, phase: 'Button captured', successful: current.successful + 1 }))
              } else await wait(calibrationPollIntervalMs)
            }
          }
          await wait(calibrationPollIntervalMs)
        }
        const allCaptureTargetsResolved = calibrationPressSamples.current.every((samples, index) => samples.length >= 3 || calibrationSkipped.current.has(`ch${index}` as HallChannel))
        if (allCaptureTargetsResolved) {
          calibrationCancelled.current = true
          setCalibrationStage('review')
          setCalibrationProgress((current) => ({ ...current, phase: 'Review calibration results', channel: null, attempt: 0 }))
          setNotice('All Hall channels are complete. Review the results before applying them.')
          return
        }
      }
    }
    void capture().catch((error) => { setCalibrationStage('error'); setNotice(error instanceof Error ? error.message : 'Calibration read failed') })
    return () => { cancelled = true; calibrationCancelled.current = true }
  }, [calibrationStage])

  function finishCalibrationCapture() {
    calibrationCancelled.current = true
    setCalibrationStage('review')
      setCalibrationProgress((current) => ({ ...current, phase: 'Review calibration results', channel: null, attempt: 0 }))
      setNotice('Review calibration results')
  }

  function applyCalibration() {
    if (!calibrationResults) return
    const nextHall = { ...config.hall }
    Object.entries(calibrationResults).forEach(([key, result]) => {
      if (result.status !== 'complete' || result.pressed === null || result.polarity === null) return
      const id = key as HallChannel
      const old = config.hall[id]
      const sign = result.polarity === 'N' ? 1 : -1
      const span = Math.abs(result.pressed - result.idle)
      const activeFraction = Math.max(0.05, Math.min(0.95, Math.abs(old.active - old.idle) / Math.max(1, Math.abs(old.pressed - old.idle))))
      const releaseFraction = Math.max(0.05, Math.min(0.95, Math.abs(old.release - old.idle) / Math.max(1, Math.abs(old.pressed - old.idle))))
      const activeRaw = Math.round(result.idle + sign * span * activeFraction)
      const releaseRaw = Math.round(result.idle + sign * span * releaseFraction)
      nextHall[id] = { ...old, idle: result.idle, pressed: result.pressed, active: activeRaw, threshold: releaseRaw, release: rawToMm(releaseRaw, result.idle, result.pressed), polarity: result.polarity, calibrated: true }
    })
    void updateConfig({ ...config, hall: nextHall })
    setCalibrationStage('idle')
    setNotice('Calibration results applied to draft')
  }

  function cancelCalibration() {
    calibrationCancelled.current = true
    setCalibrationStage('idle')
    setCalibrationResults(null)
    setNotice('Calibration cancelled')
  }

  async function retryCalibrationChannel(channel: HallChannel) {
    if (!calibrationResults || calibrationStage === 'baseline') return
    const index = Number(channel.slice(2))
    calibrationPressSamples.current[index] = []
    calibrationSkipped.current.delete(channel)
    calibrationPeaks.current[index] = calibrationBaselines.current[index]
    setCalibrationResults((current) => current ? { ...current, [channel]: { ...current[channel], status: 'waiting', error: undefined } } : current)
    try {
      const idle = calibrationBaselines.current[index]
      while (calibrationPressSamples.current[index].length < 3) {
        const value = await transport.readHallVoltage(index, (attempt) => {
          setCalibrationProgress((current) => ({ ...current, phase: 'Re-measuring channel', channel: index, attempt }))
          setCalibrationResults((current) => current ? { ...current, [channel]: { ...current[channel], status: 'pressing', attempt } } : current)
        })
        const previous = calibrationPeaks.current[index]
        const peak = Math.abs(value - idle) > Math.abs(previous - idle) ? value : previous
        calibrationPeaks.current[index] = peak
        if (Math.abs(peak - idle) < 150) throw new Error('Press the button fully, then retry')
        const samples = [...calibrationPressSamples.current[index], value]
        calibrationPressSamples.current[index] = samples
        setCalibrationResults((current) => current ? { ...current, [channel]: { ...current[channel], status: 'waiting', sampleCount: samples.length, latestVoltage: value } } : current)
        await wait(50)
      }
      const samples = calibrationPressSamples.current[index]
      const pressed = [...samples].sort((a, b) => b - a)[1]
      setCalibrationResults((current) => current ? { ...current, [channel]: { idle, pressed, polarity: pressed >= idle ? 'N' : 'P', status: 'complete', attempt: 0, sampleCount: samples.length, latestVoltage: samples[samples.length - 1] } } : current)
    } catch (error) {
      setCalibrationResults((current) => current ? { ...current, [channel]: { ...current[channel], status: 'error', error: error instanceof Error ? error.message : 'Voltage read failed' } } : current)
    }
  }

  function handleCalibrationCircle(channel: HallChannel) {
    if (!calibrationResults || (calibrationStage !== 'capture' && calibrationStage !== 'review')) return
    const status = calibrationResults[channel].status
    if (calibrationStage === 'review') {
      if (status !== 'complete' && status !== 'error') return
      const index = Number(channel.slice(2))
      calibrationCancelled.current = false
      calibrationPressSamples.current[index] = []
      calibrationSkipped.current.delete(channel)
      calibrationPeaks.current[index] = calibrationBaselines.current[index]
      setCalibrationResults((current) => current ? { ...current, [channel]: { ...current[channel], status: 'waiting', sampleCount: 0, pressed: null, error: undefined } } : current)
      setCalibrationProgress({ phase: 'Ready to re-measure channel', channel: index, attempt: 0, successful: 0, total: 16 })
      setCalibrationStage('capture')
      setNotice(`${channel.toUpperCase()} is ready for re-measurement`)
      return
    }
    if (status === 'waiting') {
      calibrationSkipped.current.add(channel)
      setCalibrationResults((current) => current ? { ...current, [channel]: { ...current[channel], status: 'skipped', error: 'Skipped by user' } } : current)
    } else {
      void retryCalibrationChannel(channel)
    }
  }

  return <div className="app-shell">
    {(connectionFailed || restartComplete) && <div className="connect-error-overlay">
      <div className="connect-error-card">
        {restartComplete ? <Check size={40} /> : <AlertTriangle size={40} />}
        {restartComplete ? <><h2>RapidJAM is restarting in gamepad mode</h2><p>The configurator connection will close while RapidJAM returns to normal gamepad operation.</p></> : <><h2>Cannot connect to RapidJAM</h2><p>Check the USB connection and press Retry. Other controls are unavailable until the connection is restored.</p>{diagnostic && <code>{diagnostic}</code>}<button className="primary-button" onClick={() => void connect()} disabled={busy}>{busy ? 'Connecting...' : 'Retry'}</button></>}
      </div>
    </div>}
    <header className="topbar">
      <div className="brand"><div className="brand-mark">RJ</div><div><strong>RapidJAM</strong><span>CONTROL CENTER</span></div></div>
      <div className="device-status"><span className={`status-dot ${device ? 'online' : ''}`} />{device ? device.product : 'No device connected'}<span className="firmware">{device?.firmware ?? 'Connect a controller to begin'}</span></div>
      <button className="icon-button" title="Help"><CircleHelp size={18} /></button>
    </header>

    <main className="workspace" inert={connectionFailed || restartComplete || undefined}>
      <aside className="sidebar">
        <div className="sidebar-heading">CONFIGURATION</div>
        <button className={`nav-item ${section === 'mapping' ? 'selected' : ''}`} onClick={() => setSection('mapping')}><Link2 size={17} /> Button mapping <ChevronRight size={15} /></button>
        <button className={`nav-item ${section === 'hall' ? 'selected' : ''}`} onClick={() => setSection('hall')}><Zap size={17} /> Magnetic switches <ChevronRight size={15} /></button>
        <div className="sidebar-foot"><div className="connection-card"><Usb size={17} /><div><strong>{device ? 'USB connected' : 'Looking for device'}</strong><span>{device ? (device.transport === 'http' ? 'WebConfig HTTP via local proxy' : 'Mock transport') : 'Connect RapidJAM by USB'}</span></div></div><button className="text-button" onClick={() => void connect()} disabled={busy || restartComplete}>{busy ? 'Connecting...' : 'Reconnect device'}</button><button className="text-button" onClick={() => void restartToGamepad()} disabled={busy || connectionFailed || restartComplete}>Restart in gamepad mode</button>{diagnostic && <details className="diagnostic"><summary>Connection diagnostic</summary><code>{diagnostic}</code></details>}</div>
      </aside>

      <section className="content">
        <div className="content-heading"><div><p className="eyebrow">{section === 'mapping' ? 'INPUT LAYOUT' : 'MAGNETIC INPUT'}</p><h1>{section === 'mapping' ? 'Button mapping' : 'Magnetic switches'}</h1><p className="lede">{section === 'mapping' ? 'Tune every input for the way you play.' : 'Shape the exact moment each button responds.'}</p></div><div className="notice"><span className="notice-dot" />{notice}</div></div>
        {calibrationStage !== 'idle' && calibrationResults ? <CalibrationWorkspace config={config} savedConfig={savedConfig} stage={calibrationStage} results={calibrationResults} progress={calibrationProgress} onCircleClick={handleCalibrationCircle} onFinish={finishCalibrationCapture} onApply={applyCalibration} onCancel={cancelCalibration} /> : section === 'mapping' ? <MappingPanel config={config} savedConfig={savedConfig} activeButton={activeButton} onSelect={setActiveButton} onChange={updateMapping} onGpioChange={updateGpio} /> : <HallPanel config={config} savedConfig={savedConfig} activeButton={activeButton} hall={activeHall} onSelect={setActiveButton} onChange={updateHall} calibrationStage={calibrationStage} calibrationResults={calibrationResults} calibrationAvailable={transport.supportsLiveHallCalibration()} onStartCalibration={startCalibration} onFinishCalibration={finishCalibrationCapture} onApplyCalibration={applyCalibration} onCancelCalibration={cancelCalibration} />}
      </section>
    </main>

    <footer className="actionbar" inert={connectionFailed || restartComplete || undefined}><div className="draft-state">{dirty ? <><span className="draft-dot" />Unsaved changes</> : <><Check size={15} />All changes saved</>}<span className="separator" />{device?.transport === 'mock' ? 'Demo device' : 'RapidJAM'}</div><div className="actions"><button className="secondary-button" onClick={() => void discard()} disabled={!dirty || busy}><RotateCcw size={16} />Discard</button><button className="primary-button" onClick={() => void save()} disabled={!dirty || busy}><Save size={16} />{busy ? 'Saving...' : 'Save to device'}</button></div></footer>
  </div>
}

function Controller({ config, savedConfig, activeButton, onSelect, calibrationMode = false, calibrationResults, readingChannel = null }: { config: DeviceConfig, savedConfig: DeviceConfig, activeButton: HallChannel, onSelect: (id: HallChannel) => void, calibrationMode?: boolean, calibrationResults?: CalibrationResults, readingChannel?: number | null }) {
  const layout: HallChannel[] = ['ch7', 'ch6', 'ch5', 'ch4', 'ch3', 'ch2', 'ch8', 'ch9', 'ch11', 'ch12', 'ch14', 'ch0', 'ch1', 'ch15', 'ch10', 'ch13']
  return <div className="controller"><div className="controller-brand">RAPID<span>JAM</span><small>MAGNETIC INPUT · ADC29</small></div><div className="button-grid">{layout.map((id) => { const changed = config.hallMappings[id] !== savedConfig.hallMappings[id] || JSON.stringify(config.hall[id]) !== JSON.stringify(savedConfig.hall[id]); const state = calibrationResults?.[id]?.status; const reading = calibrationMode && readingChannel === Number(id.slice(2)); return <button key={id} className={`controller-key key-${id} ${activeButton === id ? 'active' : ''} ${changed ? 'changed' : ''} ${calibrationMode && state ? `calibration-${state}` : ''} ${reading ? 'calibration-reading' : ''}`} onClick={() => onSelect(id)}><span>{calibrationMode ? id.toUpperCase() : config.hallMappings[id]}</span></button> })}</div><div className="controller-edge" /></div>
}

function MappingPanel({ config, savedConfig, activeButton, onSelect, onChange, onGpioChange }: { config: DeviceConfig, savedConfig: DeviceConfig, activeButton: HallChannel, onSelect: (id: HallChannel) => void, onChange: (id: HallChannel, action: Action) => void, onGpioChange: (id: GpioPin, action: GpioAssignment) => void }) {
  return <div className="mapping-stack"><div className="panel-grid"><div className="preview-panel"><div className="panel-topline"><span>LIVE PREVIEW · HALL CH 0–15</span><span className="live-chip"><span />Connected</span></div><Controller config={config} savedConfig={savedConfig} activeButton={activeButton} onSelect={onSelect} /><p className="helper"><SlidersHorizontal size={15} /> Select a channel to edit its assignment</p></div><div className="editor-panel"><div className="selected-label">SELECTED CHANNEL</div><h2>{activeButton.toUpperCase()} <span>· {hallLabels[activeButton]}</span></h2><label className="field-label" htmlFor="action">Gamepad action</label><select id="action" value={config.hallMappings[activeButton]} onChange={(event) => onChange(activeButton, event.target.value as Action)}>{actions.map((action) => <option key={action} value={action}>{action === 'NONE' ? 'Disabled' : action}</option>)}</select><div className="info-box"><Zap size={16} /><div><strong>Physical Hall channel</strong><p>ADC29 · 16-channel multiplexer · Select pins 13 / 14 / 15 / 26</p></div></div></div></div><div className="gpio-panel"><div><div className="selected-label">GPIO ASSIGNMENTS · GP0–GP5</div><p>GP13–GP15, GP25–GP26 and GP29 are reserved for add-ons and are hidden.</p></div><div className="gpio-grid">{(Object.keys(gpioLabels) as GpioPin[]).map((id) => <label className={config.gpioMappings[id] !== savedConfig.gpioMappings[id] ? 'changed' : ''} key={id}><span>{gpioLabels[id]}</span><select value={config.gpioMappings[id]} onChange={(event) => onGpioChange(id, event.target.value as GpioAssignment)}>{gpioAssignments.map((assignment) => <option key={assignment.value} value={assignment.value}>{assignment.label}</option>)}</select></label>)}</div></div></div>
}

function HallPanel({ config, savedConfig, activeButton, hall, onSelect, onChange, calibrationStage, calibrationResults, calibrationAvailable, onStartCalibration, onFinishCalibration, onApplyCalibration, onCancelCalibration }: { config: DeviceConfig, savedConfig: DeviceConfig, activeButton: HallChannel, hall: HallSetting, onSelect: (id: HallChannel) => void, onChange: (id: HallChannel, patch: Partial<HallSetting>) => void, calibrationStage: CalibrationStage, calibrationResults: CalibrationResults | null, calibrationAvailable: boolean, onStartCalibration: () => void, onFinishCalibration: () => void, onApplyCalibration: () => void, onCancelCalibration: () => void }) {
  return <div className="hall-stack"><div className="hall-layout"><div className="hall-preview"><div className="panel-topline"><span>KEY SELECTOR · ADC29</span><span className="live-chip"><span />Live signal</span></div><Controller config={config} savedConfig={savedConfig} activeButton={activeButton} onSelect={onSelect} /><div className="travel-meter"><div className="meter-label"><span>{activeButton.toUpperCase()} · {hallLabels[activeButton]} travel</span><strong>{hall.press.toFixed(2)} mm</strong></div><div className="meter-track"><div style={{ width: `${Math.min(100, hall.press / 1.5 * 100)}%` }} /></div><div className="meter-scale"><span>0.0</span><span>0.75</span><span>1.5 mm</span></div></div></div><div className="hall-editor"><div className="selected-label">EDITING</div><h2>{activeButton.toUpperCase()} <span>· {hallLabels[activeButton]}</span></h2><SettingSlider label="Press point" value={hall.press} onChange={(value) => onChange(activeButton, { press: value })} /><SettingSlider label={hall.rapidTrigger ? "Rapid Trigger Threshold" : "Release point"} value={hall.release} onChange={(value) => onChange(activeButton, { release: value })} />{hall.rapidTrigger && <SettingNumber label="Rapid Trigger Noise Filter" value={hall.noise} min={0} max={4095} onChange={(value) => onChange(activeButton, { noise: value })} />}<label className="toggle-row"><span><strong>Rapid Trigger</strong><small>Reset as soon as the key moves upward</small></span><input type="checkbox" checked={hall.rapidTrigger} onChange={(event) => onChange(activeButton, { rapidTrigger: event.target.checked })} /><span className="toggle" /></label><button className="calibrate-button" onClick={onStartCalibration} disabled={!calibrationAvailable}>Calibrate all Hall buttons <ChevronRight size={16} /></button>{!calibrationAvailable && <p className="calibration-unavailable">Live calibration is disabled until firmware supports ADC29 voltage reads.</p>}</div></div><CalibrationPanel stage={calibrationStage} results={calibrationResults} onFinish={onFinishCalibration} onApply={onApplyCalibration} onCancel={onCancelCalibration} /></div>
}

function CalibrationWorkspace({ config, savedConfig, stage, results, progress, onCircleClick, onFinish, onApply, onCancel }: { config: DeviceConfig, savedConfig: DeviceConfig, stage: CalibrationStage, results: CalibrationResults, progress: CalibrationProgress, onCircleClick: (channel: HallChannel) => void, onFinish: () => void, onApply: () => void, onCancel: () => void }) {
  const rows = Object.entries(results) as [HallChannel, CalibrationResult][]
  const complete = rows.filter(([, result]) => result.status === 'complete' || result.status === 'skipped').length
  const failed = rows.filter(([, result]) => result.status === 'error')
  const title = stage === 'baseline' ? 'Measuring idle position' : stage === 'capture' ? `Press each button once · ${complete}/16 complete` : stage === 'review' ? 'Review calibration results' : 'Calibration error'
  return <div className={`calibration-workspace calibration-stage-${stage}`}><div className="calibration-page-header"><div><p className="eyebrow">MAGNETIC INPUT / CALIBRATION</p><h1>{title}</h1><p className="lede">{stage === 'baseline' ? 'Leave all buttons untouched while every channel is measured.' : stage === 'capture' ? 'Yellow buttons need a press. Click yellow to skip or green to remeasure.' : 'Review the measured values before applying them to the draft.'}</p></div><button className="secondary-button" onClick={onCancel}>Cancel</button></div><div className="calibration-live-status"><strong>{progress.phase}</strong><span>{progress.channel === null ? 'Preparing...' : `CH${progress.channel} · ${hallLabels[`ch${progress.channel}` as HallChannel]}`}</span><span>Attempt {progress.attempt || '—'} / 30</span><span>{progress.successful} / {progress.total} complete</span></div><div className="calibration-page-grid"><div className="preview-panel"><div className="panel-topline"><span>PHYSICAL PROGRESS · CH IDs</span></div><Controller config={config} savedConfig={savedConfig} activeButton="ch14" calibrationMode calibrationResults={results} readingChannel={progress.channel} onSelect={onCircleClick} /><div className="calibration-progress"><strong>{complete} / 16 complete</strong><span>{failed.length ? `${failed.length} failed` : 'Blue = reading now · Yellow = skip · Green = complete'}</span></div></div><div className="calibration-status-panel"><div className="selected-label">CHANNEL STATUS</div><div className="calibration-status-list">{rows.map(([id, result]) => <button key={id} className={`calibration-status-item ${result.status}`} onClick={() => onCircleClick(id)}><span>{id.toUpperCase()} · {hallLabels[id]}</span><strong>{result.status}</strong><small>{result.attempt ? `Attempt ${result.attempt}/30` : result.sampleCount ? `${result.sampleCount} samples` : result.latestVoltage !== undefined ? `${result.latestVoltage} ADC` : result.error ?? '—'}</small></button>)}</div>{stage === 'capture' && <button className="secondary-button" onClick={onFinish}>Finish capture and review</button>}{stage === 'review' && <button className="primary-button" onClick={onApply}>Apply results to draft</button>}</div></div><details className="calibration-results" open={stage === 'review'}><summary>Raw calibration results</summary><div className="calibration-table"><div className="calibration-row calibration-header"><span>CH</span><span>Button</span><span>Idle</span><span>Pressed</span><span>Span</span><span>Samples</span><span>Latest</span><span>Status</span></div>{rows.map(([id, result]) => <div className={`calibration-row ${result.status}`} key={id}><span>{id.toUpperCase()}</span><span>{hallLabels[id]}</span><span>{result.idle}</span><span>{result.pressed ?? '—'}</span><span>{result.pressed === null ? '—' : Math.abs(result.pressed - result.idle)}</span><span>{result.sampleCount ?? 0}</span><span>{result.latestVoltage ?? '—'}</span><span>{result.error ?? result.status}</span></div>)}</div></details></div>
}

function CalibrationPanel({ stage, results, onFinish, onApply, onCancel }: { stage: CalibrationStage, results: CalibrationResults | null, onFinish: () => void, onApply: () => void, onCancel: () => void }) {
  if (stage === 'idle') return null
  const rows = results ? Object.entries(results) as [HallChannel, CalibrationResult][] : []
  const complete = rows.filter(([, result]) => result.status === 'complete').length
  return <section className="calibration-panel"><div className="calibration-heading"><div><div className="selected-label">AUTOMATIC CALIBRATION</div><h2>{stage === 'baseline' ? 'Measuring idle position' : stage === 'capture' ? `Press each button once · ${complete}/16 complete` : stage === 'review' ? 'Review calibration results' : 'Calibration error'}</h2></div>{stage !== 'baseline' && <button className="text-button" onClick={onCancel}>Cancel</button>}</div>{stage === 'baseline' && <p className="calibration-instruction">Leave all Hall buttons untouched. The configurator is sampling every channel automatically.</p>}{stage === 'capture' && <><p className="calibration-instruction">Press each button fully once, in any order. Completed buttons turn green.</p><button className="secondary-button" onClick={onFinish}>Finish capture and review</button></>}{stage === 'review' && <button className="primary-button" onClick={onApply}>Apply calibration results to draft</button>}<details className="calibration-results" open={stage === 'review'}><summary>Calibration results</summary><div className="calibration-table"><div className="calibration-row calibration-header"><span>CH</span><span>Button</span><span>Idle</span><span>Pressed</span><span>Span</span><span>Polarity</span><span>Status</span></div>{rows.map(([id, result]) => <div className={`calibration-row ${result.status}`} key={id}><span>{id.toUpperCase()}</span><span>{hallLabels[id]}</span><span>{result.idle}</span><span>{result.pressed ?? '—'}</span><span>{result.pressed === null ? '—' : Math.abs(result.pressed - result.idle)}</span><span>{result.polarity ?? '—'}</span><span>{result.status}</span></div>)}</div></details></section>
}

function SettingSlider({ label, value, onChange }: { label: string, value: number, onChange: (value: number) => void }) {
  return <div className="slider-field"><div className="slider-label"><label htmlFor={label}>{label}</label><output>{value.toFixed(2)} mm</output></div><input id={label} type="range" min="0.05" max="1.5" step="0.05" value={value} onChange={(event) => onChange(Number(event.target.value))} /></div>
}

function SettingNumber({ label, value, min, max, onChange }: { label: string, value: number, min: number, max: number, onChange: (value: number) => void }) {
  return <div className="slider-field"><div className="slider-label"><label htmlFor={label}>{label}</label><output>{value}</output></div><input id={label} type="number" min={min} max={max} step="1" value={value} onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value))))} /></div>
}
