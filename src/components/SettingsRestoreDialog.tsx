import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { Check } from 'lucide-react'
import { gpioActionValues, type DeviceInfo } from '../device'
import { readStrokeOverrides, STROKE_MAX_MM, STROKE_MIN_MM, strokeDeviceKey, writeStrokeOverrides } from '../config/strokeProfiles'
import type { RawDeviceSnapshot } from '../transport/configPersistence.mjs'
import {
  buildRestorePlan,
  parseGp2040Backup,
  type RestoreIgnoredEntry,
  type RestorePlan,
} from '../transport/settingsBackup.mjs'
import { buildGp2040Backup, downloadTextFile, gp2040FileName } from '../utils/settingsBackupFile'
import { useLocale } from '../useLocale'

interface Preview {
  fileName: string
  plan: RestorePlan
  baseline: RawDeviceSnapshot
}

interface SettingsRestoreDialogProps {
  device: DeviceInfo
  busy: boolean
  onReadSnapshot: () => Promise<RawDeviceSnapshot>
  onApply: (plan: RestorePlan, baseline: RawDeviceSnapshot) => Promise<void>
  onClose: () => void
}

const IGNORED_LIST_LIMIT = 20

const ignoredReasonLabel: Record<RestoreIgnoredEntry['reason'], string> = {
  'unknown-pin': 'Unknown pin',
  'unknown-field': 'Unknown field',
  'extra-entry': 'Extra entry',
  'unsupported-action': 'Action not supported by this firmware',
  derived: 'Derived value (not written)',
  'other-device': 'Belongs to another device',
}

const errorText = (error: unknown) => error instanceof Error ? error.message : String(error)

export function SettingsRestoreDialog({ device, busy, onReadSnapshot, onApply, onClose }: SettingsRestoreDialogProps) {
  const { t } = useLocale()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneMessage, setDoneMessage] = useState<string | null>(null)
  const [backupConfirmed, setBackupConfirmed] = useState(false)
  const [hallConfirmed, setHallConfirmed] = useState(false)
  const [originConfirmed, setOriginConfirmed] = useState(false)
  // Only the most recent file selection may update the preview.
  const loadRequestId = useRef(0)

  const plan = preview?.plan ?? null
  const canRun = Boolean(
    plan && plan.ok && plan.hasChanges && backupConfirmed && hallConfirmed
    && (!plan.origin.requiresAcknowledgement || originConfirmed)
    && !loading && !running && !busy,
  )
  const working = loading || running

  function resetSteps() {
    setBackupConfirmed(false)
    setHallConfirmed(false)
    setOriginConfirmed(false)
  }

  async function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || running) return
    const requestId = ++loadRequestId.current
    const isCurrent = () => requestId === loadRequestId.current
    resetSteps()
    setPreview(null)
    setDoneMessage(null)
    setError(null)
    setLoading(true)
    try {
      const parsed = parseGp2040Backup(await file.text())
      const baseline = await onReadSnapshot()
      if (!isCurrent()) return
      const nextPlan = buildRestorePlan({
        parsed,
        baseline,
        device: { boardConfig: device.boardConfig ?? null, firmware: device.firmware ?? null },
        gpioActionValues,
        currentStrokeOverrides: readStrokeOverrides(),
        deviceStrokeKey: strokeDeviceKey(device),
        strokeLimits: { min: STROKE_MIN_MM, max: STROKE_MAX_MM },
      })
      setPreview({ fileName: file.name, plan: nextPlan, baseline })
    } catch (caught) {
      if (isCurrent()) setError(errorText(caught))
    } finally {
      if (isCurrent()) setLoading(false)
    }
  }

  async function saveCurrentSettings() {
    if (working || busy) return
    setLoading(true)
    setError(null)
    try {
      const snapshot = await onReadSnapshot()
      if (preview && JSON.stringify(snapshot) !== JSON.stringify(preview.baseline)) {
        setPreview(null)
        resetSteps()
        setError(t('The device changed after the file was reviewed. Choose the file again.'))
        return
      }
      downloadTextFile(gp2040FileName(), buildGp2040Backup(snapshot, device), 'application/json')
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setLoading(false)
    }
  }

  async function runRestore() {
    if (!preview || !canRun) return
    setRunning(true)
    setError(null)
    try {
      await onApply(preview.plan, preview.baseline)
      if (preview.plan.strokeOverrides?.changed.length) writeStrokeOverrides(preview.plan.strokeOverrides.next)
      setDoneMessage(t('Restored settings: {{groups}}', { groups: preview.plan.presentGroups.join(', ') || '—' }))
      setPreview(null)
      resetSteps()
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setRunning(false)
    }
  }

  function closeOnEscape(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !working) onClose()
  }

  const ignored: RestoreIgnoredEntry[] = plan?.ignored ?? []

  return (
    <div className="connect-error-overlay restore-confirm-overlay">
      <div
        className="connect-error-card restore-dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-restore-title"
        aria-describedby="settings-restore-description"
        onKeyDown={closeOnEscape}
      >
        <h2 id="settings-restore-title">{t('Restore settings from backup')}</h2>
        <p id="settings-restore-description">{t('Restores GPIO, magnetic switch, gamepad, and keyboard settings from a .gp2040 file. Firmware is not changed. Writes are not atomic: if the device reports an error midway, the result is shown and nothing is rolled back.')}</p>

        <label className="restore-file-picker">
          <span>{t('Choose a .gp2040 backup file')}</span>
          <input type="file" accept=".gp2040" onChange={(event) => void loadFile(event)} disabled={working || busy} />
        </label>

        {loading && <p role="status">{t('Reading device and file...')}</p>}
        {error && <p className="restore-error" role="alert">{error}</p>}
        {doneMessage && <p className="restore-done" role="status"><Check size={15} aria-hidden="true" /> {doneMessage}</p>}

        {preview && plan && <div className="restore-preview">
          <p className="restore-file-name">{t('File')}: {preview.fileName}</p>
          <p>{plan.origin.kind === 'configurator'
            ? t('Created by RapidJAM Configurator. Board: {{board}}', { board: plan.origin.boardConfig ?? '—' })
            : t('No RapidJAM Configurator information in this file. It may be a WebConfig backup. Confirm it came from this same device.')}</p>
          <p>{t('Groups to restore: {{groups}}', { groups: plan.presentGroups.join(', ') || '—' })}</p>
          {plan.keptGroups.length > 0 && <p>{t('Groups not in the file (kept as they are): {{groups}}', { groups: plan.keptGroups.join(', ') })}</p>}
          {!plan.hasChanges && <p>{t('No differences from the current device settings. Nothing to restore.')}</p>}

          {(['gpio', 'hall', 'keyboard', 'options'] as const).map((group) => plan.changes[group].length > 0 && (
            <div key={group}>
              <h3>{t(group === 'gpio' ? 'GPIO changes' : group === 'hall' ? 'Magnetic switch changes' : group === 'keyboard' ? 'Keyboard changes' : 'Gamepad option changes')}</h3>
              <ul>{plan.changes[group].map((line) => <li key={line}>{line}</li>)}</ul>
            </div>
          ))}
          {plan.fnButtonPin.changed && <p>{t('The Fn button pin is derived from GPIO and will be updated by the device.')}</p>}
          {plan.strokeOverrides && plan.strokeOverrides.changed.length > 0 && <p>{t('Stroke length for this device will change on this computer: {{keys}}', { keys: plan.strokeOverrides.changed.join(', ') })}</p>}

          {plan.blockingIssues.length > 0 && <div className="restore-blocking" role="alert">
            <h3>{t('Cannot restore this file')}</h3>
            <ul>{plan.blockingIssues.map((issue) => <li key={`${issue.code}-${issue.path}`}>{t(issue.message)} <small>{issue.path}</small></li>)}</ul>
          </div>}
          {plan.warnings.length > 0 && <ul className="restore-warnings">{plan.warnings.map((warning) => <li key={`${warning.code}-${warning.message}`}>{t(warning.message)}</li>)}</ul>}

          {ignored.length > 0 && <details>
            <summary>{t('Ignored entries ({{count}})', { count: ignored.length })}</summary>
            <ul>{ignored.slice(0, IGNORED_LIST_LIMIT).map((entry) => <li key={`${entry.path}-${entry.reason}`}>{entry.path} <small>{t(ignoredReasonLabel[entry.reason])}</small></li>)}</ul>
            {ignored.length > IGNORED_LIST_LIMIT && <p>{t('and {{count}} more', { count: ignored.length - IGNORED_LIST_LIMIT })}</p>}
          </details>}
          {plan.ignoredTopLevelKeys.length > 0 && <p>{t('Sections not used by the Configurator (ignored): {{keys}}', { keys: plan.ignoredTopLevelKeys.join(', ') })}</p>}
          {plan.unknownTopLevelKeys.length > 0 && <p>{t('Unknown sections (ignored): {{keys}}', { keys: plan.unknownTopLevelKeys.join(', ') })}</p>}
        </div>}

        {preview && plan && <div className="restore-steps">
          <button className="secondary-button" onClick={() => void saveCurrentSettings()} disabled={working || busy}>
            {t(loading ? 'Saving backup...' : '1. Save current settings')}
          </button>
          <label className="restore-acknowledgement">
            <input type="checkbox" checked={backupConfirmed} onChange={(event) => setBackupConfirmed(event.target.checked)} />
            <span>{t('I saved the current settings file. Use it to return to the current state if needed.')}</span>
          </label>
          <label className="restore-acknowledgement">
            <input type="checkbox" checked={hallConfirmed} onChange={(event) => setHallConfirmed(event.target.checked)} />
            <span>{t('Magnetic switch calibration values differ per device. I confirmed this file matches this RapidJAM.')}</span>
          </label>
          {plan.origin.requiresAcknowledgement && <label className="restore-acknowledgement">
            <input type="checkbox" checked={originConfirmed} onChange={(event) => setOriginConfirmed(event.target.checked)} />
            <span>{t('I confirmed this file is a backup of this RapidJAM.')}</span>
          </label>}
        </div>}

        <div className="actions">
          <button className="secondary-button" onClick={onClose} disabled={working || running}>{t('Close')}</button>
          {preview && plan && <button className="primary-button" onClick={() => void runRestore()} disabled={!canRun}>
            {t(running ? 'Restoring...' : '2. Restore settings')}
          </button>}
        </div>
      </div>
    </div>
  )
}
