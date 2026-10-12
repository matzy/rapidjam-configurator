import {
  ConfigPersistenceError,
  assertSnapshotEqual,
  buildGamepadOptionsPayload,
  deriveFnButtonPin,
  snapshotDiffPaths,
  snapshotsEqual,
} from './configPersistence.mjs'
import { findDeviceSnapshotDiagnostics } from './deviceSnapshotValidation.mjs'

export const BACKUP_FORMAT_VERSION = 1
export const EXTENSION_KEY = 'rapidjamConfigurator'
export const MAX_BACKUP_BYTES = 512 * 1024
export const RESTORE_GROUP_KEYS = ['pins', 'heTrigger', 'gamepad', 'keyboard']

// WebConfig-only groups. They are not restored here; the preview tells the user to use WebConfig.
const WEBCONFIG_ONLY_KEYS = ['display', 'splash', 'led', 'ledTheme', 'macros', 'profiles', 'addons']
const RESERVED_PIN_ACTION = -5
const ASSIGNED_TO_ADDON_PIN_ACTION = 0
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const PIN_KEY = /^pin\d{2}$/
const HOTKEY_KEY = /^hotkey\d{2}$/
const STROKE_KEY = /^[a-z0-9]+$/
const PIN_NUMERIC_FIELDS = ['action', 'customButtonMask', 'customDpadMask']
const HOTKEY_FIELDS = ['auxMask', 'buttonsMask', 'action']
const HALL_NUMERIC_FIELDS = ['idle', 'active', 'pressed', 'release', 'noise']
const HALL_BOOLEAN_FIELDS = ['is_polarized', 'rapidTrigger']
const KEYBOARD_KEY_MAX = 255
const ADC_MAX = 4095
const UINT32_MAX = 0xffffffff
const MAX_NESTING_DEPTH = 8

export class SettingsBackupError extends Error {
  constructor(message, path = '') {
    super(message)
    this.name = 'SettingsBackupError'
    this.path = path
  }
}

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isBoolLike = (value) => typeof value === 'boolean' || value === 0 || value === 1
const boolFromLike = (value) => value === true || value === 1
// Keep the raw type the firmware uses for the field so that readback compares equal.
const likeBase = (base, value) => (typeof base === 'boolean' ? value : (value ? 1 : 0))
const isInRange = (value, min, max) => Number.isInteger(value) && value >= min && value <= max
const join = (path, key) => (path ? `${path}.${key}` : key)

function assertNoForbiddenKeys(value, path, depth = 0) {
  if (depth > MAX_NESTING_DEPTH) throw new SettingsBackupError('Backup file is nested too deeply.', path)
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenKeys(item, `${path}[${index}]`, depth + 1))
    return
  }
  if (!isRecord(value)) return
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEYS.has(key)) throw new SettingsBackupError(`Backup file contains a forbidden key: ${key}`, join(path, key))
    assertNoForbiddenKeys(value[key], join(path, key), depth + 1)
  }
}

/**
 * Convert a raw device snapshot into a WebConfig-compatible `.gp2040` object.
 * `keyboard` uses WebConfig's `{ pin, key, error }` shape; the extension key is ignored by WebConfig.
 */
export function createGp2040Backup({ snapshot, device, configuratorVersion, createdAt, strokeOverrides = {}, strokeKey = null }) {
  if (!isRecord(snapshot.keyMappings)) throw new SettingsBackupError('Keyboard snapshot is missing.', 'keyboard')
  const keyboard = Object.fromEntries(
    Object.entries(snapshot.keyMappings).map(([name, key]) => [name, { pin: -1, key, error: null }]),
  )
  const ownOverride = strokeKey !== null && Object.hasOwn(strokeOverrides, strokeKey)
    ? { [strokeKey]: strokeOverrides[strokeKey] }
    : {}
  return {
    pins: structuredClone(snapshot.pinMappings),
    heTrigger: structuredClone(snapshot.hallCalibrations),
    gamepad: structuredClone(snapshot.gamepadOptions),
    keyboard,
    [EXTENSION_KEY]: {
      formatVersion: BACKUP_FORMAT_VERSION,
      createdAt,
      configuratorVersion,
      device: {
        boardConfig: device?.boardConfig ?? null,
        firmware: device?.firmware ?? null,
      },
      strokeOverrides: ownOverride,
    },
  }
}

export function serializeGp2040Backup(backup) {
  return `${JSON.stringify(backup, null, 2)}\n`
}

function parseExtension(value) {
  if (value === undefined) return { extension: null, warnings: [] }
  if (!isRecord(value)) throw new SettingsBackupError(`${EXTENSION_KEY} must be a JSON object.`, EXTENSION_KEY)
  const version = value.formatVersion
  if (!Number.isInteger(version) || version < 1) {
    throw new SettingsBackupError(`${EXTENSION_KEY}.formatVersion must be a positive integer.`, `${EXTENSION_KEY}.formatVersion`)
  }
  if (version > BACKUP_FORMAT_VERSION) {
    return {
      extension: null,
      warnings: [{ code: 'newer-format', message: `The Configurator section uses format version ${version}, which this version does not understand. It was ignored; the device groups are still restored.` }],
    }
  }

  const device = value.device ?? {}
  if (!isRecord(device)) throw new SettingsBackupError(`${EXTENSION_KEY}.device must be a JSON object.`, `${EXTENSION_KEY}.device`)
  if (device.boardConfig !== undefined && device.boardConfig !== null && typeof device.boardConfig !== 'string') {
    throw new SettingsBackupError(`${EXTENSION_KEY}.device.boardConfig must be a string.`, `${EXTENSION_KEY}.device.boardConfig`)
  }

  const strokeOverrides = value.strokeOverrides ?? {}
  if (!isRecord(strokeOverrides)) throw new SettingsBackupError(`${EXTENSION_KEY}.strokeOverrides must be a JSON object.`, `${EXTENSION_KEY}.strokeOverrides`)
  for (const [key, stroke] of Object.entries(strokeOverrides)) {
    const path = `${EXTENSION_KEY}.strokeOverrides.${key}`
    if (!STROKE_KEY.test(key)) throw new SettingsBackupError('Stroke override key has an invalid format.', path)
    if (typeof stroke !== 'number' || !Number.isFinite(stroke)) throw new SettingsBackupError('Stroke override must be a finite number.', path)
  }

  return {
    extension: {
      formatVersion: version,
      boardConfig: typeof device.boardConfig === 'string' ? device.boardConfig : null,
      firmware: typeof device.firmware === 'string' ? device.firmware : null,
      strokeOverrides: structuredClone(strokeOverrides),
    },
    warnings: [],
  }
}

/**
 * Parse and structurally validate a backup file. No device access happens here.
 * Throws SettingsBackupError for anything that cannot be interpreted safely.
 */
export function parseGp2040Backup(text, { maxBytes = MAX_BACKUP_BYTES } = {}) {
  if (typeof text !== 'string') throw new SettingsBackupError('Backup file must be text.')
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new SettingsBackupError(`Backup file is larger than ${maxBytes} bytes.`)
  }

  let root
  try {
    root = JSON.parse(text)
  } catch (error) {
    throw new SettingsBackupError(`Backup file is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!isRecord(root)) throw new SettingsBackupError('Backup file must contain a JSON object.')
  assertNoForbiddenKeys(root, '')

  const groups = {}
  for (const key of RESTORE_GROUP_KEYS) {
    if (!Object.hasOwn(root, key)) continue
    if (!isRecord(root[key])) throw new SettingsBackupError(`${key} must be a JSON object.`, key)
    groups[key] = root[key]
  }

  const { extension, warnings } = parseExtension(root[EXTENSION_KEY])
  if (Object.keys(groups).length === 0 && !extension?.strokeOverrides) {
    throw new SettingsBackupError('The file contains no settings that can be restored.')
  }

  const ignoredTopLevelKeys = []
  const unknownTopLevelKeys = []
  for (const key of Object.keys(root)) {
    if (RESTORE_GROUP_KEYS.includes(key) || key === EXTENSION_KEY) continue
    if (WEBCONFIG_ONLY_KEYS.includes(key)) ignoredTopLevelKeys.push(key)
    else unknownTopLevelKeys.push(key)
  }

  return { groups, extension, warnings, ignoredTopLevelKeys, unknownTopLevelKeys }
}

const isSpecialPinAction = (action) => action === RESERVED_PIN_ACTION || action === ASSIGNED_TO_ADDON_PIN_ACTION

/**
 * Merge the file over the current raw snapshot (missing fields keep the current value, unknown fields are ignored)
 * and validate the merged result. Pure: no device access.
 */
export function buildRestorePlan({
  parsed,
  baseline,
  device,
  gpioActionValues,
  currentStrokeOverrides = {},
  deviceStrokeKey = null,
  strokeLimits = null,
}) {
  const blockingIssues = []
  const warnings = [...parsed.warnings]
  const ignored = []
  const supportedActions = new Set(Object.values(gpioActionValues))
  const isAllowedPinAction = (action) => supportedActions.has(action) || isSpecialPinAction(action)
  const { groups } = parsed

  const runGroup = (name, mergeFn, fallback) => {
    try {
      return mergeFn()
    } catch (error) {
      if (error instanceof SettingsBackupError) {
        blockingIssues.push({ code: 'invalid-value', message: error.message, path: error.path || name })
      } else {
        blockingIssues.push({ code: 'merge-failed', message: error instanceof Error ? error.message : String(error), path: name })
      }
      return fallback
    }
  }

  // GPIO (pins)
  const basePins = baseline.pinMappings
  const mergedPins = runGroup('pins', () => {
    const merged = structuredClone(basePins)
    if (!groups.pins) return merged
    for (const [key, entry] of Object.entries(groups.pins)) {
      const path = `pins.${key}`
      if (!PIN_KEY.test(key) || !isRecord(merged[key])) {
        ignored.push({ path, reason: 'unknown-pin' })
        continue
      }
      if (!isRecord(entry)) throw new SettingsBackupError('Pin entry must be a JSON object.', path)
      for (const [field, value] of Object.entries(entry)) {
        const fieldPath = join(path, field)
        if (PIN_NUMERIC_FIELDS.includes(field)) {
          if (!Number.isInteger(value)) throw new SettingsBackupError(`${field} must be an integer.`, fieldPath)
          if (field === 'action' && !isAllowedPinAction(value)) throw new SettingsBackupError(`Unsupported GPIO action ${value}.`, fieldPath)
          if (field !== 'action' && (value < 0 || value > UINT32_MAX)) throw new SettingsBackupError(`${field} is out of range.`, fieldPath)
          merged[key][field] = value
        } else if (field === 'profileLabel') {
          if (typeof value !== 'string') throw new SettingsBackupError('profileLabel must be a string.', fieldPath)
          merged[key][field] = value
        } else if (field === 'enabled') {
          if (!isBoolLike(value)) throw new SettingsBackupError('enabled must be a boolean.', fieldPath)
          merged[key][field] = likeBase(basePins[key].enabled, boolFromLike(value))
        } else {
          ignored.push({ path: fieldPath, reason: 'unknown-field' })
        }
      }
      if (!snapshotsEqual(merged[key], basePins[key])) {
        if (isSpecialPinAction(basePins[key].action) || isSpecialPinAction(merged[key].action)) {
          throw new SettingsBackupError(`${key} is reserved or assigned to an add-on and cannot be changed by restore.`, path)
        }
      }
    }
    return merged
  }, structuredClone(basePins))

  // Hall calibration (heTrigger)
  const baseTriggers = baseline.hallCalibrations.triggers
  const mergedTriggers = runGroup('heTrigger', () => {
    const merged = structuredClone(baseTriggers)
    if (!groups.heTrigger) return merged
    if (!Object.hasOwn(groups.heTrigger, 'triggers') || !Array.isArray(groups.heTrigger.triggers)) {
      throw new SettingsBackupError('heTrigger.triggers must be an array.', 'heTrigger.triggers')
    }
    groups.heTrigger.triggers.forEach((entry, index) => {
      const path = `heTrigger.triggers[${index}]`
      if (index >= baseTriggers.length) {
        ignored.push({ path, reason: 'extra-entry' })
        return
      }
      if (!isRecord(entry)) throw new SettingsBackupError('Hall entry must be a JSON object.', path)
      for (const [field, value] of Object.entries(entry)) {
        const fieldPath = join(path, field)
        if (field === 'action') {
          if (!Number.isInteger(value) || !supportedActions.has(value)) throw new SettingsBackupError(`Unsupported Hall action ${value}.`, fieldPath)
          merged[index].action = value
        } else if (HALL_NUMERIC_FIELDS.includes(field)) {
          if (!isInRange(value, 0, ADC_MAX)) throw new SettingsBackupError(`${field} must be an integer from 0 to ${ADC_MAX}.`, fieldPath)
          merged[index][field] = value
        } else if (HALL_BOOLEAN_FIELDS.includes(field)) {
          if (!isBoolLike(value)) throw new SettingsBackupError(`${field} must be a boolean.`, fieldPath)
          merged[index][field] = likeBase(baseTriggers[index][field], boolFromLike(value))
        } else {
          ignored.push({ path: fieldPath, reason: 'unknown-field' })
        }
      }
    })
    return merged
  }, structuredClone(baseTriggers))

  // Keyboard (WebConfig: { Name: { pin, key, error } }; raw numbers are also accepted)
  const mergedKeys = runGroup('keyboard', () => {
    const merged = structuredClone(baseline.keyMappings)
    if (!groups.keyboard) return merged
    for (const [name, value] of Object.entries(groups.keyboard)) {
      const path = `keyboard.${name}`
      if (!Object.hasOwn(baseline.keyMappings, name)) {
        ignored.push({ path, reason: 'unsupported-action' })
        continue
      }
      let key = value
      if (isRecord(value)) {
        key = value.key
        for (const field of Object.keys(value)) {
          if (field !== 'key' && field !== 'pin' && field !== 'error') ignored.push({ path: join(path, field), reason: 'unknown-field' })
        }
      }
      if (!isInRange(key, 0, KEYBOARD_KEY_MAX)) throw new SettingsBackupError(`Keyboard key must be an integer from 0 to ${KEYBOARD_KEY_MAX}.`, path)
      merged[name] = key
    }
    return merged
  }, structuredClone(baseline.keyMappings))

  // Gamepad options: only known fields are patched. fnButtonPin is derived from GPIO and never written.
  const baseOptions = baseline.gamepadOptions
  const patch = runGroup('gamepad', () => {
    const result = {}
    if (!groups.gamepad) return result
    for (const [key, value] of Object.entries(groups.gamepad)) {
      const path = `gamepad.${key}`
      if (key === 'fnButtonPin' || key === 'usedPins') {
        ignored.push({ path, reason: 'derived' })
        continue
      }
      if (!Object.hasOwn(baseOptions, key)) {
        ignored.push({ path, reason: 'unknown-field' })
        continue
      }
      const current = baseOptions[key]
      let next
      if (HOTKEY_KEY.test(key)) {
        if (!isRecord(value)) throw new SettingsBackupError(`${key} must be a JSON object.`, path)
        if (!isRecord(current)) throw new SettingsBackupError(`Current ${key} is not an object.`, path)
        next = { ...current }
        for (const [field, fieldValue] of Object.entries(value)) {
          const fieldPath = join(path, field)
          if (!HOTKEY_FIELDS.includes(field)) {
            ignored.push({ path: fieldPath, reason: 'unknown-field' })
            continue
          }
          if (!Number.isInteger(fieldValue)) throw new SettingsBackupError(`${field} must be an integer.`, fieldPath)
          next[field] = fieldValue
        }
      } else if (typeof current === 'number') {
        if (!Number.isInteger(value)) throw new SettingsBackupError(`${key} must be an integer.`, path)
        next = value
      } else if (typeof current === 'string') {
        if (typeof value !== 'string') throw new SettingsBackupError(`${key} must be a string.`, path)
        next = value
      } else {
        throw new SettingsBackupError(`${key} has an unsupported type in the device settings.`, path)
      }
      if (!snapshotsEqual(next, current)) result[key] = next
    }
    if (Object.keys(result).length > 0) buildGamepadOptionsPayload(baseOptions, result)
    return result
  }, {})

  const fnButtonPin = {
    before: deriveFnButtonPin(basePins, gpioActionValues.FN),
    after: deriveFnButtonPin(mergedPins, gpioActionValues.FN),
  }
  const mergedOptions = Object.keys(patch).length > 0 ? { ...baseOptions, ...patch } : baseOptions
  const expectedOptions = { ...mergedOptions, fnButtonPin: fnButtonPin.after }
  const expectedHall = { ...baseline.hallCalibrations, triggers: mergedTriggers }
  const expected = {
    pinMappings: mergedPins,
    hallCalibrations: expectedHall,
    keyMappings: mergedKeys,
    gamepadOptions: expectedOptions,
  }

  for (const diagnostic of findDeviceSnapshotDiagnostics(expected, supportedActions)) {
    blockingIssues.push({ code: 'merged-diagnostic', message: diagnostic.message, path: diagnostic.group ?? '' })
  }

  // Origin: a Configurator file must match the connected board. WebConfig files carry no identity.
  const fileBoard = parsed.extension?.boardConfig ?? null
  if (fileBoard !== null && fileBoard !== (device?.boardConfig ?? null)) {
    blockingIssues.push({ code: 'board-mismatch', message: `This backup was made for ${fileBoard}, but the connected device is ${device?.boardConfig ?? 'unknown'}.`, path: EXTENSION_KEY })
  }
  const origin = {
    kind: parsed.extension ? 'configurator' : 'unknown',
    boardConfig: fileBoard,
    requiresAcknowledgement: fileBoard === null,
  }

  // Configurator-only stroke overrides: only the connected device's key is applied.
  let strokeOverrides = null
  if (parsed.extension && Object.keys(parsed.extension.strokeOverrides).length > 0) {
    const next = { ...currentStrokeOverrides }
    const changed = []
    for (const [key, stroke] of Object.entries(parsed.extension.strokeOverrides)) {
      const path = `${EXTENSION_KEY}.strokeOverrides.${key}`
      if (key !== deviceStrokeKey) {
        ignored.push({ path, reason: 'other-device' })
        continue
      }
      if (strokeLimits && !(stroke >= strokeLimits.min && stroke <= strokeLimits.max)) {
        blockingIssues.push({ code: 'invalid-value', message: `Stroke must be between ${strokeLimits.min} and ${strokeLimits.max} mm.`, path })
        continue
      }
      if (next[key] !== stroke) {
        next[key] = stroke
        changed.push(key)
      }
    }
    strokeOverrides = { next, changed }
  }

  const changes = {
    gpio: snapshotDiffPaths(mergedPins, basePins),
    hall: mergedTriggers.flatMap((trigger, index) => snapshotDiffPaths(trigger, baseTriggers[index], `ch${index}`)),
    keyboard: snapshotDiffPaths(mergedKeys, baseline.keyMappings),
    options: Object.keys(patch),
  }
  const hallChanged = changes.hall.length > 0
  const gpioChanged = changes.gpio.length > 0

  const writes = {
    gpio: gpioChanged ? { payload: mergedPins, expected: mergedPins } : null,
    hall: hallChanged ? { payload: { triggers: mergedTriggers }, expected: expectedHall } : null,
    keyboard: changes.keyboard.length > 0 ? { payload: mergedKeys, expected: mergedKeys } : null,
    options: changes.options.length > 0 ? { payload: patch, expected: expectedOptions } : null,
  }

  const hasChanges = Object.values(writes).some(Boolean) || (strokeOverrides?.changed.length ?? 0) > 0

  return {
    ok: blockingIssues.length === 0,
    blockingIssues,
    warnings,
    ignored,
    ignoredTopLevelKeys: parsed.ignoredTopLevelKeys,
    unknownTopLevelKeys: parsed.unknownTopLevelKeys,
    presentGroups: Object.keys(groups),
    keptGroups: RESTORE_GROUP_KEYS.filter((key) => !groups[key]),
    origin,
    changes,
    writes,
    expected,
    fnButtonPin: { ...fnButtonPin, changed: fnButtonPin.before !== fnButtonPin.after },
    strokeOverrides,
    hasChanges,
  }
}

/**
 * Apply a validated restore plan one group at a time: freshness check, one POST, readback.
 * No retry and no rollback. On failure, appliedGroups and uncertainGroup describe what is known.
 */
export async function commitRestorePlan({ plan, baseline, request, readSnapshot }) {
  const appliedGroups = []
  let uncertainGroup = null
  let stage = 'preflight'
  try {
    if (!plan.ok) {
      throw new ConfigPersistenceError('Restore plan has blocking issues; nothing was sent to the device.', { stage: 'preflight' })
    }
    assertSnapshotEqual(await readSnapshot(), baseline, 'Pre-restore freshness')
    const { writes, expected, fnButtonPin } = plan

    if (writes.gpio) {
      stage = 'gpio'
      assertSnapshotEqual(await request('/api/getPinMappings'), baseline.pinMappings, 'GPIO pre-write freshness')
      uncertainGroup = 'gpio'
      await request('/api/setPinMappings', { method: 'POST', body: JSON.stringify(writes.gpio.payload) })
      assertSnapshotEqual(await request('/api/getPinMappings'), writes.gpio.expected, 'GPIO')
      appliedGroups.push('gpio')
      // GPIO is confirmed; a mismatch here concerns only the firmware-derived fnButtonPin.
      stage = 'gpio-derived-fn'
      uncertainGroup = 'derived Fn pin'
      assertSnapshotEqual(
        await request('/api/getGamepadOptions'),
        { ...baseline.gamepadOptions, fnButtonPin: fnButtonPin.after },
        'Fn-derived gamepad options',
      )
      if (fnButtonPin.changed) appliedGroups[appliedGroups.length - 1] = 'gpio (including derived Fn pin)'
      uncertainGroup = null
    }

    if (writes.hall) {
      stage = 'hall'
      assertSnapshotEqual(await request('/api/getHETriggerCalibrations'), baseline.hallCalibrations, 'Hall pre-write freshness')
      uncertainGroup = 'hall'
      await request('/api/setHETriggerCalibrations', { method: 'POST', body: JSON.stringify(writes.hall.payload) })
      assertSnapshotEqual(await request('/api/getHETriggerCalibrations'), writes.hall.expected, 'Hall')
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
      const latestOptions = await request('/api/getGamepadOptions')
      assertSnapshotEqual(latestOptions, { ...baseline.gamepadOptions, fnButtonPin: fnButtonPin.after }, 'Gamepad options pre-write freshness')
      const payload = buildGamepadOptionsPayload(latestOptions, writes.options.payload)
      uncertainGroup = 'options'
      await request('/api/setGamepadOptions', { method: 'POST', body: JSON.stringify(payload) })
      assertSnapshotEqual(await request('/api/getGamepadOptions'), writes.options.expected, 'Gamepad options')
      appliedGroups.push('options')
      uncertainGroup = null
    }

    stage = 'final-readback'
    const confirmed = await readSnapshot()
    assertSnapshotEqual(confirmed, expected, 'Final configuration')
    return { snapshot: confirmed, appliedGroups }
  } catch (error) {
    if (error instanceof ConfigPersistenceError) throw error
    throw new ConfigPersistenceError(error instanceof Error ? error.message : String(error), { appliedGroups, uncertainGroup, stage })
  }
}
