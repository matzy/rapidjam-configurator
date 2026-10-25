/**
 * Workarounds for known firmware bugs in RapidJAM firmware builds that predate
 * GP2040-CE_RapidJAM `worktree-adc29-unstable` (commits 2c3244cc, f9bba46a).
 *
 * Everything here is removable once a firmware containing those fixes is the
 * supported baseline. Each workaround is behind a flag in FW_WORKAROUNDS and its
 * call sites are tagged `FW-WORKAROUND(WA-n)`. See docs/fw-workarounds.md for the
 * removal procedure.
 */

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

export const FW_WORKAROUNDS: FwWorkaroundFlags = {
  serializeRequests: true,
  retryCorruptLiveReads: true,
  reseedMuxOnError: true,
  discardFirstReadOnChannelSwitch: true,
}
