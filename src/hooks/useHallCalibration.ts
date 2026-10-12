import { useEffect, useRef, useState } from 'react'
import type { DeviceTransport, HallChannel } from '../device'
import type { CalibrationProgress, CalibrationResult, CalibrationResults, CalibrationStage } from '../types/calibration'
import { CALIBRATION_BASELINE_ROUNDS, CALIBRATION_BASELINE_WAIT_MS, CALIBRATION_FOCUS_TIMEOUT_MS, CALIBRATION_MAX_PRESS_CYCLES, CALIBRATION_POLL_INTERVAL_MS, CALIBRATION_PRESS_CYCLES, CALIBRATION_PRESS_SAMPLE_INTERVAL_MS, CALIBRATION_PRESS_SPREAD_LIMIT, CALIBRATION_PRESS_THRESHOLD, CALIBRATION_RELEASE_IDLE_SAMPLES, CALIBRATION_RELEASE_SETTLE_MS, CALIBRATION_SAMPLE_TARGET } from '../config/constants'
import { median } from '../utils/calibrationMath'
import { advancePressCycle, createPressCycleState, pressCycleAction, type PressCycleEvent, type PressCycleOptions, type PressCycleState } from '../utils/calibrationCapture'

export interface HallCalibrationBuffers {
  baselines: number[]
  pressCycles: PressCycleState[]
  skipped: Set<HallChannel>
}

export interface HallCalibrationState {
  stage: CalibrationStage
  results: CalibrationResults | null
  progress: CalibrationProgress
  buffers: HallCalibrationBuffers
  cancelled: React.MutableRefObject<boolean>
  setStage: React.Dispatch<React.SetStateAction<CalibrationStage>>
  setResults: React.Dispatch<React.SetStateAction<CalibrationResults | null>>
  setProgress: React.Dispatch<React.SetStateAction<CalibrationProgress>>
  beginCapture(): void
  cancel(): void
  resetChannel(channel: HallChannel): void
  isResolved(channel: number): boolean
  allCaptureTargetsResolved(): boolean
  enterReviewIfResolved(): boolean
  startCalibration(): Promise<void>
  retryChannel(channel: HallChannel): Promise<void>
  skipChannel(channel: HallChannel): void
  remeasureFromReview(channel: HallChannel): void
  finishCapture(): void
  waitForCaptureDrain(): Promise<void>
}

const createBuffers = (): HallCalibrationBuffers => ({
  baselines: Array.from({ length: 16 }, () => 0),
  pressCycles: Array.from({ length: 16 }, () => createPressCycleState()),
  skipped: new Set<HallChannel>(),
})

const pressCycleOptions = (idle: number): PressCycleOptions => ({
  idle,
  threshold: CALIBRATION_PRESS_THRESHOLD,
  sampleTarget: CALIBRATION_SAMPLE_TARGET,
  releaseIdleSamples: CALIBRATION_RELEASE_IDLE_SAMPLES,
  pressCycles: CALIBRATION_PRESS_CYCLES,
  maxPressCycles: CALIBRATION_MAX_PRESS_CYCLES,
  spreadLimit: CALIBRATION_PRESS_SPREAD_LIMIT,
})

const cyclePhaseLabel = (state: PressCycleState): string => {
  if (state.outcome !== 'in-progress') return 'Button captured'
  if (state.phase === 'press-sampling') return 'Hold the button down'
  if (state.phase === 'await-release' || state.phase === 'idle-sampling') return 'Release the button'
  return state.pressedCycles.length > 0 ? 'Press the button again' : 'Checking for button press'
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function useHallCalibration(transport: DeviceTransport, setNotice: (message: string) => void): HallCalibrationState {
  const [stage, setStage] = useState<CalibrationStage>('idle')
  const [results, setResults] = useState<CalibrationResults | null>(null)
  const [progress, setProgress] = useState<CalibrationProgress>({ phase: 'Idle', channel: null, attempt: 0, successful: 0, total: 16, action: 'none' })
    function finishCapture(): void {
      cancelled.current = true
      setStage('review')
      setProgress((current) => ({ ...current, phase: 'Review calibration results', channel: null, attempt: 0, action: 'none' }))
      setNotice('Review calibration results')
    }
  const buffersRef = useRef<HallCalibrationBuffers>(createBuffers())
  const cancelled = useRef(false)
  const captureTaskRef = useRef<Promise<void> | null>(null)

  useEffect(() => () => { cancelled.current = true }, [])

  function beginCapture() {
    cancelled.current = false
    setStage('capture')
    setProgress((current) => ({ ...current, phase: 'Press phase ready', channel: null, attempt: 0, action: 'press' }))
  }

  function cancel() {
    cancelled.current = true
    setStage('idle')
    setResults(null)
    buffersRef.current = createBuffers()
    setProgress({ phase: 'Idle', channel: null, attempt: 0, successful: 0, total: 16, action: 'none' })
  }

  function resetChannel(channel: HallChannel) {
    const index = Number(channel.slice(2))
    buffersRef.current.pressCycles[index] = createPressCycleState()
    buffersRef.current.skipped.delete(channel)
  }

  function remeasureFromReview(channel: HallChannel) {
    resetChannel(channel)
    cancelled.current = false
    setResults((current) => current ? { ...current, [channel]: { ...current[channel], status: 'waiting', sampleCount: 0, pressCount: 0, pressTarget: CALIBRATION_PRESS_CYCLES, spreadPercent: null, pressed: null, polarity: null, error: undefined } } : current)
    setProgress((current) => ({ ...current, phase: 'Ready to re-measure channel', channel: Number(channel.slice(2)),     attempt: 0, successful: 0, action: 'press' }))
    setStage('capture')
    setNotice('Ready to re-measure channel')
  }

  function isResolved(channel: number) {
    const id = `ch${channel}` as HallChannel
    return buffersRef.current.pressCycles[channel].outcome !== 'in-progress' || buffersRef.current.skipped.has(id)
  }

  function allCaptureTargetsResolved() {
    return Array.from({ length: 16 }, (_, index) => isResolved(index)).every(Boolean)
  }

  function enterReviewIfResolved() {
    if (!allCaptureTargetsResolved()) return false
    cancelled.current = true
    setStage('review')
    setProgress((current) => ({ ...current, phase: 'Review calibration results', channel: null, attempt: 0, action: 'none' }))
    setNotice('All Hall channels are complete. Review the results before applying them.')
    return true
  }

  function updateResult(channel: number, patch: Partial<CalibrationResult>) {
    setResults((current) => current ? { ...current, [`ch${channel}`]: { ...current[`ch${channel}` as HallChannel], ...patch } } : current)
  }

  function publishChannel(channel: number, state: PressCycleState, latestVoltage: number) {
    const idle = state.idle ?? buffersRef.current.baselines[channel]
    const pressed = state.outcome === 'in-progress' ? null : state.pressed
    const status = state.outcome === 'complete' ? 'complete' : state.outcome === 'unstable' ? 'unstable' : state.phase === 'press-sampling' ? 'pressing' : 'waiting'
    updateResult(channel, {
      idle,
      pressed,
      polarity: pressed === null ? null : pressed >= idle ? 'N' : 'P',
      status,
      pressCount: state.pressedCycles.length,
      pressTarget: CALIBRATION_PRESS_CYCLES,
      spreadPercent: state.spreadPercent,
      latestVoltage,
      error: undefined,
    })
  }

  async function startCalibration() {
    if (!transport.supportsLiveHallCalibration()) {
      setNotice('Live Hall calibration is disabled: the current firmware cannot read RapidJAM ADC29')
      return
    }
    cancelled.current = false
    buffersRef.current = createBuffers()
    setProgress({ phase: 'Preparing device', channel: null, attempt: 0, successful: 0, total: 16, action: 'none' })
    setResults(Object.fromEntries(Array.from({ length: 16 }, (_, channel) => [`ch${channel}`, { idle: 0, pressed: null, polarity: null, status: 'preparing' }])) as CalibrationResults)
    setStage('baseline')
    setNotice('Leave all Hall buttons untouched while measuring idle values')
    try {
      await transport.prepareHallCalibration()
      if (cancelled.current) return
      const samples: number[][] = Array.from({ length: 16 }, () => [])
      const baselineErrors: Array<string | undefined> = Array.from({ length: 16 })
      for (let round = 0; round < CALIBRATION_BASELINE_ROUNDS && samples.some((values) => values.length < CALIBRATION_SAMPLE_TARGET); round++) {
        for (let channel = 0; channel < 16; channel++) {
          if (cancelled.current) return
          if (samples[channel].length >= CALIBRATION_SAMPLE_TARGET) continue
          setProgress((current) => ({ ...current, phase: `Baseline sample ${round + 1} / ${CALIBRATION_BASELINE_ROUNDS}`, channel, attempt: 0, action: 'hands-off' }))
          try {
            const voltage = await transport.readHallVoltage(channel, (attempt) => { setProgress((current) => ({ ...current, channel, attempt })); updateResult(channel, { status: 'waiting', attempt, sampleCount: samples[channel].length }) })
            if (cancelled.current) return
            samples[channel].push(voltage)
          } catch (error) {
            if (cancelled.current) return
            baselineErrors[channel] = error instanceof Error ? error.message : 'Voltage read failed'
          }
          if (cancelled.current) return
          updateResult(channel, { sampleCount: samples[channel].length, latestVoltage: samples[channel][samples[channel].length - 1] })
          await new Promise((resolve) => setTimeout(resolve, CALIBRATION_BASELINE_WAIT_MS))
          setProgress((current) => ({ ...current, successful: samples.filter((values) => values.length >= CALIBRATION_SAMPLE_TARGET).length }))
        }
      }
      if (cancelled.current) return
      buffersRef.current.baselines = samples.map((values) => values.length >= CALIBRATION_SAMPLE_TARGET ? median(values) : 0)
      setResults(Object.fromEntries(buffersRef.current.baselines.map((idle, channel) => [`ch${channel}`, samples[channel].length >= CALIBRATION_SAMPLE_TARGET ? { idle, pressed: null, polarity: null, status: 'waiting', sampleCount: samples[channel].length, latestVoltage: samples[channel][samples[channel].length - 1] } : { idle, pressed: null, polarity: null, status: 'error', sampleCount: samples[channel].length, latestVoltage: samples[channel][samples[channel].length - 1], error: baselineErrors[channel] ?? 'Fewer than five successful baseline samples' }])) as CalibrationResults)
      setStage('capture')
      setProgress({ phase: 'Press phase ready', channel: null, attempt: 0, successful: 0, total: 16, action: 'press' })
      setNotice('Press each Hall button all the way as you normally would, in any order')
    } catch {
      if (!cancelled.current) { setStage('error'); setNotice('Calibration failed') }
    }
  }

  useEffect(() => {
    if (stage !== 'capture') return
    let stopped = false
    const halted = () => stopped || cancelled.current
    // Reads one voltage for the channel and advances its press-cycle state machine.
    const readStep = async (channel: number): Promise<PressCycleEvent> => {
      const value = await transport.readHallVoltage(channel, (attempt) => setProgress((current) => ({ ...current, attempt })))
      if (halted()) return 'none'
      const buffers = buffersRef.current
      const step = advancePressCycle(buffers.pressCycles[channel], value, pressCycleOptions(buffers.baselines[channel]))
      buffers.pressCycles[channel] = step.state
      publishChannel(channel, step.state, value)
      const captured = step.event === 'complete' || step.event === 'unstable'
      setProgress((current) => ({ ...current, phase: cyclePhaseLabel(step.state), channel, attempt: 0, action: pressCycleAction(step.state), successful: current.successful + (captured ? 1 : 0) }))
      return step.event
    }
    // Polls one channel until it resolves or stays quiet (no state change) for CALIBRATION_FOCUS_TIMEOUT_MS. Its state is kept when it returns.
    const focusChannel = async (channel: number) => {
      let quietSince = Date.now()
      while (!halted() && !isResolved(channel) && Date.now() - quietSince < CALIBRATION_FOCUS_TIMEOUT_MS) {
        await sleep(CALIBRATION_PRESS_SAMPLE_INTERVAL_MS)
        if (halted()) return
        let event: PressCycleEvent
        try { event = await readStep(channel) } catch { continue }
        if (halted()) return
        if (event !== 'none') quietSince = Date.now()
        if (event === 'released') await sleep(CALIBRATION_RELEASE_SETTLE_MS)
      }
    }
    const capture = async () => {
      while (!halted()) {
        for (let channel = 0; channel < 16 && !halted(); channel++) {
          if (isResolved(channel)) continue
          let event: PressCycleEvent
          try { event = await readStep(channel) } catch {
            if (halted()) return
            await sleep(CALIBRATION_POLL_INTERVAL_MS)
            continue
          }
          if (halted()) return
          if (event !== 'none' && !isResolved(channel)) await focusChannel(channel)
          if (halted()) return
          await sleep(CALIBRATION_POLL_INTERVAL_MS)
          if (enterReviewIfResolved()) return
        }
        if (enterReviewIfResolved()) return
      }
    }
    const captureTask = capture()
    captureTaskRef.current = captureTask
    void captureTask.then(
      () => { if (captureTaskRef.current === captureTask) captureTaskRef.current = null },
      () => { if (captureTaskRef.current === captureTask) captureTaskRef.current = null },
    )
    return () => { stopped = true; cancelled.current = true }
  }, [stage])

  async function retryChannel(channel: HallChannel) {
    resetChannel(channel)
    cancelled.current = false
    setStage('capture')
    setProgress({ phase: 'Ready to re-measure channel', channel: Number(channel.slice(2)), attempt: 0, successful: 0, total: 16, action: 'press' })
    setResults((current) => current ? { ...current, [channel]: { ...current[channel], status: 'waiting', sampleCount: 0, pressCount: 0, pressTarget: CALIBRATION_PRESS_CYCLES, spreadPercent: null, pressed: null, polarity: null, error: undefined } } : current)
  }

  async function waitForCaptureDrain() {
    await captureTaskRef.current
  }

  function skipChannel(channel: HallChannel) {
    buffersRef.current.skipped.add(channel)
    setResults((current) => current ? { ...current, [channel]: { ...current[channel], status: 'skipped', error: 'Skipped by user' } } : current)
    enterReviewIfResolved()
  }

  return { stage, results, progress, buffers: buffersRef.current, cancelled, setStage, setResults, setProgress, beginCapture, cancel, resetChannel, isResolved, startCalibration, retryChannel, skipChannel, remeasureFromReview, finishCapture, waitForCaptureDrain, allCaptureTargetsResolved, enterReviewIfResolved }
}
