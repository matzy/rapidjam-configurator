import type { DeviceTransport } from '../device'

export class LiveHallReadTimeoutError extends Error {
  constructor() {
    super('Live Hall voltage read timed out; reconnect before starting calibration')
    this.name = 'LiveHallReadTimeoutError'
  }
}

export class HallLiveReadPausedError extends Error {
  constructor() {
    super('Live Hall voltage reads are paused')
    this.name = 'HallLiveReadPausedError'
  }
}

export class HallLiveReadCoordinator {
  private paused = false
  private quarantined = false
  private pending: Promise<number> | null = null

  get isPaused(): boolean { return this.paused }
  get requiresReconnect(): boolean { return this.quarantined }

  read(transport: DeviceTransport, channel: number): Promise<number> {
    if (this.paused || this.quarantined) return Promise.reject(new HallLiveReadPausedError())
    if (this.pending) return this.pending.catch(() => undefined).then(() => this.read(transport, channel))

    const request = Promise.resolve().then(() => transport.readHallVoltageLive(channel))
    this.pending = request
    void request.catch((error: unknown) => {
      if (isLiveHallReadTimeoutError(error)) {
        this.quarantined = true
        this.paused = true
      }
    }).finally(() => {
      if (this.pending === request) this.pending = null
    })
    return request
  }

  async pauseAndDrain(): Promise<void> {
    this.paused = true
    if (this.quarantined) throw new LiveHallReadTimeoutError()
    const pending = this.pending
    if (!pending) return
    try {
      await pending
    } catch (error) {
      if (isLiveHallReadTimeoutError(error) || this.quarantined) throw new LiveHallReadTimeoutError()
      // A completed failed response has drained; it is safe to proceed to calibration.
    }
    if (this.quarantined) throw new LiveHallReadTimeoutError()
  }

  resumeAfterCalibration(): void {
    if (!this.quarantined) this.paused = false
  }

  resetAfterReconnect(): void {
    this.quarantined = false
    this.paused = false
  }
}

function isLiveHallReadTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === 'LiveHallReadTimeoutError'
}