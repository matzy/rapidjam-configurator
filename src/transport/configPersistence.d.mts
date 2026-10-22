import type { DeviceConfig } from '../device'

export interface RawHallTrigger {
  action: number
  idle: number
  active: number
  pressed: number
  release: number
  noise: number
  is_polarized: number | boolean
  rapidTrigger?: number | boolean
  [key: string]: unknown
}

export interface RawDeviceSnapshot {
  pinMappings: Record<string, unknown> & { [key: `pin${string}`]: { action: number, customButtonMask: number, customDpadMask: number, [key: string]: unknown } }
  hallCalibrations: Record<string, unknown> & { triggers: Array<RawHallTrigger | undefined> }
  keyMappings: Record<string, number>
  gamepadOptions: Record<string, unknown>
}

export interface ConfigWritePlan {
  changes: { gpio: string[], hall: string[], keyboard: string[], options: string[] }
  expected: RawDeviceSnapshot
  writes: {
    gpio: { payload: Record<string, unknown>, expected: unknown } | null
    hall: { payload: { triggers: Array<Record<string, unknown>> }, expected: unknown } | null
    keyboard: { payload: Record<string, number>, expected: unknown } | null
    options: { payload: Record<string, unknown>, expected: unknown } | null
  }
  fnButtonPin: { before: number, after: number, changed: boolean }
}

export class ConfigPersistenceError extends Error {
  readonly appliedGroups: string[]
  readonly uncertainGroup: string | null
  readonly stage: string
}

export function canonicalJson(value: unknown): unknown
export function snapshotsEqual(left: unknown, right: unknown): boolean
export function snapshotDiffPaths(actual: unknown, expected: unknown, prefix?: string): string[]
export function deriveFnButtonPin(pinMappings: Record<string, unknown>, fnActionValue: number): number
export function buildConfigWritePlan(options: {
  config: DeviceConfig
  baseline: RawDeviceSnapshot
  gpioActionValues: Record<string, number>
}): ConfigWritePlan
export function assertSnapshotEqual(actual: unknown, expected: unknown, label: string): void
export function commitConfigSnapshot(options: {
  config: DeviceConfig
  baseline: RawDeviceSnapshot
  gpioActionValues: Record<string, number>
  request: (path: string, options?: RequestInit) => Promise<unknown>
  readSnapshot: () => Promise<RawDeviceSnapshot>
}): Promise<{ snapshot: RawDeviceSnapshot, plan: ConfigWritePlan }>
