import assert from 'node:assert/strict'
import test from 'node:test'
import type { DeviceTransport } from '../src/device.ts'
import { HallLiveReadCoordinator, LiveHallReadTimeoutError } from '../src/transport/HallLiveReadCoordinator.ts'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function transportWithLiveRead(readHallVoltageLive: DeviceTransport['readHallVoltageLive']): DeviceTransport {
  return { readHallVoltageLive } as DeviceTransport
}

test('pauseAndDrain blocks new live reads and waits for an active read before calibration proceeds', async () => {
  const coordinator = new HallLiveReadCoordinator()
  const activeRead = deferred<number>()
  const events: string[] = []
  const transport = transportWithLiveRead(() => { events.push('live-start'); return activeRead.promise })
  const live = coordinator.read(transport, 4)
  await Promise.resolve()

  let drained = false
  const drain = coordinator.pauseAndDrain().then(() => { drained = true; events.push('calibration-prepare') })
  await Promise.resolve()
  assert.equal(drained, false)
  await assert.rejects(coordinator.read(transport, 4))
  assert.deepEqual(events, ['live-start'])

  activeRead.resolve(1200)
  await live
  await drain
  events.push('calibration-read')
  assert.deepEqual(events, ['live-start', 'calibration-prepare', 'calibration-read'])
  assert.equal(drained, true)
})

test('a timed-out live read keeps the coordinator quarantined until reconnect', async () => {
  const coordinator = new HallLiveReadCoordinator()
  const transport = transportWithLiveRead(async () => { throw new LiveHallReadTimeoutError() })
  await assert.rejects(coordinator.read(transport, 2), LiveHallReadTimeoutError)
  await assert.rejects(coordinator.pauseAndDrain(), LiveHallReadTimeoutError)
  assert.equal(coordinator.requiresReconnect, true)

  coordinator.resetAfterReconnect()
  assert.equal(coordinator.requiresReconnect, false)
  assert.equal(coordinator.isPaused, false)
})

test('completed non-timeout read failures are drained and can be followed by calibration', async () => {
  const coordinator = new HallLiveReadCoordinator()
  const activeRead = deferred<number>()
  const transport = transportWithLiveRead(() => activeRead.promise)
  const live = coordinator.read(transport, 1)
  await Promise.resolve()
  const drain = coordinator.pauseAndDrain()
  activeRead.reject(new Error('HTTP error response'))
  await assert.rejects(live, /HTTP error/)
  await drain
  assert.equal(coordinator.isPaused, true)
})