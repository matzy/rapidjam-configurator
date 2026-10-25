import assert from 'node:assert/strict'
import test from 'node:test'
import { InvalidDeviceResponseError } from '../src/transport/deviceResponse.ts'
import { FW_WORKAROUNDS, LIVE_READ_MAX_ATTEMPTS, RequestGate, readLiveWithRecovery } from '../src/transport/fwWorkarounds.ts'

const withFlags = (patch: Partial<typeof FW_WORKAROUNDS>) => ({ ...FW_WORKAROUNDS, ...patch })

// FW-WORKAROUND(WA-1) tests. Delete the matching blocks when the workaround is removed.

function trackedTask(state: { active: number, maxActive: number, order: number[] }, id: number, duration = 5) {
  return async () => {
    state.active++
    state.maxActive = Math.max(state.maxActive, state.active)
    state.order.push(id)
    await new Promise((resolve) => setTimeout(resolve, duration))
    state.active--
    return id
  }
}

test('WA-1: an enabled gate runs tasks one at a time, in order', async () => {
  const state = { active: 0, maxActive: 0, order: [] as number[] }
  const gate = new RequestGate(true, 0)
  const results = await Promise.all([1, 2, 3, 4].map((id) => gate.run(trackedTask(state, id))))
  assert.deepEqual(results, [1, 2, 3, 4])
  assert.deepEqual(state.order, [1, 2, 3, 4])
  assert.equal(state.maxActive, 1)
})

test('WA-1: the gate leaves a gap after each task, including failed ones', async () => {
  const sleeps: number[] = []
  const gate = new RequestGate(true, 30, async (ms) => { sleeps.push(ms) })
  await gate.run(async () => 1)
  await assert.rejects(gate.run(async () => { throw new Error('boom') }), /boom/)
  await gate.run(async () => 3)
  assert.deepEqual(sleeps, [30, 30])
})

test('WA-1: a failed task does not block the queue', async () => {
  const gate = new RequestGate(true, 0)
  const failing = gate.run(async () => { throw new Error('first failed') })
  const next = gate.run(async () => 'second ok')
  await assert.rejects(failing, /first failed/)
  assert.equal(await next, 'second ok')
})

test('WA-1: a disabled gate keeps the original concurrent behaviour', async () => {
  const state = { active: 0, maxActive: 0, order: [] as number[] }
  const gate = new RequestGate(false, 50)
  await Promise.all([1, 2, 3].map((id) => gate.run(trackedTask(state, id))))
  assert.equal(state.maxActive, 3)
})

function scriptedRead(outcomes: Array<number | Error>) {
  let calls = 0
  return {
    read: async () => {
      const outcome = outcomes[Math.min(calls++, outcomes.length - 1)]
      if (outcome instanceof Error) throw outcome
      return outcome
    },
    get calls() { return calls },
  }
}

test('WA-2: a corrupted live response is retried and the next good read is returned', async () => {
  const ops = scriptedRead([new InvalidDeviceResponseError('Invalid JSON'), new InvalidDeviceResponseError('bad voltage'), 2100])
  assert.equal(await readLiveWithRecovery(ops), 2100)
  assert.equal(ops.calls, 3)
})

test('WA-2: gives up after the attempt limit and surfaces the corruption error', async () => {
  const ops = scriptedRead([new InvalidDeviceResponseError('Invalid JSON')])
  await assert.rejects(readLiveWithRecovery(ops), InvalidDeviceResponseError)
  assert.equal(ops.calls, LIVE_READ_MAX_ATTEMPTS)
})

test('WA-2: firmware errors and timeouts are not retried', async () => {
  const firmware = scriptedRead([new Error('adc pin out of range')])
  await assert.rejects(readLiveWithRecovery(firmware), /adc pin out of range/)
  assert.equal(firmware.calls, 1)

  const timeout = Object.assign(new Error('timed out'), { name: 'LiveHallReadTimeoutError' })
  const timedOut = scriptedRead([timeout])
  await assert.rejects(readLiveWithRecovery(timedOut), /timed out/)
  assert.equal(timedOut.calls, 1)
})

test('WA-2: with the flag off a corrupted response fails on the first attempt', async () => {
  const ops = scriptedRead([new InvalidDeviceResponseError('Invalid JSON'), 2100])
  await assert.rejects(readLiveWithRecovery(ops, withFlags({ retryCorruptLiveReads: false })), InvalidDeviceResponseError)
  assert.equal(ops.calls, 1)
})

test('WA-3: "mux channels incorrect" triggers one mux setup and a re-read', async () => {
  const ops = scriptedRead([new Error('mux channels incorrect'), 1900])
  let reseeds = 0
  assert.equal(await readLiveWithRecovery({ ...ops, reseedMux: async () => { reseeds++ } }), 1900)
  assert.equal(reseeds, 1)
  assert.equal(ops.calls, 2)
})

test('WA-3: the mux is set up only once even if the error persists', async () => {
  const ops = scriptedRead([new Error('mux channels incorrect')])
  let reseeds = 0
  await assert.rejects(readLiveWithRecovery({ ...ops, reseedMux: async () => { reseeds++ } }), /mux channels incorrect/)
  assert.equal(reseeds, 1)
  assert.equal(ops.calls, 2)
})

test('WA-3: the mux setup does not use up the corruption retries', async () => {
  const ops = scriptedRead([new Error('mux channels incorrect'), new InvalidDeviceResponseError('a'), new InvalidDeviceResponseError('b'), 1800])
  assert.equal(await readLiveWithRecovery({ ...ops, reseedMux: async () => {} }), 1800)
  assert.equal(ops.calls, 4)
})

test('WA-3: nothing is sent for other firmware errors, unknown boards, or with the flag off', async () => {
  let reseeds = 0
  const reseedMux = async () => { reseeds++ }

  const other = scriptedRead([new Error('adc pin out of range')])
  await assert.rejects(readLiveWithRecovery({ ...other, reseedMux }), /adc pin out of range/)

  const unknownBoard = scriptedRead([new Error('mux channels incorrect')])
  await assert.rejects(readLiveWithRecovery({ read: unknownBoard.read }), /mux channels incorrect/)

  const flagOff = scriptedRead([new Error('mux channels incorrect')])
  await assert.rejects(readLiveWithRecovery({ ...flagOff, reseedMux }, withFlags({ reseedMuxOnError: false })), /mux channels incorrect/)

  assert.equal(reseeds, 0)
})
