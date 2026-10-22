const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

const issue = (code, message, details = {}) => ({ code, message, ...details })
const disabledAction = -10

/**
 * Inspect the settings the configurator needs to render before decoding them.
 * Invalid device values are reported, never converted to defaults or writable values.
 */
export function findDeviceSnapshotIssues(snapshot, supportedGpioActions) {
  return findDeviceSnapshotDiagnostics(snapshot, supportedGpioActions).map(({ message }) => message)
}

/** Return field-addressable diagnostics without changing the raw device values. */
export function findDeviceSnapshotDiagnostics(snapshot, supportedGpioActions) {
  const issues = []
  if (!isRecord(snapshot)) return [issue('invalid-snapshot', 'Device settings snapshot is not an object.', { group: 'snapshot' })]

  const pinMappings = snapshot.pinMappings
  if (!isRecord(pinMappings)) {
    issues.push(issue('invalid-gpio-group', 'GPIO mappings are missing or invalid.', { group: 'gpio' }))
  } else {
    for (let pin = 0; pin <= 5; pin += 1) {
      const key = `pin${String(pin).padStart(2, '0')}`
      const mapping = pinMappings[key]
      if (!isRecord(mapping) || typeof mapping.action !== 'number' || !Number.isInteger(mapping.action)) {
        issues.push(issue('invalid-gpio-mapping', `GP${pin} mapping is missing or invalid.`, { group: 'gpio', pin, field: 'action' }))
      } else if (!supportedGpioActions.has(mapping.action)) {
        issues.push(issue('unsupported-gpio-action', `GP${pin} has unsupported action ${mapping.action}.`, { group: 'gpio', pin, field: 'action', rawValue: mapping.action }))
      }
    }
  }

  const hallCalibrations = snapshot.hallCalibrations
  if (!isRecord(hallCalibrations) || !Array.isArray(hallCalibrations.triggers)) {
    issues.push(issue('invalid-hall-group', 'Hall calibration data is missing or invalid.', { group: 'hall' }))
  } else {
    for (let channel = 0; channel < 16; channel += 1) {
      const trigger = hallCalibrations.triggers[channel]
      if (!isRecord(trigger) || typeof trigger.action !== 'number' || !Number.isInteger(trigger.action)) {
        issues.push(issue('invalid-hall-action', `Hall CH${channel} mapping is missing or invalid.`, { group: 'hall', channel, field: 'action', rawValue: trigger?.action }))
        continue
      }
      if (!supportedGpioActions.has(trigger.action)) {
        issues.push(issue('unsupported-hall-action', `Hall CH${channel} has unsupported action ${trigger.action}.`, { group: 'hall', channel, field: 'action', rawValue: trigger.action }))
      }
      if (trigger.action === disabledAction) continue

      for (const field of ['idle', 'active', 'pressed', 'release', 'noise']) {
        const value = trigger[field]
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 4095) {
          issues.push(issue('invalid-hall-value', `Hall CH${channel} ${field} value is missing or outside the ADC range.`, { group: 'hall', channel, field, rawValue: value }))
        }
      }
      if (Number.isInteger(trigger.idle) && Number.isInteger(trigger.pressed) && trigger.idle === trigger.pressed) {
        issues.push(issue('invalid-hall-span', `Hall CH${channel} has no calibrated ADC span (idle equals pressed).`, { group: 'hall', channel, field: 'pressed', rawValue: trigger.pressed }))
      }
      if (![0, 1, false, true].includes(trigger.is_polarized)) {
        issues.push(issue('invalid-hall-polarity', `Hall CH${channel} polarity value is missing or invalid.`, { group: 'hall', channel, field: 'is_polarized', rawValue: trigger.is_polarized }))
      }
      if (![0, 1, false, true].includes(trigger.rapidTrigger)) {
        issues.push(issue('invalid-hall-rapid-trigger', `Hall CH${channel} Rapid Trigger value is missing or invalid.`, { group: 'hall', channel, field: 'rapidTrigger', rawValue: trigger.rapidTrigger }))
      }
    }
  }

  return issues
}