import assert from 'node:assert/strict'
import test from 'node:test'
import { HARDWARE_LABELS, hardwareLabelText } from '../src/config/hardwareLabels.ts'

test('every Hall channel has its physical engraving or the explicit blank key', () => {
  const channels = Array.from({ length: 16 }, (_, index) => `ch${index}`)
  assert.deepEqual(Object.keys(HARDWARE_LABELS).sort(), channels.sort())
  assert.equal(HARDWARE_LABELS.ch13, null)
  assert.deepEqual(
    Object.entries(HARDWARE_LABELS).filter(([, label]) => label === null).map(([channel]) => channel),
    ['ch13'],
  )
})

test('hardware engraving text stays tied to the physical channel', () => {
  const expected = ['B', 'RT', 'LT', 'X', 'Y', 'RB', 'LB', 'SL', '←', '↓', 'LS', '↑', '→', null, 'A', 'RS']
  assert.deepEqual(
    Array.from({ length: 16 }, (_, index) => hardwareLabelText(`ch${index}`)),
    expected,
  )
})
