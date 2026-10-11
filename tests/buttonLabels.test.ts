import assert from 'node:assert/strict'
import test from 'node:test'
import { buttonLabel } from '../src/config/buttonLabels.ts'
import { INPUT_MODE_OPTIONS } from '../src/config/inputModes.ts'

const BUTTONS = ['B1', 'B2', 'B3', 'B4', 'L1', 'R1', 'L2', 'R2', 'L3', 'R3', 'S1', 'S2', 'A1', 'A2'] as const

const EXPECTED: Record<number, string[]> = {
  0: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'LS', 'RS', 'Back', 'Start', 'Guide', 'A2 (unused)'],
  1: ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', 'LS', 'RS', '−', '+', 'Home', 'Capture'],
  2: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'L3', 'R3', 'Select', 'Start', 'PS', 'Touchpad'],
  3: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'LS', 'RS', 'Back', 'Start', 'Guide', 'A2 (unused)'],
  4: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'L3', 'R3', 'Share', 'Options', 'PS', 'Touchpad'],
  5: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'LS', 'RS', 'View', 'Menu', 'A1 (unused)', 'A2 (unused)'],
  6: ['A', 'B', 'X', 'Y', 'L1 (unused)', 'Z', 'L2 (unused)', 'C', 'L3 (unused)', 'R3 (unused)', 'Mode', 'Start', 'A1 (unused)', 'A2 (unused)'],
  7: ['B', 'D', 'A', 'C', 'L1', 'R1', 'L2', 'R2', 'L3 (unused)', 'R3 (unused)', 'Select', 'Start', 'Options', 'A2 (unused)'],
  8: ['I', 'II', 'B3 (unused)', 'B4 (unused)', 'L1 (unused)', 'R1 (unused)', 'L2 (unused)', 'R2 (unused)', 'L3 (unused)', 'R3 (unused)', 'Select', 'Run', 'A1 (unused)', 'A2 (unused)'],
  9: ['A', 'B', 'D', 'E', 'L1 (unused)', 'F', 'L2 (unused)', 'C', 'L3 (unused)', 'R3 (unused)', 'Credit', 'Start', 'Menu', 'A2 (unused)'],
  10: ['A', 'B', 'D', 'E', 'L1 (unused)', 'F', 'L2 (unused)', 'C', 'L3 (unused)', 'R3 (unused)', 'Credit', 'Start', 'A1 (unused)', 'A2 (unused)'],
  11: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'L3 (unused)', 'R3 (unused)', 'Start', 'Select', 'A1 (unused)', 'A2 (unused)'],
  12: ['A', 'B', 'X', 'Y', 'White', 'Black', 'LT', 'RT', 'LS', 'RS', 'Back', 'Start', 'A1 (unused)', 'A2 (unused)'],
  13: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'L3', 'R3', 'Create', 'Options', 'PS', 'Touchpad'],
  14: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'LS', 'RS', 'Back', 'Start', 'Guide', 'A2 (unused)'],
  15: ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', 'LS', 'RS', '−', '+', 'Home', 'Capture'],
  16: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'L3', 'R3', 'Create', 'Options', 'PS', 'Touchpad'],
}

test('labels follow firmware mappings for every supported input mode', () => {
  assert.deepEqual(INPUT_MODE_OPTIONS.map(({ value }) => value).sort((a, b) => a - b), Object.keys(EXPECTED).map(Number).sort((a, b) => a - b))
  for (const [inputMode, expected] of Object.entries(EXPECTED)) {
    assert.deepEqual(BUTTONS.map((action) => {
      const { label, unused } = buttonLabel(Number(inputMode), action)
      return unused ? `${label} (unused)` : label
    }), expected, `input mode ${inputMode}`)
  }
})

test('unsupported input mode values fall back to XInput names', () => {
  assert.deepEqual(
    BUTTONS.slice(0, 4).map((action) => buttonLabel(17, action).label),
    ['A', 'B', 'X', 'Y'],
  )
  assert.equal(buttonLabel(255, 'S1').label, 'Back')
})

test('PS4, PS5 and P5 General swap Share/Create and Touchpad labels', () => {
  assert.deepEqual([4, 13, 16].map((mode) => buttonLabel(mode, 'S1', true).label), ['Touchpad', 'Touchpad', 'Touchpad'])
  assert.deepEqual([4, 13, 16].map((mode) => buttonLabel(mode, 'A2', true).label), ['Share', 'Create', 'Create'])
  assert.equal(buttonLabel(2, 'S1', true).label, 'Select')
})

test('directions, unassigned and keyboard-only actions pass through', () => {
  assert.equal(buttonLabel(1, 'Left').label, 'LEFT')
  assert.deepEqual(buttonLabel(4, 'NONE'), { label: 'NONE', unused: false })
  assert.deepEqual(buttonLabel(0, 'A3'), { label: 'A3', unused: false })
  assert.equal(buttonLabel(5, 'B1').label, 'A')
})

test('SInput is omitted and all firmware mini-console modes are listed', () => {
  assert.equal(INPUT_MODE_OPTIONS.some(({ value }) => value === 17), false)
  assert.deepEqual(
    INPUT_MODE_OPTIONS.filter(({ value }) => value >= 6 && value <= 11).map(({ value }) => value),
    [6, 7, 8, 9, 10, 11],
  )
})
