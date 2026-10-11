import assert from 'node:assert/strict'
import test from 'node:test'
import { readStrokeOverrides, resolveStroke, resolveStrokeForMode, writeStrokeOverrides } from '../src/config/strokeProfiles.ts'

test('stroke resolution selects case-insensitive presets and fallback for unknown boards', () => {
  assert.deepEqual(resolveStroke({ product: 'Rapid JAM', boardConfig: 'RapidJAM', boardConfigLabel: 'Rapid JAM' }), {
    label: 'RapidJAM',
    strokeMm: 1.5,
    source: 'preset',
  })
  assert.equal(resolveStroke({ product: 'Rapid JAM', boardConfigLabel: 'Rapid JAM' }).source, 'preset')
  assert.deepEqual(resolveStroke({ product: 'Other Board', boardConfig: 'other-board', boardConfigLabel: 'Other Board' }), {
    label: 'Other Board',
    strokeMm: 1.5,
    source: 'fallback',
  })
  assert.equal(resolveStroke(null).source, 'fallback')
})

test('per-board custom stroke overrides persist and take precedence over presets', () => {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  }
  writeStrokeOverrides({ rapidjam: 4, other: 2.5 }, storage)

  const overrides = readStrokeOverrides(storage)
  assert.equal(resolveStroke({ product: 'Rapid JAM', boardConfig: 'RapidJAM' }, overrides).strokeMm, 4)
  assert.equal(resolveStroke({ product: 'Rapid JAM', boardConfig: 'RapidJAM' }, overrides).source, 'custom')
  assert.equal(resolveStroke({ product: 'Other', boardConfig: 'other' }, overrides).strokeMm, 2.5)
  assert.equal(resolveStroke({ product: 'Unknown', boardConfig: 'unknown' }, overrides).source, 'fallback')
})

test('stroke editor only appears in Expert mode, except unsupported devices are flagged in Standard mode', () => {
  const rapidjam = { product: 'RapidJAM', boardConfig: 'RapidJAM' }
  const unsupported = { product: 'Other Board', boardConfig: 'OtherBoard', boardConfigLabel: 'Other Board' }
  const overrides = { rapidjam: 3.2, otherboard: 3.5 }

  assert.deepEqual(resolveStrokeForMode(rapidjam, 'standard', overrides), {
    label: 'RapidJAM', strokeMm: 1.5, source: 'preset', showEditor: false, unsupportedDevice: false,
  })
  assert.deepEqual(resolveStrokeForMode(unsupported, 'standard', overrides), {
    label: 'Other Board', strokeMm: 1.5, source: 'fallback', showEditor: false, unsupportedDevice: true,
  })
  assert.deepEqual(resolveStrokeForMode(rapidjam, 'expert', overrides), {
    label: 'RapidJAM', strokeMm: 3.2, source: 'custom', showEditor: true, unsupportedDevice: false,
  })
  assert.deepEqual(resolveStrokeForMode(unsupported, 'expert', overrides), {
    label: 'Other Board', strokeMm: 3.5, source: 'custom', showEditor: true, unsupportedDevice: true,
  })
})

test('invalid saved overrides are filtered to supported stroke range', () => {
  const storage = {
    getItem: () => JSON.stringify({ valid: 3.2, maximum: 4, tooSmall: 0.4, tooLarge: 4.1, notNumber: '2' }),
    setItem: () => {},
  }
  assert.deepEqual(readStrokeOverrides(storage), { valid: 3.2, maximum: 4 })
})
