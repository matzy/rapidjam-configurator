import { useEffect, useState } from 'react'
import type { DeviceTransport, HallChannel } from '../device'
import type { HallLiveReadCoordinator } from '../transport/HallLiveReadCoordinator'
import { recordLiveReadingFailure, recordLiveReadingSuccess, type LiveReadingState } from '../utils/liveReadingState'

export type HallTravelStatus = 'inactive' | 'reading' | 'ready' | 'stale' | 'error'

export interface HallTravelReading {
  status: HallTravelStatus
  voltage: number | null
}

// Delay after each HTTP response before the next request; actual cadence also includes response time.
const POLL_INTERVAL_MS = 200

export function useHallTravel(transport: DeviceTransport, channel: HallChannel, enabled: boolean, coordinator: HallLiveReadCoordinator): HallTravelReading {
  const [reading, setReading] = useState<HallTravelReading & { channel: HallChannel | null }>({ status: 'inactive', voltage: null, channel: null })

  useEffect(() => {
    if (!enabled) {
      setReading({ status: 'inactive', voltage: null, channel: null })
      return
    }

    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let state: LiveReadingState = { consecutiveFailures: 0, voltage: null }
    setReading({ status: 'reading', voltage: null, channel })

    const poll = async () => {
      try {
        const voltage = await coordinator.read(transport, Number(channel.slice(2)))
        if (stopped) return
        const transition = recordLiveReadingSuccess(voltage)
        state = transition.state
        setReading({ status: transition.outcome, voltage: state.voltage, channel })
      } catch {
        if (stopped) return
        const transition = recordLiveReadingFailure(state, coordinator.requiresReconnect)
        state = transition.state
        setReading({ status: transition.outcome, voltage: state.voltage, channel })
      }
      if (!stopped && !coordinator.requiresReconnect) timer = setTimeout(() => { void poll() }, POLL_INTERVAL_MS)
    }

    void poll()
    return () => {
      stopped = true
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [transport, channel, enabled, coordinator])

  if (!enabled) return { status: 'inactive', voltage: null }
  if (reading.channel !== channel) return { status: 'reading', voltage: null }
  return { status: reading.status, voltage: reading.voltage }
}