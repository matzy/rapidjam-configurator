/**
 * Workarounds for known firmware bugs in RapidJAM firmware builds that predate
 * GP2040-CE_RapidJAM `worktree-adc29-unstable` (commits 2c3244cc, f9bba46a).
 *
 * Everything here is removable once a firmware containing those fixes is the
 * supported baseline. Each workaround is behind a flag in FW_WORKAROUNDS and its
 * call sites are tagged `FW-WORKAROUND(WA-n)`. See docs/fw-workarounds.md for the
 * removal procedure.
 */

import { isInvalidDeviceResponse } from './deviceResponse.ts'

export interface FwWorkaroundFlags {
  /** WA-1: one /api request at a time, with a short gap (firmware use-after-free on response strings). */
  serializeRequests: boolean
  /** WA-2: retry a live Hall read when the response body arrives corrupted. */
  retryCorruptLiveReads: boolean
  /** WA-3: re-send setHETriggerOptions when the firmware reports "mux channels incorrect" after boot. */
  reseedMuxOnError: boolean
  /** WA-4: discard the first reading after switching channels (firmware EMA state is shared by all channels). */
  discardFirstReadOnChannelSwitch: boolean
}

/** WA-1: pause after each /api request so the firmware has released the previous response buffer. */
export const FW_REQUEST_GAP_MS = 30

const defaultSleep = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

/**
 * WA-1: runs tasks strictly one at a time, leaving `gapMs` after each one.
 * Over RNDIS the firmware may still be transmitting a response from a heap string it has
 * already freed; concurrent requests make that memory get reused and the body arrive corrupted.
 * When disabled, tasks run immediately and concurrently (the original behaviour).
 */
export class RequestGate {
  private tail: Promise<unknown> = Promise.resolve()
  private readonly enabled: boolean
  private readonly gapMs: number
  private readonly sleep: (milliseconds: number) => Promise<void>

  // Explicit fields (no parameter properties) so the file runs under node --experimental-strip-types.
  constructor(enabled: boolean, gapMs: number = FW_REQUEST_GAP_MS, sleep: (milliseconds: number) => Promise<void> = defaultSleep) {
    this.enabled = enabled
    this.gapMs = gapMs
    this.sleep = sleep
  }

  run<T>(task: () => Promise<T>): Promise<T> {
    if (!this.enabled) return task()
    const result = this.tail.then(task)
    this.tail = result.catch(() => undefined).then(() => this.sleep(this.gapMs))
    return result
  }
}

/** WA-2: total attempts for a live read whose response body arrived corrupted. */
export const LIVE_READ_MAX_ATTEMPTS = 3

/** WA-3: what getHETriggerVoltage answers after boot until setHETriggerOptions has been POSTed. */
export const MUX_UNINITIALIZED_ERROR = 'mux channels incorrect'

export function isMuxUninitializedError(error: unknown): boolean {
  return error instanceof Error && error.message.includes(MUX_UNINITIALIZED_ERROR)
}

export interface LiveReadOps {
  /** One getHETriggerVoltage round trip, already validated. */
  read: () => Promise<number>
  /** POST setHETriggerOptions for this board; leave undefined when the board's mux wiring is not known. */
  reseedMux?: () => Promise<void>
}

/**
 * WA-2: getHETriggerVoltage only reads the ADC, so re-sending it is safe (unlike other POSTs).
 * Retries only when the response itself was unusable; firmware-reported errors and timeouts propagate.
 * WA-3: if the firmware says the mux is not configured yet, configure it once and read again.
 * The reseed is lazy, so firmware that already seeds its mux from stored config never triggers it.
 */
export async function readLiveWithRecovery(ops: LiveReadOps, flags: FwWorkaroundFlags = FW_WORKAROUNDS): Promise<number> {
  const maxAttempts = flags.retryCorruptLiveReads ? LIVE_READ_MAX_ATTEMPTS : 1
  let muxReseeded = false
  for (let attempt = 1; ; attempt++) {
    try {
      return await ops.read()
    } catch (error) {
      if (flags.reseedMuxOnError && !muxReseeded && ops.reseedMux && isMuxUninitializedError(error)) {
        muxReseeded = true
        await ops.reseedMux()
        attempt-- // configuring the mux is not a corruption retry
        continue
      }
      if (attempt >= maxAttempts || !isInvalidDeviceResponse(error)) throw error
    }
  }
}

export const FW_WORKAROUNDS: FwWorkaroundFlags = {
  serializeRequests: true,
  retryCorruptLiveReads: true,
  reseedMuxOnError: true,
  discardFirstReadOnChannelSwitch: true,
}
