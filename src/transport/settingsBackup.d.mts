import type { RawDeviceSnapshot } from './configPersistence.mjs'

export declare const BACKUP_FORMAT_VERSION: 1
export declare const EXTENSION_KEY: 'rapidjamConfigurator'
export declare const MAX_BACKUP_BYTES: number
export declare const RESTORE_GROUP_KEYS: readonly ['pins', 'heTrigger', 'gamepad', 'keyboard']

export declare class SettingsBackupError extends Error {
  readonly path: string
  constructor(message: string, path?: string)
}

export interface BackupDeviceIdentity {
  boardConfig: string | null
  firmware: string | null
}

export interface ConfiguratorBackupExtension {
  formatVersion: number
  createdAt?: string
  configuratorVersion?: string
  device?: BackupDeviceIdentity
  strokeOverrides?: Record<string, number>
}

export interface CreateGp2040BackupInput {
  snapshot: RawDeviceSnapshot
  device: BackupDeviceIdentity
  configuratorVersion: string
  createdAt: string
  strokeOverrides?: Record<string, number>
  strokeKey?: string | null
}

export declare function createGp2040Backup(input: CreateGp2040BackupInput): Record<string, unknown>
export declare function serializeGp2040Backup(backup: Record<string, unknown>): string

export interface ParsedGp2040Backup {
  groups: Partial<Record<'pins' | 'heTrigger' | 'gamepad' | 'keyboard', Record<string, unknown>>>
  extension: {
    formatVersion: number
    boardConfig: string | null
    firmware: string | null
    strokeOverrides: Record<string, number>
  } | null
  warnings: Array<{ code: string; message: string }>
  ignoredTopLevelKeys: string[]
  unknownTopLevelKeys: string[]
}

export declare function parseGp2040Backup(
  text: string,
  options?: { maxBytes?: number },
): ParsedGp2040Backup

export interface RestoreIgnoredEntry {
  path: string
  reason: 'unknown-pin' | 'unknown-field' | 'extra-entry' | 'unsupported-action' | 'derived' | 'other-device'
}

export interface RestoreBlockingIssue {
  code: 'invalid-value' | 'merge-failed' | 'merged-diagnostic' | 'board-mismatch'
  message: string
  path: string
}

export interface RestorePlan {
  ok: boolean
  blockingIssues: RestoreBlockingIssue[]
  warnings: Array<{ code: string; message: string }>
  ignored: RestoreIgnoredEntry[]
  ignoredTopLevelKeys: string[]
  unknownTopLevelKeys: string[]
  presentGroups: string[]
  keptGroups: string[]
  origin: { kind: 'configurator' | 'unknown'; boardConfig: string | null; requiresAcknowledgement: boolean }
  changes: { gpio: string[]; hall: string[]; keyboard: string[]; options: string[] }
  writes: Record<
    'gpio' | 'hall' | 'keyboard' | 'options',
    { payload: unknown; expected: unknown } | null
  >
  expected: RawDeviceSnapshot
  fnButtonPin: { before: number | null; after: number | null; changed: boolean }
  strokeOverrides: { next: Record<string, number>; changed: string[] } | null
  hasChanges: boolean
}

export interface BuildRestorePlanInput {
  parsed: ParsedGp2040Backup
  baseline: RawDeviceSnapshot
  device: BackupDeviceIdentity
  gpioActionValues: Record<string, number>
  currentStrokeOverrides?: Record<string, number>
  deviceStrokeKey?: string | null
  strokeLimits?: { min: number; max: number } | null
}

export declare function buildRestorePlan(input: BuildRestorePlanInput): RestorePlan

export interface CommitRestorePlanInput {
  plan: RestorePlan
  baseline: RawDeviceSnapshot
  request: (path: string, init?: { method?: string; body?: string }) => Promise<unknown>
  readSnapshot: () => Promise<RawDeviceSnapshot>
}

export declare function commitRestorePlan(
  input: CommitRestorePlanInput,
): Promise<{ snapshot: RawDeviceSnapshot; appliedGroups: string[] }>
