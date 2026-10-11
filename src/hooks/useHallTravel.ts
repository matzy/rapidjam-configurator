import { useEffect, useState } from 'react'
import type { DeviceTransport, HallChannel, HallSetting } from '../device'
import type { HallLiveReadCoordinator } from '../transport/HallLiveReadCoordinator'
import { estimateHallInput, initialHallInputHistory, type HallInputEstimate } from '../utils/hallInputEstimate'
import { recordLiveReadingFailure, recordLiveReadingSuccess, type LiveReadingState } from '../utils/liveReadingState'

export type HallTravelStatus = 'inactive' | 'reading' | 'ready' | 'stale' | 'error'

export interface HallTravelReading {
  status: HallTravelStatus
  voltage: number | null
  inputEstimate: HallInputEstimate
}

// Delay after each HTTP response before the next request; actual cadence also includes response time.
const POLL_INTERVAL_MS = 200

export function useHallTravel(transport: DeviceTransport, channel: HallChannel, enabled: boolean, coordinator: HallLiveReadCoordinator, setting: HallSetting): HallTravelReading {
  const settingKey = [setting.idle, setting.pressed, setting.pressRatio, setting.rapidTrigger ? setting.releaseRatio : 'unused', setting.rapidTrigger ? setting.noise : 'unused', setting.polarity, setting.rapidTrigger, setting.calibrated].join('|')
  const [reading, setReading] = useState<HallTravelReading & { channel: HallChannel | null, settingKey: string }>({ status: 'inactive', voltage: null, inputEstimate: 'unknown', channel: null, settingKey: '' })

  useEffect(() => {
    if (!enabled) {
      setReading({ status: 'inactive', voltage: null, inputEstimate: 'unknown', channel: null, settingKey })
      return
    }

    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let state: LiveReadingState = { consecutiveFailures: 0, voltage: null }
    let estimate = initialHallInputHistory()
    setReading({ status: 'reading', voltage: null, inputEstimate: 'unknown', channel, settingKey })

    const poll = async () => {
      try {
        const voltage = await coordinator.read(transport, Number(channel.slice(2)))
        if (stopped) return
        const transition = recordLiveReadingSuccess(voltage)
        state = transition.state
        estimate = estimateHallInput(estimate, voltage, setting)
        setReading({ status: transition.outcome, voltage: state.voltage, inputEstimate: estimate.state, channel, settingKey })
      } catch {
        if (stopped) return
        const transition = recordLiveReadingFailure(state, coordinator.requiresReconnect)
        state = transition.state
        estimate = initialHallInputHistory()
        setReading({ status: transition.outcome, voltage: state.voltage, inputEstimate: 'unknown', channel, settingKey })
      }
      if (!stopped && !coordinator.requiresReconnect) timer = setTimeout(() => { void poll() }, POLL_INTERVAL_MS)
    }

    void poll()
    return () => {
      stopped = true
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [transport, channel, enabled, coordinator, settingKey])

  if (!enabled) return { status: 'inactive', voltage: null, inputEstimate: 'unknown' }
  if (reading.channel !== channel || reading.settingKey !== settingKey) return { status: 'reading', voltage: null, inputEstimate: 'unknown' }
  return { status: reading.status, voltage: reading.voltage, inputEstimate: reading.inputEstimate }
}