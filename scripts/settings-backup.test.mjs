import test from 'node:test'
import assert from 'node:assert/strict'
import { ConfigPersistenceError } from '../src/transport/configPersistence.mjs'
import {
  SettingsBackupError,
  buildRestorePlan,
  commitRestorePlan,
  createGp2040Backup,
  parseGp2040Backup,
  serializeGp2040Backup,
} from '../src/transport/settingsBackup.mjs'

const gpioActionValues = { NONE: -10, UP: 1, DOWN: 2, LEFT: 3, RIGHT: 4, B1: 5, B2: 6, B3: 7, B4: 8, L1: 9, R1: 10, L2: 11, R2: 12, S1: 13, S2: 14, A1: 15, A2: 16, L3: 17, R3: 18, FN: 19 }
const DEVICE = { boardConfig: 'RapidJAM', firmware: '1.0.0' }
const STROKE_LIMITS = { min: 0.5, max: 4 }
const KEY_NAMES = ['Up', 'Down', 'Left', 'Right', 'B1', 'B2', 'B3', 'B4', 'L1', 'R1', 'L2', 'R2', 'S1', 'S2', 'L3', 'R3', 'A1', 'A2', 'A3', 'A4']

function makeSnapshot() {
  const pinMappings = Object.fromEntries(Array.from({ length: 30 }, (_, pin) => [`pin${String(pin).padStart(2, '0')}`, {
    action: pin < 6 ? [gpioActionValues.S2, gpioActionValues.A1, gpioActionValues.B1, gpioActionValues.B2, gpioActionValues.B3, gpioActionValues.FN][pin] : gpioActionValues.NONE,
    customButtonMask: 0,
    customDpadMask: 0,
  }]))
  const triggers = Array.from({ length: 32 }, (_, channel) => (channel < 16
    ? { action: gpioActionValues.UP, idle: 2200 + channel, active: 2300 + channel, pressed: 3000 + channel, release: 2700 + channel, noise: 30, is_polarized: 0, rapidTrigger: 1 }
    : { action: gpioActionValues.NONE, idle: 0, active: 0, pressed: 0, release: 0, noise: 0, is_polarized: 0, rapidTrigger: 0 }))
  const keyMappings = Object.fromEntries(KEY_NAMES.map((name, index) => [name, index + 4]))
  const gamepadOptions = {
    dpadMode: 0,
    inputMode: 3,
    inputDeviceType: 0,
    socdMode: 2,
    switchTpShareForDs4: 0,
    lockHotkeys: 0,
    fourWayMode: 0,
    profileNumber: 1,
    debounceDelay: 5,
    inputModeB1: 0,
    inputModeB2: 13,
    inputModeB3: 0,
    inputModeB4: 4,
    inputModeL1: -1,
    inputModeL2: 2,
    inputModeR1: 1,
    inputModeR2: 15,
    ps4AuthType: 0,
    ps5AuthType: 0,
    xinputAuthType: 0,
    ps4ControllerIDMode: 0,
    miniMenuGamepadInput: 0,
    usbDescOverride: 0,
    usbDescProduct: '',
    usbDescManufacturer: '',
    usbDescVersion: '',
    usbOverrideID: 0,
    usbVendorID: '0000',
    usbProductID: '0000',
    fnButtonPin: 5,
    forcedSetupMode: 0,
    ...Object.fromEntries(Array.from({ length: 16 }, (_, index) => [
      `hotkey${String(index + 1).padStart(2, '0')}`,
      { auxMask: 0, buttonsMask: 0, action: 0 },
    ])),
  }
  return { pinMappings, hallCalibrations: { triggers }, keyMappings, gamepadOptions }
}

const clone = (value) => structuredClone(value)

function planFrom(text, { snapshot = makeSnapshot(), device = DEVICE, strokeOverrides = {}, deviceStrokeKey = 'rapidjamgp' } = {}) {
  return buildRestorePlan({
    parsed: parseGp2040Backup(text),
    baseline: snapshot,
    device,
    gpioActionValues,
    currentStrokeOverrides: strokeOverrides,
    deviceStrokeKey,
    strokeLimits: STROKE_LIMITS,
  })
}

function backupText(snapshot = makeSnapshot(), extra = {}) {
  return serializeGp2040Backup({ ...createGp2040Backup({
    snapshot,
    device: DEVICE,
    configuratorVersion: '0.0.0-test',
    createdAt: '2026-01-01T00:00:00.000Z',
  }), ...extra })
}

test('round-trip of an unchanged device produces an empty plan with no writes', () => {
  const snapshot = makeSnapshot()
  const backup = createGp2040Backup({ snapshot, device: DEVICE, configuratorVersion: '0.0.0-test', createdAt: 'now' })
  assert.deepEqual(backup.keyboard.Up, { pin: -1, key: 4, error: null })
  const plan = planFrom(serializeGp2040Backup(backup), { snapshot })
  assert.equal(plan.ok, true, JSON.stringify(plan.blockingIssues))
  assert.equal(plan.hasChanges, false)
  assert.deepEqual(plan.keptGroups, [])
  assert.equal(plan.origin.kind, 'configurator')
  assert.equal(plan.origin.requiresAcknowledgement, false)
})

test('only the connected device stroke override is exported and applied', () => {
  const backup = createGp2040Backup({
    snapshot: makeSnapshot(),
    device: DEVICE,
    configuratorVersion: 'x',
    createdAt: 'now',
    strokeOverrides: { rapidjamgp: 2.2, other: 3.1 },
    strokeKey: 'rapidjamgp',
  })
  assert.deepEqual(backup.rapidjamConfigurator.strokeOverrides, { rapidjamgp: 2.2 })

  const plan = planFrom(serializeGp2040Backup(backup), { deviceStrokeKey: 'rapidjamgp' })
  assert.deepEqual(plan.strokeOverrides.changed, ['rapidjamgp'])
  assert.equal(plan.strokeOverrides.next.rapidjamgp, 2.2)

  const otherDevice = planFrom(serializeGp2040Backup(backup), { deviceStrokeKey: 'other' })
  assert.deepEqual(otherDevice.strokeOverrides.changed, [])
  assert.ok(otherDevice.ignored.some((entry) => entry.reason === 'other-device'))
})

test('a stroke override outside the allowed range blocks the plan', () => {
  const text = backupText(makeSnapshot(), { rapidjamConfigurator: { formatVersion: 1, device: DEVICE, strokeOverrides: { rapidjamgp: 9 } } })
  const plan = planFrom(text)
  assert.equal(plan.ok, false)
  assert.ok(plan.blockingIssues.some((issue) => issue.path.endsWith('rapidjamgp')))
})

test('a WebConfig-shaped file restores known groups, ignores WebConfig-only groups and Fn keyboard entry', () => {
  const snapshot = makeSnapshot()
  const webConfig = JSON.stringify({
    display: { brightness: 3 },
    splash: { mode: 1 },
    led: {},
    profiles: [],
    keyboard: { Up: { pin: -1, key: 26, error: null }, Fn: { pin: -1, key: 99, error: null } },
    pins: { ...clone(snapshot.pinMappings), pin00: { ...snapshot.pinMappings.pin00, action: gpioActionValues.A2 } },
    heTrigger: clone(snapshot.hallCalibrations),
    gamepad: clone(snapshot.gamepadOptions),
  })
  const plan = planFrom(webConfig, { snapshot })
  assert.equal(plan.ok, true, JSON.stringify(plan.blockingIssues))
  assert.equal(plan.origin.kind, 'unknown')
  assert.equal(plan.origin.requiresAcknowledgement, true)
  assert.deepEqual(plan.ignoredTopLevelKeys.sort(), ['display', 'led', 'profiles', 'splash'])
  assert.ok(plan.ignored.some((entry) => entry.path === 'keyboard.Fn' && entry.reason === 'unsupported-action'))
  assert.deepEqual(plan.changes.gpio, ['pin00.action'])
  assert.deepEqual(plan.changes.keyboard, ['Up'])
  assert.equal(plan.writes.options, null)
  assert.equal(plan.writes.hall, null)
})

test('a partial file restores only its groups and keeps the others unchanged', () => {
  const snapshot = makeSnapshot()
  const text = JSON.stringify({ keyboard: { Up: 40 } })
  const plan = planFrom(text, { snapshot })
  assert.equal(plan.ok, true, JSON.stringify(plan.blockingIssues))
  assert.deepEqual(plan.presentGroups, ['keyboard'])
  assert.deepEqual(plan.keptGroups, ['pins', 'heTrigger', 'gamepad'])
  assert.deepEqual(plan.expected.pinMappings, snapshot.pinMappings)
  assert.deepEqual(plan.expected.hallCalibrations, snapshot.hallCalibrations)
  assert.equal(plan.expected.keyMappings.Up, 40)
  assert.notEqual(plan.writes.keyboard, null)
  assert.equal(plan.writes.gpio, null)
})

test('unknown fields and unknown pins are listed as ignored, not applied', () => {
  const text = JSON.stringify({
    pins: { pin00: { action: gpioActionValues.A2, futureField: 1 }, pin99: { action: 1 } },
    futureTopLevel: { a: 1 },
  })
  const plan = planFrom(text)
  assert.equal(plan.ok, true, JSON.stringify(plan.blockingIssues))
  assert.deepEqual(plan.unknownTopLevelKeys, ['futureTopLevel'])
  assert.ok(plan.ignored.some((entry) => entry.path === 'pins.pin00.futureField'))
  assert.ok(plan.ignored.some((entry) => entry.path === 'pins.pin99' && entry.reason === 'unknown-pin'))
})

test('forbidden prototype keys are rejected at parse time', () => {
  assert.throws(() => parseGp2040Backup('{"pins":{"__proto__":{"action":1}}}'), SettingsBackupError)
  assert.throws(() => parseGp2040Backup('{"keyboard":{"constructor":{"key":1}}}'), SettingsBackupError)
})

test('oversized, invalid, and empty files are rejected at parse time', () => {
  assert.throws(() => parseGp2040Backup('{"keyboard":{"Up":4}}', { maxBytes: 5 }), /larger/)
  assert.throws(() => parseGp2040Backup('not json'), /not valid JSON/)
  assert.throws(() => parseGp2040Backup('[]'), /JSON object/)
  assert.throws(() => parseGp2040Backup('{"display":{}}'), /no settings/)
  assert.throws(() => parseGp2040Backup('{"pins":[]}'), /pins must be a JSON object/)
})

test('a Configurator file for a different board blocks the plan', () => {
  const plan = planFrom(backupText(), { device: { boardConfig: 'OtherBoard', firmware: '1.0.0' } })
  assert.equal(plan.ok, false)
  assert.ok(plan.blockingIssues.some((issue) => issue.code === 'board-mismatch'))
})

test('invalid values block the plan with a path', () => {
  const badAction = planFrom(JSON.stringify({ heTrigger: { triggers: [{ action: 999 }] } }))
  assert.equal(badAction.ok, false)
  assert.equal(badAction.blockingIssues[0].code, 'invalid-value')

  const badAdc = planFrom(JSON.stringify({ heTrigger: { triggers: [{ pressed: 5000 }] } }))
  assert.equal(badAdc.ok, false)

  const badKey = planFrom(JSON.stringify({ keyboard: { Up: 300 } }))
  assert.equal(badKey.ok, false)

  const badLabel = planFrom(JSON.stringify({ pins: { pin00: { profileLabel: 3 } } }))
  assert.equal(badLabel.ok, false)
})

test('a RESERVED or ASSIGNED_TO_ADDON pin cannot be changed by restore', () => {
  const snapshot = makeSnapshot()
  snapshot.pinMappings.pin10.action = -5
  const plan = planFrom(JSON.stringify({ pins: { pin10: { action: gpioActionValues.B4 } } }), { snapshot })
  assert.equal(plan.ok, false)
  assert.ok(plan.blockingIssues.some((issue) => issue.path === 'pins.pin10'))

  const addon = makeSnapshot()
  addon.pinMappings.pin11.action = 0
  const addonPlan = planFrom(JSON.stringify({ pins: { pin11: { action: gpioActionValues.B4 } } }), { snapshot: addon })
  assert.equal(addonPlan.ok, false)
})

test('an unsupported GPIO action in the file is rejected', () => {
  const plan = planFrom(JSON.stringify({ pins: { pin00: { action: 12345 } } }))
  assert.equal(plan.ok, false)
})

test('merged result is validated: Hall idle equal to pressed with an active action is blocked', () => {
  const plan = planFrom(JSON.stringify({ heTrigger: { triggers: [{ idle: 3000, pressed: 3000 }] } }))
  assert.equal(plan.ok, false)
  assert.ok(plan.blockingIssues.some((issue) => issue.code === 'merged-diagnostic'))
})

test('changing the Fn pin is reported and the expected fnButtonPin follows the GPIO mapping', () => {
  const text = JSON.stringify({ pins: { pin05: { action: gpioActionValues.B1 }, pin02: { action: gpioActionValues.FN } } })
  const plan = planFrom(text)
  assert.equal(plan.ok, true, JSON.stringify(plan.blockingIssues))
  assert.equal(plan.fnButtonPin.before, 5)
  assert.equal(plan.fnButtonPin.after, 2)
  assert.equal(plan.fnButtonPin.changed, true)
  assert.equal(plan.expected.gamepadOptions.fnButtonPin, 2)
})

test('gamepad fnButtonPin in the file is ignored as derived', () => {
  const plan = planFrom(JSON.stringify({ gamepad: { fnButtonPin: 1, debounceDelay: 7 } }))
  assert.equal(plan.ok, true, JSON.stringify(plan.blockingIssues))
  assert.ok(plan.ignored.some((entry) => entry.path === 'gamepad.fnButtonPin' && entry.reason === 'derived'))
  assert.equal(plan.expected.gamepadOptions.debounceDelay, 7)
  assert.equal(plan.expected.gamepadOptions.fnButtonPin, 5)
})

test('hotkey objects merge per field and keep unspecified fields', () => {
  const plan = planFrom(JSON.stringify({ gamepad: { hotkey03: { action: 44 } } }))
  assert.equal(plan.ok, true, JSON.stringify(plan.blockingIssues))
  assert.deepEqual(plan.expected.gamepadOptions.hotkey03, { auxMask: 0, buttonsMask: 0, action: 44 })
})

test('an invalid gamepad field type blocks the plan', () => {
  const plan = planFrom(JSON.stringify({ gamepad: { debounceDelay: 'fast' } }))
  assert.equal(plan.ok, false)
})

test('Hall bool-like fields keep the firmware type of the current value', () => {
  const plan = planFrom(JSON.stringify({ heTrigger: { triggers: [{ rapidTrigger: true, is_polarized: true }] } }))
  assert.equal(plan.ok, true, JSON.stringify(plan.blockingIssues))
  assert.equal(plan.expected.hallCalibrations.triggers[0].rapidTrigger, 1)
  assert.equal(plan.expected.hallCalibrations.triggers[0].is_polarized, 1)
})

function fakeDevice(initial) {
  const state = {
    pinMappings: clone(initial.pinMappings),
    triggers: clone(initial.hallCalibrations.triggers),
    keyMappings: clone(initial.keyMappings),
    options: clone(initial.gamepadOptions),
    posts: [],
  }
  const derivedOptions = () => {
    const fnPin = Object.entries(state.pinMappings).find(([, entry]) => entry.action === gpioActionValues.FN)
    return { ...state.options, fnButtonPin: fnPin ? Number(fnPin[0].slice(3)) : -1 }
  }
  const readSnapshot = async () => ({
    pinMappings: clone(state.pinMappings),
    hallCalibrations: { triggers: clone(state.triggers) },
    keyMappings: clone(state.keyMappings),
    gamepadOptions: derivedOptions(),
  })
  const request = async (path, init = {}) => {
    if (init.method === 'POST') state.posts.push(path)
    switch (path) {
      case '/api/getPinMappings': return clone(state.pinMappings)
      case '/api/setPinMappings': state.pinMappings = JSON.parse(init.body); return {}
      case '/api/getHETriggerCalibrations': return { triggers: clone(state.triggers) }
      case '/api/setHETriggerCalibrations': state.triggers = JSON.parse(init.body).triggers; return {}
      case '/api/getKeyMappings': return clone(state.keyMappings)
      case '/api/setKeyMappings': state.keyMappings = JSON.parse(init.body); return {}
      case '/api/getGamepadOptions': return derivedOptions()
      case '/api/setGamepadOptions': {
        const { fnButtonPin, ...rest } = JSON.parse(init.body)
        state.options = rest
        return {}
      }
      default: throw new Error(`unexpected path ${path}`)
    }
  }
  return { state, readSnapshot, request }
}

test('commit applies groups in order and confirms each by readback', async () => {
  const snapshot = makeSnapshot()
  const plan = planFrom(JSON.stringify({
    pins: { pin00: { action: gpioActionValues.A2 } },
    heTrigger: { triggers: [{ pressed: 3100 }] },
    keyboard: { Up: 40 },
    gamepad: { debounceDelay: 9 },
  }), { snapshot })
  assert.equal(plan.ok, true, JSON.stringify(plan.blockingIssues))
  const device = fakeDevice(snapshot)
  const result = await commitRestorePlan({ plan, baseline: snapshot, request: device.request, readSnapshot: device.readSnapshot })
  assert.deepEqual(device.state.posts, ['/api/setPinMappings', '/api/setHETriggerCalibrations', '/api/setKeyMappings', '/api/setGamepadOptions'])
  assert.deepEqual(result.appliedGroups, ['gpio', 'hall', 'keyboard', 'options'])
  assert.equal(device.state.triggers[0].pressed, 3100)
  assert.equal(device.state.keyMappings.Up, 40)
  assert.equal(device.state.options.debounceDelay, 9)
})

test('commit refuses a blocked plan without sending anything', async () => {
  const snapshot = makeSnapshot()
  const plan = planFrom(JSON.stringify({ keyboard: { Up: 300 } }), { snapshot })
  const device = fakeDevice(snapshot)
  await assert.rejects(
    commitRestorePlan({ plan, baseline: snapshot, request: device.request, readSnapshot: device.readSnapshot }),
    ConfigPersistenceError,
  )
  assert.deepEqual(device.state.posts, [])
})

test('commit stops on a freshness mismatch before any write', async () => {
  const snapshot = makeSnapshot()
  const plan = planFrom(JSON.stringify({ keyboard: { Up: 40 } }), { snapshot })
  const device = fakeDevice(snapshot)
  device.state.keyMappings.Up = 77
  await assert.rejects(
    commitRestorePlan({ plan, baseline: snapshot, request: device.request, readSnapshot: device.readSnapshot }),
    (error) => error instanceof ConfigPersistenceError && error.appliedGroups.length === 0,
  )
  assert.deepEqual(device.state.posts, [])
})

test('a failed Hall POST is reported with the applied groups and is not retried', async () => {
  const snapshot = makeSnapshot()
  const plan = planFrom(JSON.stringify({
    pins: { pin00: { action: gpioActionValues.A2 } },
    heTrigger: { triggers: [{ pressed: 3100 }] },
  }), { snapshot })
  const device = fakeDevice(snapshot)
  const baseRequest = device.request
  const request = async (path, init) => {
    if (path === '/api/setHETriggerCalibrations') {
      device.state.posts.push(path)
      throw new Error('network error')
    }
    return baseRequest(path, init)
  }
  await assert.rejects(
    commitRestorePlan({ plan, baseline: snapshot, request, readSnapshot: device.readSnapshot }),
    (error) => error instanceof ConfigPersistenceError
      && error.stage === 'hall'
      && error.uncertainGroup === 'hall'
      && error.appliedGroups.length === 1
      && error.appliedGroups[0].startsWith('gpio'),
  )
  assert.equal(device.state.posts.filter((path) => path === '/api/setHETriggerCalibrations').length, 1)
  assert.deepEqual(device.state.posts, ['/api/setPinMappings', '/api/setHETriggerCalibrations'])
})

test('a readback mismatch after a POST is reported as uncertain for that group', async () => {
  const snapshot = makeSnapshot()
  const plan = planFrom(JSON.stringify({ keyboard: { Up: 40 } }), { snapshot })
  const device = fakeDevice(snapshot)
  const baseRequest = device.request
  const request = async (path, init) => {
    if (path === '/api/setKeyMappings') {
      await baseRequest(path, init)
      device.state.keyMappings.Up = 5
      return {}
    }
    return baseRequest(path, init)
  }
  await assert.rejects(
    commitRestorePlan({ plan, baseline: snapshot, request, readSnapshot: device.readSnapshot }),
    (error) => error instanceof ConfigPersistenceError
      && error.stage === 'keyboard'
      && error.uncertainGroup === 'keyboard'
      && error.appliedGroups.length === 0,
  )
})

test('a derived Fn pin mismatch after a verified GPIO write keeps gpio in appliedGroups', async () => {
  const snapshot = makeSnapshot()
  const plan = planFrom(JSON.stringify({
    pins: { pin00: { action: gpioActionValues.A2 } },
    keyboard: { Up: 40 },
  }), { snapshot })
  assert.equal(plan.ok, true, JSON.stringify(plan.blockingIssues))
  const device = fakeDevice(snapshot)
  const baseRequest = device.request
  const request = async (path, init) => {
    const response = await baseRequest(path, init)
    if (path === '/api/getGamepadOptions') return { ...response, fnButtonPin: 99 }
    return response
  }
  await assert.rejects(
    commitRestorePlan({ plan, baseline: snapshot, request, readSnapshot: device.readSnapshot }),
    (error) => error instanceof ConfigPersistenceError
      && error.stage === 'gpio-derived-fn'
      && error.uncertainGroup === 'derived Fn pin'
      && error.appliedGroups.length === 1
      && error.appliedGroups[0] === 'gpio',
  )
  assert.deepEqual(device.state.posts, ['/api/setPinMappings'])
})
