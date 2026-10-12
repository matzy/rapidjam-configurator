import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buttonFaceStyle, resolveButtonFace, type ButtonFaceTuningFile } from '../src/config/buttonFaceTuning.ts'

const defaults = JSON.parse(readFileSync(new URL('../src/config/buttonFaceTuning.json', import.meta.url), 'utf8')) as ButtonFaceTuningFile

test('defaults are neutral deltas: no offset or scale change on top of the SVG base', () => {
  assert.deepEqual(buttonFaceStyle('ch0', defaults), {
    '--engraving-offset-x': '0px',
    '--engraving-offset-y': '0px',
    '--engraving-scale': '1',
    '--engraving-opacity': '0.08',
    '--engraving-shadow': '1',
    '--label-font-size': '10px',
    '--label-opacity': '1',
  })
})

test('per-channel overrides change only the listed fields of that channel', () => {
  const file: ButtonFaceTuningFile = { ...defaults, perChannel: { ch14: { engraving: { offsetY: -30 } } } }
  assert.equal(resolveButtonFace('ch14', file).engraving.offsetY, -30)
  assert.equal(resolveButtonFace('ch14', file).engraving.opacity, defaults.engraving.opacity)
  assert.equal(resolveButtonFace('ch0', file).engraving.offsetY, defaults.engraving.offsetY)
})
