export interface LiveReadingState {
  consecutiveFailures: number
  voltage: number | null
}

export type LiveReadingOutcome = 'ready' | 'stale' | 'reading' | 'error'

export interface LiveReadingTransition {
  state: LiveReadingState
  outcome: LiveReadingOutcome
}

export const LIVE_READING_FAILURE_LIMIT = 6

export function recordLiveReadingSuccess(voltage: number): LiveReadingTransition {
  return { state: { consecutiveFailures: 0, voltage }, outcome: 'ready' }
}

export function recordLiveReadingFailure(previous: LiveReadingState, timedOut = false): LiveReadingTransition {
  const consecutiveFailures = previous.consecutiveFailures + 1
  if (timedOut || consecutiveFailures >= LIVE_READING_FAILURE_LIMIT) {
    return { state: { consecutiveFailures, voltage: null }, outcome: 'error' }
  }
  if (previous.voltage !== null) {
    return { state: { consecutiveFailures, voltage: previous.voltage }, outcome: 'stale' }
  }
  return { state: { consecutiveFailures, voltage: null }, outcome: 'reading' }
}