import { useEffect, useRef, useState } from 'react'
import type { DeviceTransport, HallChannel } from '../device'
import type { CalibrationProgress, CalibrationResult, CalibrationResults, CalibrationStage } from '../types/calibration'
import { CALIBRATION_BASELINE_ROUNDS, CALIBRATION_BASELINE_WAIT_MS, CALIBRATION_POLL_INTERVAL_MS, CALIBRATION_PRESS_THRESHOLD, CALIBRATION_SAMPLE_TARGET } from '../config/constants'
import { secondHighest, secondLowest } from '../utils/calibrationMath'

export interface HallCalibrationBuffers {
  baselines: number[]
  peaks: number[]
  pressSamples: number[][]
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
  peaks: Array.from({ length: 16 }, () => 0),
  pressSamples: Array.from({ length: 16 }, () => []),
  skipped: new Set<HallChannel>(),
})

export function useHallCalibration(transport: DeviceTransport, setNotice: (message: string) => void): HallCalibrationState {
  const [stage, setStage] = useState<CalibrationStage>('idle')
  const [results, setResults] = useState<CalibrationResults | null>(null)
  const [progress, setProgress] = useState<CalibrationProgress>({ phase: 'Idle', channel: null, attempt: 0, successful: 0, total: 16 })
    function finishCapture(): void {
      cancelled.current = true
      setStage('review')
      setProgress((current) => ({ ...current, phase: 'Review calibration results', channel: null, attempt: 0 }))
      setNotice('Review calibration results')
    }
  const buffersRef = useRef<HallCalibrationBuffers>(createBuffers())
  const cancelled = useRef(false)
  const captureTaskRef = useRef<Promise<void> | null>(null)

  useEffect(() => () => { cancelled.current = true }, [])

  function beginCapture() {
    cancelled.current = false
    setStage('capture')
    setProgress((current) => ({ ...current, phase: 'Press phase ready', channel: null, attempt: 0 }))
  }

  function cancel() {
    cancelled.current = true
    setStage('idle')
    setResults(null)
    buffersRef.current = createBuffers()
    setProgress({ phase: 'Idle', channel: null, attempt: 0, successful: 0, total: 16 })
  }

  function resetChannel(channel: HallChannel) {
    const index = Number(channel.slice(2))
    buffersRef.current.pressSamples[index] = []
    buffersRef.current.peaks[index] = buffersRef.current.baselines[index]
    buffersRef.current.skipped.delete(channel)
  }

  function remeasureFromReview(channel: HallChannel) {
    resetChannel(channel)
    cancelled.current = false
    setResults((current) => current ? { ...current, [channel]: { ...current[channel], status: 'waiting', sampleCount: 0, pressed: null, error: undefined } } : current)
    setProgress((current) => ({ ...current, phase: 'Ready to re-measure channel', channel: Number(channel.slice(2)), attempt: 0, successful: 0 }))
    setStage('capture')
    setNotice('Ready to re-measure channel')
  }

  function isResolved(channel: number) {
    const id = `ch${channel}` as HallChannel
    return buffersRef.current.pressSamples[channel].length >= CALIBRATION_SAMPLE_TARGET || buffersRef.current.skipped.has(id)
  }

  function allCaptureTargetsResolved() {
    return Array.from({ length: 16 }, (_, index) => isResolved(index)).every(Boolean)
  }

  function enterReviewIfResolved() {
    if (!allCaptureTargetsResolved()) return false
    cancelled.current = true
    setStage('review')
    setProgress((current) => ({ ...current, phase: 'Review calibration results', channel: null, attempt: 0 }))
    setNotice('All Hall channels are complete. Review the results before applying them.')
    return true
  }

  function updateResult(channel: number, patch: Partial<CalibrationResult>) {
    setResults((current) => current ? { ...current, [`ch${channel}`]: { ...current[`ch${channel}` as HallChannel], ...patch } } : current)
  }

  async function startCalibration() {
    if (!transport.supportsLiveHallCalibration()) {
      setNotice('Live Hall calibration is disabled: the current firmware cannot read RapidJAM ADC29')
      return
    }
    cancelled.current = false
    buffersRef.current = createBuffers()
    setProgress({ phase: 'Preparing device', channel: null, attempt: 0, successful: 0, total: 16 })
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
          setProgress((current) => ({ ...current, phase: `Baseline sample ${round + 1} / ${CALIBRATION_BASELINE_ROUNDS}`, channel, attempt: 0 }))
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
      buffersRef.current.baselines = samples.map((values) => values.length >= CALIBRATION_SAMPLE_TARGET ? secondLowest(values) : 0)
      buffersRef.current.peaks = [...buffersRef.current.baselines]
      setResults(Object.fromEntries(buffersRef.current.baselines.map((idle, channel) => [`ch${channel}`, samples[channel].length >= CALIBRATION_SAMPLE_TARGET ? { idle, pressed: null, polarity: null, status: 'waiting', sampleCount: samples[channel].length, latestVoltage: samples[channel][samples[channel].length - 1] } : { idle, pressed: null, polarity: null, status: 'error', sampleCount: samples[channel].length, latestVoltage: samples[channel][samples[channel].length - 1], error: baselineErrors[channel] ?? 'Fewer than three successful baseline samples' }])) as CalibrationResults)
      setStage('capture')
      setProgress({ phase: 'Press phase ready', channel: null, attempt: 0, successful: 0, total: 16 })
      setNotice('Press each Hall button fully, in any order')
    } catch {
      if (!cancelled.current) { setStage('error'); setNotice('Calibration failed') }
    }
  }

  useEffect(() => {
    if (stage !== 'capture') return
    let stopped = false
    const capture = async () => {
      while (!stopped && !cancelled.current) {
        for (let channel = 0; channel < 16 && !stopped; channel++) {
          const id = `ch${channel}` as HallChannel
          if (isResolved(channel)) continue
          setProgress((current) => ({ ...current, phase: 'Checking for button press', channel, attempt: 0 }))
          let value: number
          try { value = await transport.readHallVoltage(channel) } catch {
            if (stopped || cancelled.current) return
            await new Promise((resolve) => setTimeout(resolve, CALIBRATION_POLL_INTERVAL_MS))
            continue
          }
          if (stopped || cancelled.current) return
          const idle = buffersRef.current.baselines[channel]
          const previous = buffersRef.current.peaks[channel]
          if (Math.abs(value - idle) > Math.abs(previous - idle)) buffersRef.current.peaks[channel] = value
          if (Math.abs(buffersRef.current.peaks[channel] - idle) < CALIBRATION_PRESS_THRESHOLD) { await new Promise((resolve) => setTimeout(resolve, CALIBRATION_POLL_INTERVAL_MS)); continue }
          updateResult(channel, { status: 'pressing', latestVoltage: value })
          while (buffersRef.current.pressSamples[channel].length < CALIBRATION_SAMPLE_TARGET && !stopped && !cancelled.current) {
            try {
              const pressedValue = await transport.readHallVoltage(channel, (attempt) => { setProgress((current) => ({ ...current, phase: 'Reading pressed channel', channel, attempt })); updateResult(channel, { status: 'pressing', attempt }) })
              if (stopped || cancelled.current) return
              if (Math.abs(pressedValue - idle) < CALIBRATION_PRESS_THRESHOLD) { buffersRef.current.pressSamples[channel] = []; updateResult(channel, { status: 'waiting', sampleCount: 0, latestVoltage: pressedValue, error: 'Button released before three samples' }); break }
              buffersRef.current.pressSamples[channel].push(pressedValue)
              const samples = buffersRef.current.pressSamples[channel]
              updateResult(channel, { status: 'waiting', sampleCount: samples.length, latestVoltage: pressedValue })
              if (samples.length >= CALIBRATION_SAMPLE_TARGET) { const pressed = secondHighest(samples); updateResult(channel, { idle, pressed, polarity: pressed >= idle ? 'N' : 'P', status: 'complete', sampleCount: samples.length, latestVoltage: pressedValue }); setProgress((current) => ({ ...current, phase: 'Button captured', successful: current.successful + 1 })) } else await new Promise((resolve) => setTimeout(resolve, CALIBRATION_POLL_INTERVAL_MS))
            } catch (error) {
              if (stopped || cancelled.current) return
              updateResult(channel, { status: 'error', error: error instanceof Error ? error.message : 'Voltage read failed' })
              break
            }
          }
          await new Promise((resolve) => setTimeout(resolve, CALIBRATION_POLL_INTERVAL_MS))
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
    setProgress({ phase: 'Ready to re-measure channel', channel: Number(channel.slice(2)), attempt: 0, successful: 0, total: 16 })
    setResults((current) => current ? { ...current, [channel]: { ...current[channel], status: 'waiting', sampleCount: 0, pressed: null, error: undefined } } : current)
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
