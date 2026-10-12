import { findDeviceSnapshotIssues } from './deviceSnapshotValidation.mjs'

const gpioPins = Array.from({ length: 6 }, (_, pin) => `gp${pin}`)
const hallChannels = Array.from({ length: 16 }, (_, channel) => `ch${channel}`)

const clone = (value) => structuredClone(value)
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

export function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson)
  if (!isRecord(value)) return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]))
}

export function snapshotsEqual(left, right) {
  return JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right))
}

export function snapshotDiffPaths(actual, expected, prefix = '') {
  if (snapshotsEqual(actual, expected)) return []
  if (Array.isArray(actual) && Array.isArray(expected)) {
    const paths = []
    for (let index = 0; index < Math.max(actual.length, expected.length); index += 1) {
      paths.push(...snapshotDiffPaths(actual[index], expected[index], `${prefix}[${index}]`))
    }
    return paths.length ? paths : [prefix || '$']
  }
  if (isRecord(actual) && isRecord(expected)) {
    const paths = []
    for (const key of [...new Set([...Object.keys(actual), ...Object.keys(expected)])].sort()) {
      paths.push(...snapshotDiffPaths(actual[key], expected[key], prefix ? `${prefix}.${key}` : key))
    }
    return paths.length ? paths : [prefix || '$']
  }
  return [prefix || '$']
}

export function deriveFnButtonPin(pinMappings, fnActionValue) {
  let fnButtonPin = -1
  for (let pin = 0; pin < 30; pin += 1) {
    if (Number(pinMappings?.[`pin${String(pin).padStart(2, '0')}`]?.action) === fnActionValue) {
      fnButtonPin = pin
    }
  }
  return fnButtonPin
}

const inputOptionFields = [
  ['inputMode', 'inputMode', Number],
  ['inputDeviceType', 'inputDeviceType', Number],
  ['ps4AuthType', 'ps4AuthType', Number],
  ['ps5AuthType', 'ps5AuthType', Number],
  ['xinputAuthType', 'xinputAuthType', Number],
  ['ps4ControllerIDMode', 'ps4ControllerIDMode', Number],
  ['switchTpShareForDs4', 'switchTpShareForDs4', (value) => value ? 1 : 0],
  ['usbDescOverride', 'usbDescOverride', (value) => value ? 1 : 0],
  ['usbDescProduct', 'usbDescProduct', String],
  ['usbDescManufacturer', 'usbDescManufacturer', String],
  ['usbDescVersion', 'usbDescVersion', String],
  ['usbOverrideID', 'usbOverrideID', (value) => value ? 1 : 0],
  ['usbVendorID', 'usbVendorID', String],
  ['usbProductID', 'usbProductID', String],
]
const inputOptionDefaults = {
  inputMode: 0,
  inputDeviceType: 0,
  ps4AuthType: 0,
  ps5AuthType: 0,
  xinputAuthType: 0,
  ps4ControllerIDMode: 0,
  switchTpShareForDs4: false,
  usbDescOverride: false,
  usbDescProduct: '',
  usbDescManufacturer: '',
  usbDescVersion: '',
  usbOverrideID: false,
  usbVendorID: '0000',
  usbProductID: '0000',
}

const requiredGamepadOptionKeys = [
  'dpadMode', 'inputMode', 'inputDeviceType', 'socdMode', 'switchTpShareForDs4',
  'lockHotkeys', 'fourWayMode', 'profileNumber', 'debounceDelay',
  'inputModeB1', 'inputModeB2', 'inputModeB3', 'inputModeB4',
  'inputModeL1', 'inputModeL2', 'inputModeR1', 'inputModeR2',
  'ps4AuthType', 'ps5AuthType', 'xinputAuthType', 'ps4ControllerIDMode',
  'usbDescOverride', 'usbDescManufacturer', 'usbDescProduct', 'usbDescVersion',
  'usbOverrideID', 'usbVendorID', 'usbProductID', 'miniMenuGamepadInput',
  'fnButtonPin', 'forcedSetupMode',
  ...Array.from({ length: 16 }, (_, index) => `hotkey${String(index + 1).padStart(2, '0')}`),
]

const rawRatio = (value, idle, pressed) => Math.max(0, Math.min(1, Math.abs(value - idle) / Math.max(1, Math.abs(pressed - idle))))
const ratioRaw = (ratio, idle, pressed) => Math.round(idle + Math.max(0, Math.min(1, ratio)) * (pressed - idle))
const readJsonBoolean = (value) => value === true || value === 1 || value === '1'
const asObject = (value, label) => {
  if (!isRecord(value)) throw new Error(`Invalid ${label} snapshot: expected a JSON object`)
  return value
}

function assertCompleteGamepadOptions(snapshot) {
  asObject(snapshot, 'gamepad options')
  for (const key of requiredGamepadOptionKeys) {
    if (!Object.hasOwn(snapshot, key)) throw new Error(`Gamepad options snapshot is missing ${key}`)
  }
  const numericKeys = requiredGamepadOptionKeys.filter((key) =>
    key !== 'usbDescManufacturer' && key !== 'usbDescProduct' && key !== 'usbDescVersion' &&
    key !== 'usbVendorID' && key !== 'usbProductID' && !key.startsWith('hotkey'))
  for (const key of numericKeys) {
    if (typeof snapshot[key] !== 'number' || !Number.isInteger(snapshot[key])) {
      throw new Error(`Gamepad options snapshot has an invalid ${key}`)
    }
  }
  for (const key of ['usbDescManufacturer', 'usbDescProduct', 'usbDescVersion', 'usbVendorID', 'usbProductID']) {
    if (typeof snapshot[key] !== 'string') throw new Error(`Gamepad options snapshot has an invalid ${key}`)
  }
  for (let index = 1; index <= 16; index += 1) {
    const key = `hotkey${String(index).padStart(2, '0')}`
    const hotkey = asObject(snapshot[key], key)
    for (const field of ['auxMask', 'buttonsMask', 'action']) {
      if (!Object.hasOwn(hotkey, field) || typeof hotkey[field] !== 'number' || !Number.isInteger(hotkey[field])) {
        throw new Error(`Gamepad options snapshot is missing ${key}.${field}`)
      }
    }
  }
}

export function buildGamepadOptionsPayload(currentOptions, patch) {
  assertCompleteGamepadOptions(currentOptions)
  asObject(patch, 'gamepad options patch')

  const payload = clone(currentOptions)
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'fnButtonPin' || !Object.hasOwn(currentOptions, key)) {
      throw new Error(`Gamepad options patch contains unsupported field ${key}`)
    }
    payload[key] = clone(value)
  }
  delete payload.fnButtonPin

  for (const [key, value] of Object.entries(currentOptions)) {
    if (key === 'fnButtonPin' || Object.hasOwn(patch, key)) continue
    if (!snapshotsEqual(payload[key], value)) throw new Error(`Gamepad options payload would alter untouched field ${key}`)
  }
  for (const key of Object.keys(currentOptions)) {
    if (key !== 'fnButtonPin' && !Object.hasOwn(payload, key)) {
      throw new Error(`Gamepad options payload is missing ${key}`)
    }
  }
  return payload
}

/**
 * Build a minimal write plan from an unchanged raw device snapshot and the UI draft.
 * No request is issued here, so the plan can be validated in isolated unit tests.
 */
export function buildConfigWritePlan({ config, baseline, gpioActionValues }) {
  asObject(baseline, 'device')
  const snapshotIssues = findDeviceSnapshotIssues(baseline, new Set(Object.values(gpioActionValues)))
  if (snapshotIssues.length > 0) throw new Error(`Device settings are invalid: ${snapshotIssues.join(' ')}`)
  const pinMappings = clone(asObject(baseline.pinMappings, 'GPIO'))
  const hallCalibrations = clone(asObject(baseline.hallCalibrations, 'Hall'))
  const keyMappings = clone(asObject(baseline.keyMappings, 'keyboard'))
  const gamepadOptions = clone(asObject(baseline.gamepadOptions, 'gamepad options'))
  if (!Array.isArray(hallCalibrations.triggers) || hallCalibrations.triggers.length < 16) {
    throw new Error('Invalid Hall snapshot: expected at least 16 trigger entries')
  }

  const changes = { gpio: [], hall: [], keyboard: [], options: [] }
  const expected = clone(baseline)

  for (const pinName of gpioPins) {
    const pin = Number(pinName.slice(2))
    const apiPin = `pin${String(pin).padStart(2, '0')}`
    const current = asObject(pinMappings[apiPin], `GPIO ${apiPin}`)
    const action = gpioActionValues[config.gpioMappings[pinName]]
    if (action === undefined) throw new Error(`Unsupported GPIO assignment: ${config.gpioMappings[pinName]}`)
    if (Number(current.action) !== action) {
      current.action = action
      changes.gpio.push(pinName)
    }
  }
  expected.pinMappings = pinMappings

  for (const channelName of hallChannels) {
    const channel = Number(channelName.slice(2))
    const trigger = asObject(hallCalibrations.triggers[channel], `Hall ${channelName}`)
    const setting = config.hall[channelName]
    const action = gpioActionValues[config.hallMappings[channelName]]
    if (action === undefined) throw new Error(`Unsupported Hall assignment: ${config.hallMappings[channelName]}`)
    if (Number(trigger.action) !== action) {
      trigger.action = action
      changes.hall.push(`${channelName}.action`)
    }

    // Compare the draft to the exact value decoded from this baseline. An untouched
    // ratio must not be quantized back into a different ADC count.
    const originalPress = rawRatio(Number(trigger.active), Number(trigger.idle), Number(trigger.pressed))
    if (setting.pressRatio !== originalPress) {
      trigger.active = ratioRaw(setting.pressRatio, Number(trigger.idle), Number(trigger.pressed))
      changes.hall.push(`${channelName}.active`)
    }

    const originalRelease = rawRatio(Number(trigger.release), Number(trigger.idle), Number(trigger.pressed))
    if (setting.releaseRatio !== originalRelease) {
      trigger.release = ratioRaw(setting.releaseRatio, Number(trigger.idle), Number(trigger.pressed))
      changes.hall.push(`${channelName}.release`)
    }

    if (Number(trigger.noise) !== Number(setting.noise)) {
      trigger.noise = setting.noise
      changes.hall.push(`${channelName}.noise`)
    }
    if (readJsonBoolean(trigger.rapidTrigger) !== Boolean(setting.rapidTrigger)) {
      trigger.rapidTrigger = setting.rapidTrigger ? 1 : 0
      changes.hall.push(`${channelName}.rapidTrigger`)
    }
  }
  expected.hallCalibrations = hallCalibrations

  for (const [action, key] of Object.entries(config.keyboardMappings)) {
    if (!Object.hasOwn(keyMappings, action)) throw new Error(`Keyboard snapshot is missing ${action}`)
    if (Number(keyMappings[action]) !== Number(key)) {
      keyMappings[action] = key
      changes.keyboard.push(action)
    }
  }
  expected.keyMappings = keyMappings

  for (const [configKey, optionKey, convert] of inputOptionFields) {
    if (!Object.hasOwn(config.inputMode, configKey)) continue
    const current = Object.hasOwn(gamepadOptions, optionKey) ? gamepadOptions[optionKey] : inputOptionDefaults[configKey]
    const wanted = convert(config.inputMode[configKey])
    const actual = typeof config.inputMode[configKey] === 'boolean'
      ? readJsonBoolean(current)
      : typeof config.inputMode[configKey] === 'string'
        ? String(current ?? '')
        : Number(current ?? 0)
    const normalizedWanted = typeof config.inputMode[configKey] === 'boolean'
      ? Boolean(config.inputMode[configKey])
      : typeof config.inputMode[configKey] === 'string'
        ? String(config.inputMode[configKey])
        : wanted
    if (actual !== normalizedWanted) {
      gamepadOptions[optionKey] = wanted
      changes.options.push(optionKey)
    }
  }

  // fnButtonPin is a firmware-derived read-only value, not an independently writable option.
  const originalFnButtonPin = deriveFnButtonPin(baseline.pinMappings, gpioActionValues.FN)
  const reportedFnButtonPin = Number(baseline.gamepadOptions.fnButtonPin)
  if (!Number.isInteger(reportedFnButtonPin) || reportedFnButtonPin !== originalFnButtonPin) {
    throw new Error(`Inconsistent Fn pin state: firmware reports ${baseline.gamepadOptions.fnButtonPin}, GPIO mappings imply ${originalFnButtonPin}`)
  }
  const expectedFnButtonPin = deriveFnButtonPin(pinMappings, gpioActionValues.FN)
  expected.gamepadOptions = gamepadOptions
  expected.gamepadOptions.fnButtonPin = expectedFnButtonPin

  const gpioChanged = changes.gpio.length > 0
  const optionsChanged = changes.options.length > 0
  const writes = {
    gpio: gpioChanged ? { payload: pinMappings, expected: expected.pinMappings } : null,
    hall: changes.hall.length > 0 ? { payload: { triggers: hallCalibrations.triggers }, expected: expected.hallCalibrations } : null,
    keyboard: changes.keyboard.length > 0 ? { payload: keyMappings, expected: expected.keyMappings } : null,
    options: optionsChanged
      ? { payload: Object.fromEntries(changes.options.map((key) => [key, gamepadOptions[key]])), expected: expected.gamepadOptions }
      : null,
  }

  return {
    changes,
    expected,
    writes,
    fnButtonPin: {
      before: originalFnButtonPin,
      after: expectedFnButtonPin,
      changed: originalFnButtonPin !== expectedFnButtonPin,
    },
  }
}

export function assertSnapshotEqual(actual, expected, label) {
  if (!snapshotsEqual(actual, expected)) {
    const paths = snapshotDiffPaths(actual, expected)
    const summary = paths.slice(0, 12).join(', ')
    const omitted = paths.length > 12 ? ` (+${paths.length - 12} more)` : ''
    throw new Error(`${label} readback differs at: ${summary}${omitted}`)
  }
}

function assertHallDisplayMatches(config, snapshot, changedFields) {
  for (const field of changedFields) {
    const match = field.match(/^(ch\d+)\.(active|release)$/)
    if (!match) continue
    const [, channel, settingKey] = match
    const trigger = snapshot.triggers[Number(channel.slice(2))]
    const rawKey = settingKey === 'active' ? 'active' : 'release'
    const actualRaw = Number(trigger[rawKey])
    const intendedRatio = config.hall[channel][settingKey === 'active' ? 'pressRatio' : 'releaseRatio']
    const intendedRaw = ratioRaw(Number(intendedRatio), Number(trigger.idle), Number(trigger.pressed))
    if (actualRaw !== intendedRaw) {
      throw new Error(`${channel}.${settingKey} readback is ${actualRaw} instead of ${intendedRaw}`)
    }
  }
}

export class ConfigPersistenceError extends Error {
  constructor(message, { appliedGroups = [], uncertainGroup = null, stage = 'unknown' } = {}) {
    super(message)
    this.name = 'ConfigPersistenceError'
    this.appliedGroups = appliedGroups
    this.uncertainGroup = uncertainGroup
    this.stage = stage
  }
}

/** Run the multi-endpoint save against an injected request/readback boundary. */
export async function commitConfigSnapshot({ config, baseline, gpioActionValues, request, readSnapshot }) {
  const appliedGroups = []
  let uncertainGroup = null
  let stage = 'preflight'
  try {
    assertSnapshotEqual(await readSnapshot(), baseline, 'Pre-save freshness')
    const plan = buildConfigWritePlan({ config, baseline, gpioActionValues })
    const writes = plan.writes

    if (writes.gpio) {
      stage = 'gpio'
      assertSnapshotEqual(await request('/api/getPinMappings'), baseline.pinMappings, 'GPIO pre-write freshness')
      uncertainGroup = 'gpio'
      await request('/api/setPinMappings', { method: 'POST', body: JSON.stringify(writes.gpio.payload) })
      assertSnapshotEqual(await request('/api/getPinMappings'), writes.gpio.expected, 'GPIO')
      const optionsAfterGpio = await request('/api/getGamepadOptions')
      const expectedOptions = { ...baseline.gamepadOptions, fnButtonPin: plan.fnButtonPin.after }
      assertSnapshotEqual(optionsAfterGpio, expectedOptions, 'Fn-derived gamepad options')
      appliedGroups.push(plan.fnButtonPin.changed ? 'gpio (including derived Fn pin)' : 'gpio')
      uncertainGroup = null
    }

    if (writes.hall) {
      stage = 'hall'
      assertSnapshotEqual(await request('/api/getHETriggerCalibrations'), baseline.hallCalibrations, 'Hall pre-write freshness')
      uncertainGroup = 'hall'
      await request('/api/setHETriggerCalibrations', { method: 'POST', body: JSON.stringify(writes.hall.payload) })
      const hallReadback = await request('/api/getHETriggerCalibrations')
      assertSnapshotEqual(hallReadback, writes.hall.expected, 'Hall')
      assertHallDisplayMatches(config, hallReadback, plan.changes.hall)
      appliedGroups.push('hall')
      uncertainGroup = null
    }

    if (writes.keyboard) {
      stage = 'keyboard'
      assertSnapshotEqual(await request('/api/getKeyMappings'), baseline.keyMappings, 'Keyboard pre-write freshness')
      uncertainGroup = 'keyboard'
      await request('/api/setKeyMappings', { method: 'POST', body: JSON.stringify(writes.keyboard.payload) })
      assertSnapshotEqual(await request('/api/getKeyMappings'), writes.keyboard.expected, 'Keyboard')
      appliedGroups.push('keyboard')
      uncertainGroup = null
    }

    if (writes.options) {
      stage = 'options'
      const expectedBeforeWrite = { ...baseline.gamepadOptions, fnButtonPin: plan.fnButtonPin.after }
      const latestOptions = await request('/api/getGamepadOptions')
      assertSnapshotEqual(latestOptions, expectedBeforeWrite, 'Gamepad options pre-write freshness')
      const payload = buildGamepadOptionsPayload(latestOptions, writes.options.payload)
      uncertainGroup = 'options'
      await request('/api/setGamepadOptions', { method: 'POST', body: JSON.stringify(payload) })
      assertSnapshotEqual(await request('/api/getGamepadOptions'), writes.options.expected, 'Gamepad options')
      appliedGroups.push('options')
      uncertainGroup = null
    }

    stage = 'final-readback'
    const confirmed = await readSnapshot()
    assertSnapshotEqual(confirmed, plan.expected, 'Final configuration')
    return { snapshot: confirmed, plan }
  } catch (error) {
    if (error instanceof ConfigPersistenceError) throw error
    throw new ConfigPersistenceError(error instanceof Error ? error.message : String(error), { appliedGroups, uncertainGroup, stage })
  }
}
