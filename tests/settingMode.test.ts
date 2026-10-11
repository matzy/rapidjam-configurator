import assert from 'node:assert/strict'
import test from 'node:test'
import { actuationMaxFor, clampActuation, parseSettingMode } from '../src/config/settingMode.ts'

test('standard mode caps the actuation point at 1.30 mm while expert mode allows 1.50 mm', () => {
	assert.equal(actuationMaxFor('standard'), 1.3)
	assert.equal(actuationMaxFor('expert'), 1.5)
})

test('actuation clamping keeps 1.30 mm in standard mode and rejects deeper values', () => {
	assert.equal(clampActuation(1.3, 'standard'), 1.3)
	assert.equal(clampActuation(1.35, 'standard'), 1.3)
	assert.equal(clampActuation(1.5, 'standard'), 1.3)
	assert.equal(clampActuation(0.3, 'standard'), 0.3)
	assert.equal(clampActuation(0, 'standard'), 0.05)
})

test('expert mode keeps the full actuation range', () => {
	assert.equal(clampActuation(1.35, 'expert'), 1.35)
	assert.equal(clampActuation(1.5, 'expert'), 1.5)
	assert.equal(clampActuation(1.6, 'expert'), 1.5)
	assert.equal(clampActuation(0, 'expert'), 0.05)
})

test('stored setting mode defaults to standard unless expert was explicitly saved', () => {
	assert.equal(parseSettingMode('expert'), 'expert')
	assert.equal(parseSettingMode('standard'), 'standard')
	assert.equal(parseSettingMode(null), 'standard')
	assert.equal(parseSettingMode('EXPERT'), 'standard')
	assert.equal(parseSettingMode(''), 'standard')
})
