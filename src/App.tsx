import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, ChevronRight, CircleHelp, Link2, RotateCcw, Save, SlidersHorizontal, Usb, Zap } from 'lucide-react'
import { Action, DeviceConfig, DeviceTransport, GpioAssignment, GpioPin, HallCalibrationPatch, HallChannel, HallSetting } from './device'
import { ACTIONS, CALIBRATION_BASELINE_ROUNDS, CALIBRATION_BASELINE_WAIT_MS, CALIBRATION_POLL_INTERVAL_MS, CALIBRATION_PRESS_THRESHOLD, CALIBRATION_SAMPLE_TARGET, GPIO_ASSIGNMENTS, GPIO_LABELS, HALL_LABELS } from './config/constants'
import { rawToMillimeters, secondHighest, secondLowest } from './utils/calibrationMath'
import type { CalibrationProgress, CalibrationResult, CalibrationResults, CalibrationStage } from './types/calibration'
import { ControllerDisplay as Controller } from './components/ControllerDisplay'
import { SettingNumber, SettingSlider } from './components/SettingControls'
import { MappingPanel as MappingPanelComponent } from './components/MappingPanel'
import { HallPanel as HallPanelComponent } from './components/HallPanel'
import { CalibrationPanel as CalibrationPanelComponent, CalibrationWorkspace as CalibrationWorkspaceComponent } from './components/CalibrationWorkspace'
import { createTransport } from './transport/createTransport'
import { useDeviceConfig } from './hooks/useDeviceConfig'

const transport: DeviceTransport = createTransport()
const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
const hallLabels = HALL_LABELS
const gpioLabels = GPIO_LABELS
const actions = ACTIONS
const gpioAssignments = GPIO_ASSIGNMENTS
const rawToMm = rawToMillimeters
const calibrationPollIntervalMs = CALIBRATION_POLL_INTERVAL_MS

export function App() {
  const deviceConfig = useDeviceConfig(transport)
  const { device, config, savedConfig, dirty, busy, notice, diagnostic, connectionFailed, restartComplete, setNotice, connect, restartToGamepad, updateConfig, updateMapping, updateHall, updateGpio, save, discard, saveHallCalibration } = deviceConfig
  const [activeButton, setActiveButton] = useState<HallChannel>('ch14')
  const [section, setSection] = useState<'mapping' | 'hall'>('mapping')
  const [calibrationStage, setCalibrationStage] = useState<CalibrationStage>('idle')
  const [calibrationResults, setCalibrationResults] = useState<CalibrationResults | null>(null)
  const [calibrationProgress, setCalibrationProgress] = useState<CalibrationProgress>({ phase: 'Idle', channel: null, attempt: 0, successful: 0, total: 16 })
  const calibrationBaselines = useRef<number[]>([])
  const calibrationPeaks = useRef<number[]>([])
  const calibrationPressSamples = useRef<number[][]>(Array.from({ length: 16 }, () => []))
  const calibrationSkipped = useRef(new Set<HallChannel>())
  const calibrationCancelled = useRef(false)

  const activeHall = config.hall[activeButton]

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

  async function applyCalibration() {
    if (!calibrationResults || busy) return
    const nextHall = { ...config.hall }
    const patches: Partial<Record<HallChannel, HallCalibrationPatch>> = {}
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
      nextHall[id] = { ...old, idle: result.idle, pressed: result.pressed, active: activeRaw, threshold: releaseRaw, press: rawToMm(activeRaw, result.idle, result.pressed), release: rawToMm(releaseRaw, result.idle, result.pressed), polarity: result.polarity, calibrated: true }
      patches[id] = { idle: result.idle, active: activeRaw, pressed: result.pressed, threshold: releaseRaw, polarity: result.polarity }
    })
    if (!Object.keys(patches).length) {
      setNotice('No completed calibration results to apply')
      return
    }
    try {
      const nextConfig = { ...config, hall: nextHall }
      await saveHallCalibration(patches, nextConfig)
      setCalibrationStage('idle')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Calibration save failed')
    }
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
        {calibrationStage !== 'idle' && calibrationResults ? <CalibrationWorkspaceComponent config={config} savedConfig={savedConfig} stage={calibrationStage} results={calibrationResults} progress={calibrationProgress} onCircleClick={handleCalibrationCircle} onFinish={finishCalibrationCapture} onApply={applyCalibration} onCancel={cancelCalibration} /> : section === 'mapping' ? <MappingPanelComponent config={config} savedConfig={savedConfig} activeButton={activeButton} onSelect={setActiveButton} onChange={updateMapping} onGpioChange={updateGpio} /> : <HallPanelComponent config={config} savedConfig={savedConfig} activeButton={activeButton} hall={activeHall} onSelect={setActiveButton} onChange={updateHall} calibrationAvailable={transport.supportsLiveHallCalibration()} onStartCalibration={startCalibration} calibrationPanel={<CalibrationPanelComponent stage={calibrationStage} results={calibrationResults} onFinish={finishCalibrationCapture} onApply={applyCalibration} onCancel={cancelCalibration} />} />}
      </section>
    </main>

    <footer className="actionbar" inert={connectionFailed || restartComplete || undefined}><div className="draft-state">{dirty ? <><span className="draft-dot" />Unsaved changes</> : <><Check size={15} />All changes saved</>}<span className="separator" />{device?.transport === 'mock' ? 'Demo device' : 'RapidJAM'}</div><div className="actions"><button className="secondary-button" onClick={() => void discard()} disabled={!dirty || busy}><RotateCcw size={16} />Discard</button><button className="primary-button" onClick={() => void save()} disabled={!dirty || busy}><Save size={16} />{busy ? 'Saving...' : 'Save to device'}</button></div></footer>
  </div>
}

