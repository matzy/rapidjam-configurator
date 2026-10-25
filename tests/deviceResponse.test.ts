import assert from 'node:assert/strict'
import test from 'node:test'
import { InvalidDeviceResponseError, isInvalidDeviceResponse, parseHallVoltageResponse } from '../src/transport/deviceResponse.ts'

test('accepts an in-range integer voltage, with or without a matching targetId echo', () => {
  assert.equal(parseHallVoltageResponse({ voltage: 2350 }, 3), 2350)
  assert.equal(parseHallVoltageResponse({ voltage: 0, targetId: 3 }, 3), 0)
  assert.equal(parseHallVoltageResponse({ voltage: 4095, targetId: 15 }, 15), 4095)
})

test('firmware-reported errors stay plain errors and are not treated as corruption', () => {
  assert.throws(() => parseHallVoltageResponse({ error: 'mux channels incorrect' }, 0), (error: unknown) => {
    assert.equal((error as Error).message, 'mux channels incorrect')
    assert.equal(isInvalidDeviceResponse(error), false)
    return true
  })
})

test('values that cannot come from a 12-bit ADC are flagged as invalid responses', () => {
  for (const body of [{}, { voltage: -1 }, { voltage: 4096 }, { voltage: 12.5 }, { voltage: '2000' }, { voltage: null }, null, 'x']) {
    assert.throws(() => parseHallVoltageResponse(body, 1), InvalidDeviceResponseError, JSON.stringify(body))
  }
})

test('a targetId echo for another channel is flagged as an invalid response', () => {
  assert.throws(() => parseHallVoltageResponse({ voltage: 2000, targetId: 4 }, 5), InvalidDeviceResponseError)
})
