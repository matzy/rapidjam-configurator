import assert from 'node:assert/strict'
import test from 'node:test'
import type { HallSetting } from '../src/device.ts'
import { estimateHallInput, initialHallInputHistory } from '../src/utils/hallInputEstimate.ts'

const normalSetting: HallSetting = {
  idle: 1000,
  active: 2000,
  pressed: 3000,
  threshold: 2500,
  noise: 50,
  polarity: 'N',
  pressRatio: 0.5,
  releaseRatio: 0.75,
  rapidTrigger: false,
  calibrated: true,
}

test('RT off follows firmware active-only comparison with strict greater-than, for either polarity', () => {
  assert.equal(estimateHallInput(initialHallInputHistory(), 2000, normalSetting).state, 'off')
  assert.equal(estimateHallInput(initialHallInputHistory(), 2001, normalSetting).state, 'on')
  const reversed = { ...normalSetting, idle: 3000, active: 2000, pressed: 1000, polarity: 'P' as const }
  assert.equal(estimateHallInput(initialHallInputHistory(), 2095, reversed).state, 'off')
  assert.equal(estimateHallInput(initialHallInputHistory(), 1999, reversed).state, 'on')
})

test('RT on applies strict ADC noise delta and inclusive firmware actuation/release thresholds', () => {
  const setting = { ...normalSetting, rapidTrigger: true, releaseRatio: 0.75 }
  const start = estimateHallInput(initialHallInputHistory(), 1500, setting)
  assert.equal(start.state, 'unknown')
  const noiseBoundary = estimateHallInput(start, 1550, setting)
  assert.equal(noiseBoundary.state, 'unknown') // exactly the noise delta is not movement
  assert.equal(noiseBoundary.lastIncrement, 1500)
  const beforeActivation = estimateHallInput(initialHallInputHistory(), 1900, setting)
  const pressing = estimateHallInput(beforeActivation, 2000, setting)
  assert.equal(pressing.state, 'on') // above noise and exactly at the firmware activation threshold
  const atRelease = estimateHallInput({ state: 'on', lastIncrement: 2100 }, 2000, setting)
  assert.equal(atRelease.state, 'off') // release equality is accepted by firmware
})

test('RT off ignores release and noise; invalid RT-on release or noise is unknown', () => {
  const offWithInvalidRelease = { ...normalSetting, releaseRatio: Number.NaN, noise: Number.NaN }
  assert.equal(estimateHallInput(initialHallInputHistory(), 2001, offWithInvalidRelease).state, 'on')
  const onWithInvalidRelease = { ...offWithInvalidRelease, rapidTrigger: true }
  assert.equal(estimateHallInput(initialHallInputHistory(), 2001, onWithInvalidRelease).state, 'unknown')
  const onWithInvalidNoise = { ...normalSetting, rapidTrigger: true, noise: Number.NaN }
  assert.equal(estimateHallInput(initialHallInputHistory(), 2001, onWithInvalidNoise).state, 'unknown')
})