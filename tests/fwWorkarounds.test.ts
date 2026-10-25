import assert from 'node:assert/strict'
import test from 'node:test'
import { RequestGate } from '../src/transport/fwWorkarounds.ts'

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
