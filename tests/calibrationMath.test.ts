import assert from 'node:assert/strict'
import test from 'node:test'
import { meterClientXToMillimeters, median, millimetersToRatio, ratioToMillimeters, ratioToRaw, rawToRatio, rawToTravelMillimeters, secondDeepest } from '../src/utils/calibrationMath.ts'

test('median picks the middle value regardless of input order', () => {
	assert.equal(median([5, 1, 3, 9, 4]), 4)
	assert.equal(median([7]), 7)
	assert.equal(median([10, 20, 30, 40]), 25)
	assert.throws(() => median([]), /At least one value/)
})

test('secondDeepest picks the second value farthest from idle for both polarities', () => {
	// N polarity: pressed voltage rises above idle
	assert.equal(secondDeepest([1000, 2000, 3500, 3000, 2500], 1000), 3000)
	// P polarity: pressed voltage falls below idle
	assert.equal(secondDeepest([3000, 2000, -500, 1000, 1500], 3000), 1000)
})

test('secondDeepest ignores a single spike at the deepest end', () => {
	assert.equal(secondDeepest([1000, 3900, 2900, 2800, 2950], 1000), 2950)
	assert.throws(() => secondDeepest([1000], 1000), /At least two values/)
})

test('raw ADC calibration values convert to travel equally for normal and reversed polarity', () => {
	assert.equal(rawToRatio(2000, 1000, 3000), 0.5)
	assert.equal(rawToRatio(2000, 3000, 1000), 0.5)
	assert.equal(ratioToRaw(0.5, 1000, 3000), 2000)
	assert.equal(ratioToRaw(0.5, 3000, 1000), 2000)
})

test('ratios convert to millimeters for different full-stroke lengths', () => {
	assert.equal(ratioToMillimeters(0.5, 1.5), 0.75)
	assert.equal(ratioToMillimeters(0.2, 4), 0.8)
	assert.equal(millimetersToRatio(0.8, 4), 0.2)
	assert.equal(rawToTravelMillimeters(2000, 1000, 3000, true, 4), 2)
	assert.equal(rawToTravelMillimeters(1000, 1000, 3000, true, 4), 0)
	assert.equal(rawToTravelMillimeters(3000, 1000, 3000, true, 4), 4)
})

test('meter pointer positions clamp and snap to setting-slider increments', () => {
	assert.equal(meterClientXToMillimeters(50, 100, 200, 1.5), 0.05)
	assert.equal(meterClientXToMillimeters(200, 100, 200, 1.5), 0.75)
	assert.equal(meterClientXToMillimeters(200, 100, 200, 4), 2)
	assert.equal(meterClientXToMillimeters(300, 100, 200, 1.5), 1.5)
	assert.equal(meterClientXToMillimeters(350, 100, 200, 1.5), 1.5)
	assert.equal(meterClientXToMillimeters(145, 100, 200, 1.5), 0.35)
	assert.equal(meterClientXToMillimeters(150, 100, 0, 1.5), null)
	assert.equal(meterClientXToMillimeters(Number.NaN, 100, 200, 1.5), null)
})
