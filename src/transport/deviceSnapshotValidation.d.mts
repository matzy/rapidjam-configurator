export interface DeviceSnapshotIssue {
  code: string
  message: string
  group: 'snapshot' | 'gpio' | 'hall'
  pin?: number
  channel?: number
  field?: string
  rawValue?: unknown
}

export function findDeviceSnapshotDiagnostics(
  snapshot: unknown,
  supportedGpioActions: ReadonlySet<number>,
): DeviceSnapshotIssue[]

export function findDeviceSnapshotIssues(
  snapshot: unknown,
  supportedGpioActions: ReadonlySet<number>,
): string[]