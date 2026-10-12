import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseButtonFaceTuningFile } from '../src/config/buttonFaceTuningValidation.ts'

const valid = {
  engraving: { offsetX: 0, offsetY: -40, scale: 1, opacity: 0.08, shadow: 1 },
  label: { offsetX: 0, offsetY: 0, fontSize: 10, opacity: 1 },
  perChannel: { ch3: { engraving: { offsetY: -30 } } },
}

test('accepts a valid file and keeps only provided overrides', () => {
  const result = parseButtonFaceTuningFile(valid)
  assert.equal(result.ok, true)
  if (result.ok) assert.deepEqual(result.value.perChannel, { ch3: { engraving: { offsetY: -30 } } })
})

test('drops empty overrides during normalization', () => {
  const result = parseButtonFaceTuningFile({ ...valid, perChannel: { ch3: { engraving: {} } } })
  assert.equal(result.ok, true)
  if (result.ok) assert.deepEqual(result.value.perChannel, {})
})

test('rejects non-object roots and unknown top-level keys', () => {
  assert.equal(parseButtonFaceTuningFile(null).ok, false)
  assert.equal(parseButtonFaceTuningFile([]).ok, false)
  assert.equal(parseButtonFaceTuningFile({ ...valid, extra: 1 }).ok, false)
})

test('rejects missing global fields', () => {
  const { opacity: _removed, ...rest } = valid.engraving
  assert.equal(parseButtonFaceTuningFile({ ...valid, engraving: rest }).ok, false)
})

test('rejects out-of-range and non-finite values', () => {
  assert.equal(parseButtonFaceTuningFile({ ...valid, engraving: { ...valid.engraving, scale: 5 } }).ok, false)
  assert.equal(parseButtonFaceTuningFile({ ...valid, engraving: { ...valid.engraving, opacity: Number.NaN } }).ok, false)
  assert.equal(parseButtonFaceTuningFile({ ...valid, engraving: { ...valid.engraving, opacity: '0.5' } }).ok, false)
})

test('rejects fields that do not belong to a section', () => {
  assert.equal(parseButtonFaceTuningFile({ ...valid, engraving: { ...valid.engraving, fontSize: 12 } }).ok, false)
  assert.equal(parseButtonFaceTuningFile({ ...valid, perChannel: { ch3: { label: { shadow: 1 } } } }).ok, false)
})

test('rejects inherited object keys instead of treating them as fields', () => {
  assert.equal(parseButtonFaceTuningFile({ ...valid, engraving: { ...valid.engraving, constructor: 1 } }).ok, false)
  const withOwnProto = { ...valid, engraving: { ...valid.engraving, ...JSON.parse('{"__proto__": 1}') } }
  assert.equal(parseButtonFaceTuningFile(withOwnProto).ok, false)
})

test('rejects invalid channel ids and unknown override sections', () => {
  assert.equal(parseButtonFaceTuningFile({ ...valid, perChannel: { ch16: { engraving: { offsetY: 0 } } } }).ok, false)
  assert.equal(parseButtonFaceTuningFile({ ...valid, perChannel: { led3: { engraving: { offsetY: 0 } } } }).ok, false)
  assert.equal(parseButtonFaceTuningFile({ ...valid, perChannel: { ch3: { other: { offsetY: 0 } } } }).ok, false)
})
