/** A response that reached us but cannot be trusted (unparsable body, impossible value, wrong channel echo). */
export class InvalidDeviceResponseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidDeviceResponseError'
  }
}

export const HALL_ADC_MAX = 4095

export function isInvalidDeviceResponse(error: unknown): boolean {
  return error instanceof Error && error.name === 'InvalidDeviceResponseError'
}

/**
 * Validate a getHETriggerVoltage response for the channel that was requested.
 * Firmware-reported errors become plain Errors; anything that merely looks wrong
 * (corrupted body that still parsed) becomes InvalidDeviceResponseError.
 * Newer firmware echoes `targetId`; when present it must match the request.
 */
export function parseHallVoltageResponse(result: unknown, channel: number): number {
  if (typeof result !== 'object' || result === null) throw new InvalidDeviceResponseError(`Unexpected response for CH${channel}`)
  const body = result as { voltage?: unknown, error?: unknown, targetId?: unknown }
  if (typeof body.error === 'string' && body.error) throw new Error(body.error)
  if (body.targetId !== undefined && body.targetId !== channel) {
    throw new InvalidDeviceResponseError(`Voltage response for CH${channel} reported targetId ${String(body.targetId)}`)
  }
  if (typeof body.voltage !== 'number' || !Number.isInteger(body.voltage) || body.voltage < 0 || body.voltage > HALL_ADC_MAX) {
    throw new InvalidDeviceResponseError(`No valid voltage returned for CH${channel}`)
  }
  return body.voltage
}
