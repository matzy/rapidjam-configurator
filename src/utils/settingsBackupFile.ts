import type { DeviceInfo } from '../device'
import { readStrokeOverrides, strokeDeviceKey } from '../config/strokeProfiles'
import type { RawDeviceSnapshot } from '../transport/configPersistence.mjs'
import { createGp2040Backup, serializeGp2040Backup } from '../transport/settingsBackup.mjs'
import packageJson from '../../package.json'

const timestamp = (now: Date) => now.toISOString().replace(/[:.]/g, '-')

export function buildGp2040Backup(snapshot: RawDeviceSnapshot, device: DeviceInfo, now = new Date()): string {
  const backup = createGp2040Backup({
    snapshot,
    device: { boardConfig: device.boardConfig ?? null, firmware: device.firmware ?? null },
    configuratorVersion: packageJson.version,
    createdAt: now.toISOString(),
    strokeOverrides: readStrokeOverrides(),
    strokeKey: strokeDeviceKey(device),
  })
  return serializeGp2040Backup(backup)
}

export function gp2040FileName(now = new Date()): string {
  return `rapidjam_backup_${timestamp(now)}.gp2040`
}

export function downloadTextFile(fileName: string, text: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
