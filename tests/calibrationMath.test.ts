import assert from 'node:assert/strict'
import test from 'node:test'
import { meterClientXToMillimeters, millimetersToRaw, rawToMillimeters } from '../src/utils/calibrationMath.ts'

test('raw ADC calibration values convert to travel equally for normal and reversed polarity', () => {
	assert.equal(rawToMillimeters(2000, 1000, 3000), 0.75)
	assert.equal(rawToMillimeters(2000, 3000, 1000), 0.75)
	assert.equal(millimetersToRaw(0.75, 1000, 3000), 2000)
	assert.equal(millimetersToRaw(0.75, 3000, 1000), 2000)
})

test('out-of-range travel conversion remains clamped', () => {
	assert.equal(rawToMillimeters(1000, 1000, 3000), 0.05)
	assert.equal(rawToMillimeters(3000, 1000, 3000), 1.5)
	assert.equal(rawToMillimeters(1000, 3000, 1000), 1.5)
})

test('meter pointer positions clamp and snap to setting-slider increments', () => {
	assert.equal(meterClientXToMillimeters(50, 100, 200), 0.05)
	assert.equal(meterClientXToMillimeters(200, 100, 200), 0.75)
	assert.equal(meterClientXToMillimeters(300, 100, 200), 1.5)
	assert.equal(meterClientXToMillimeters(350, 100, 200), 1.5)
	assert.equal(meterClientXToMillimeters(145, 100, 200), 0.35)
	assert.equal(meterClientXToMillimeters(150, 100, 0), null)
	assert.equal(meterClientXToMillimeters(Number.NaN, 100, 200), null)
})
