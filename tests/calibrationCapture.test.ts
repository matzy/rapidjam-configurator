import assert from 'node:assert/strict'
import test from 'node:test'
import { advancePressCycle, createPressCycleState, evaluatePressCycles, pressCycleAction, type PressCycleEvent, type PressCycleOptions, type PressCycleState } from '../src/utils/calibrationCapture.ts'

const optionsFor = (idle: number): PressCycleOptions => ({
	idle,
	threshold: 150,
	sampleTarget: 5,
	releaseIdleSamples: 3,
	pressCycles: 3,
	maxPressCycles: 5,
	spreadLimit: 0.08,
})

const replay = (values: number[], options: PressCycleOptions, start: PressCycleState = createPressCycleState()) =>
	values.reduce<{ state: PressCycleState; events: PressCycleEvent[] }>((acc, value) => {
		const step = advancePressCycle(acc.state, value, options)
		return { state: step.state, events: step.event === 'none' ? acc.events : [...acc.events, step.event] }
	}, { state: start, events: [] })

// One press (five held readings), then a release reading and three idle readings.
const cycle = (idle: number, pressedValues: number[]) => [...pressedValues, idle, idle, idle, idle]
const press = (pressed: number, count = 5) => Array.from({ length: count }, () => pressed)

test('three consistent presses complete the capture with median values', () => {
	const options = optionsFor(1000)
	const values = [...cycle(1000, press(3000)), ...cycle(1000, press(3010)), ...cycle(1000, press(2990))]
	const { state, events } = replay(values, options)
	assert.equal(state.outcome, 'complete')
	assert.equal(state.pressed, 3000)
	assert.equal(state.idle, 1000)
	assert.equal(state.pressedCycles.length, 3)
	assert.equal(events.filter((event) => event === 'press-recorded').length, 3)
	assert.equal(events.at(-1), 'complete')
})

test('P polarity works when the pressed value falls below idle', () => {
	const options = optionsFor(3000)
	const values = [...cycle(3000, press(1000)), ...cycle(3000, press(1010)), ...cycle(3000, press(990))]
	const { state } = replay(values, options)
	assert.equal(state.outcome, 'complete')
	assert.equal(state.pressed, 1000)
	assert.equal(state.idle, 3000)
})

test('a release during press sampling restarts only that press', () => {
	const options = optionsFor(1000)
	const values = [
		...cycle(1000, press(3000)),
		...cycle(1000, [3000, 3000, 1000]),
		...cycle(1000, press(3000)),
		...cycle(1000, press(3000)),
	]
	const { state, events } = replay(values, options)
	assert.equal(events.includes('released-early'), true)
	assert.equal(state.outcome, 'complete')
	assert.equal(state.pressedCycles.length, 3)
})

test('inconsistent presses request more presses and become unstable after five', () => {
	const options = optionsFor(1000)
	const values = [
		...cycle(1000, press(3000)),
		...cycle(1000, press(3600)),
		...cycle(1000, press(2400)),
		...cycle(1000, press(3000)),
		...cycle(1000, press(3000)),
	]
	const { state, events } = replay(values, options)
	assert.equal(state.outcome, 'unstable')
	assert.equal(state.pressedCycles.length, 5)
	assert.equal(state.pressed, 3000)
	assert.ok(state.spreadPercent !== null && state.spreadPercent > 8)
	assert.equal(events.filter((event) => event === 'cycle-done').length, 4)
	assert.equal(events.at(-1), 'unstable')
})

test('the latest three presses that agree recover the capture on the fourth press', () => {
	const options = optionsFor(1000)
	const values = [
		...cycle(1000, press(2000)),
		...cycle(1000, press(3000)),
		...cycle(1000, press(3010)),
		...cycle(1000, press(3020)),
	]
	const { state } = replay(values, options)
	assert.equal(state.outcome, 'complete')
	assert.equal(state.pressedCycles.length, 4)
	assert.equal(state.pressed, 3010)
})

test('completed presses survive a long wait before the next press', () => {
	const options = optionsFor(1000)
	const first = replay([...cycle(1000, press(3000)), ...cycle(1000, press(3000))], options)
	assert.equal(first.state.pressedCycles.length, 2)
	const waited = replay(Array.from({ length: 50 }, () => 1000), options, first.state)
	assert.equal(waited.state.pressedCycles.length, 2)
	assert.equal(waited.state.phase, 'await-press')
	const resumed = replay(cycle(1000, press(3000)), options, waited.state)
	assert.equal(resumed.state.outcome, 'complete')
})

test('pressing again during idle sampling starts the next press', () => {
	const options = optionsFor(1000)
	const { state, events } = replay([3000, 3000, 3000, 3000, 3000, 1000, 1000, 3000], options)
	assert.equal(events.at(-1), 'pressed')
	assert.equal(state.phase, 'press-sampling')
	assert.deepEqual(state.samples, [3000])
	assert.equal(state.pressedCycles.length, 1)
})

test('resolved captures ignore further readings', () => {
	const options = optionsFor(1000)
	const done = replay([...cycle(1000, press(3000)), ...cycle(1000, press(3000)), ...cycle(1000, press(3000))], options)
	const after = replay(press(3000), options, done.state)
	assert.equal(after.state, done.state)
	assert.deepEqual(after.events, [])
})

test('evaluatePressCycles reports the spread against the span', () => {
	const decision = evaluatePressCycles([3000, 3100, 3050], [1000, 1000, 1000, 1000], optionsFor(1000))
	assert.equal(decision.outcome, 'complete')
	assert.equal(decision.pressed, 3050)
	assert.equal(decision.spreadPercent, 4.9)
	const pending = evaluatePressCycles([3000, 3100], [1000], optionsFor(1000))
	assert.equal(pending.outcome, 'in-progress')
	assert.equal(pending.spreadPercent, null)
})

test('pressCycleAction tells the operator which motion the current phase needs', () => {
	const options = optionsFor(1000)
	assert.equal(pressCycleAction(createPressCycleState()), 'press')
	assert.equal(pressCycleAction(replay(press(3000, 2), options).state), 'hold')
	assert.equal(pressCycleAction(replay(press(3000), options).state), 'release')
	assert.equal(pressCycleAction(replay([...press(3000), 1000], options).state), 'release')
	const finished = replay([...cycle(1000, press(3000)), ...cycle(1000, press(3010)), ...cycle(1000, press(2990))], options).state
	assert.equal(finished.outcome, 'complete')
	assert.equal(pressCycleAction(finished), 'press')
})

