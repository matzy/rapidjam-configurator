import { useMemo, useState, type ReactNode } from 'react'
import { ButtonFaceTuningContext } from '../config/buttonFaceTuningContext'
import { resolveButtonFace, type ButtonFaceTuningFile } from '../config/buttonFaceTuning'
import { BUTTON_FACE_FIELD_RANGES, type ButtonFaceSection } from '../config/buttonFaceTuningValidation'
import defaultTuning from '../config/buttonFaceTuning.json'
import { hardwareLabelText } from '../config/hardwareLabels'
import type { HallChannel } from '../device'
import './button-face-tuner.css'

const ENDPOINT = '/__button-face-tuning'
const CHANNELS = Array.from({ length: 16 }, (_, index) => `ch${index}` as HallChannel)
const SECTION_TITLES: Record<ButtonFaceSection, string> = { engraving: '刻印（engraving）', label: '機能名（label）' }
const FIELD_LABELS: Record<string, string> = {
  offsetX: 'X 位置 (SVG px)',
  offsetY: 'Y 位置 (SVG px)',
  scale: '大きさ (倍率)',
  opacity: '濃さ',
  shadow: '影・ハイライト',
  fontSize: '文字サイズ (px)',
}
const STEPS: Record<string, number> = { offsetX: 0.5, offsetY: 0.5, scale: 0.01, opacity: 0.01, shadow: 0.01, fontSize: 0.5 }

type Target = 'global' | HallChannel
type Fields = Record<string, number | undefined>

function clone(file: ButtonFaceTuningFile): ButtonFaceTuningFile {
  return JSON.parse(JSON.stringify(file)) as ButtonFaceTuningFile
}

function clamp(value: number, [min, max]: [number, number]): number {
  return Math.min(max, Math.max(min, value))
}

function readValue(file: ButtonFaceTuningFile, target: Target, section: ButtonFaceSection, key: string): { value: number; overridden: boolean } {
  if (target === 'global') return { value: (file[section] as unknown as Record<string, number>)[key], overridden: false }
  const resolved = (resolveButtonFace(target, file)[section] as unknown as Record<string, number>)[key]
  const override = file.perChannel[target]?.[section] as Fields | undefined
  return { value: resolved, overridden: override?.[key] !== undefined }
}

function writeGlobal(file: ButtonFaceTuningFile, section: ButtonFaceSection, key: string, value: number): ButtonFaceTuningFile {
  return { ...file, [section]: { ...file[section], [key]: value } }
}

function writeChannel(file: ButtonFaceTuningFile, channel: HallChannel, section: ButtonFaceSection, key: string, value: number | undefined): ButtonFaceTuningFile {
  const override = { ...file.perChannel[channel] } as Record<string, Fields | undefined>
  const sectionOverride: Fields = { ...override[section] }
  if (value === undefined) delete sectionOverride[key]
  else sectionOverride[key] = value
  if (Object.keys(sectionOverride).length === 0) delete override[section]
  else override[section] = sectionOverride

  const perChannel = { ...file.perChannel }
  if (Object.keys(override).length === 0) delete perChannel[channel]
  else perChannel[channel] = override as ButtonFaceTuningFile['perChannel'][HallChannel]
  return { ...file, perChannel }
}

function clearChannel(file: ButtonFaceTuningFile, channel: HallChannel): ButtonFaceTuningFile {
  const perChannel = { ...file.perChannel }
  delete perChannel[channel]
  return { ...file, perChannel }
}

function FieldRow({ target, file, section, field, onChange }: {
  target: Target
  file: ButtonFaceTuningFile
  section: ButtonFaceSection
  field: string
  onChange: (value: number | undefined) => void
}) {
  const range = BUTTON_FACE_FIELD_RANGES[section][field]
  const { value, overridden } = readValue(file, target, section, field)
  const step = STEPS[field] ?? 0.01
  return <div className={`bft-row${overridden ? ' overridden' : ''}`}>
    <label>
      <span>{FIELD_LABELS[field] ?? field}</span>
      <input type="range" min={range[0]} max={range[1]} step={step} value={value} onChange={(event) => onChange(clamp(Number(event.target.value), range))} />
      <input type="number" min={range[0]} max={range[1]} step={step} value={Number(value.toFixed(3))} onChange={(event) => {
        const next = Number(event.target.value)
        if (Number.isFinite(next)) onChange(clamp(next, range))
      }} />
    </label>
    {target !== 'global' && overridden && <button type="button" className="bft-link" onClick={() => onChange(undefined)}>上書き解除</button>}
  </div>
}

function ButtonFaceTunerPanel({ file, onChange, onReset }: {
  file: ButtonFaceTuningFile
  onChange: (next: ButtonFaceTuningFile) => void
  onReset: () => void
}) {
  const [target, setTarget] = useState<Target>('global')
  const [status, setStatus] = useState('')

  async function save() {
    setStatus('保存中…')
    try {
      const response = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(file) })
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      setStatus(response.ok ? 'src/config/buttonFaceTuning.json に保存しました（ページを再読み込みします）' : `保存に失敗: ${body.error ?? response.status}`)
    } catch (error) {
      setStatus(`保存に失敗: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async function copyJson() {
    await navigator.clipboard.writeText(`${JSON.stringify(file, null, 2)}\n`)
    setStatus('JSON をクリップボードにコピーしました')
  }

  const channelLabel = (id: HallChannel) => {
    const engraving = hardwareLabelText(id)
    return `${id.toUpperCase()}${engraving ? ` · ${engraving}` : ''}${file.perChannel[id] ? ' ●' : ''}`
  }

  return <aside className="button-face-tuner" aria-label="Button face tuner">
    <header><strong>Button face tuner</strong><span>dev only</span></header>
    <label className="bft-target">
      <span>対象</span>
      <select value={target} onChange={(event) => setTarget(event.target.value as Target)}>
        <option value="global">全体（既定値）</option>
        {CHANNELS.map((id) => <option key={id} value={id}>{channelLabel(id)}</option>)}
      </select>
    </label>
    {(Object.keys(BUTTON_FACE_FIELD_RANGES) as ButtonFaceSection[]).map((section) => <section key={section}>
      <h3>{SECTION_TITLES[section]}</h3>
      {Object.keys(BUTTON_FACE_FIELD_RANGES[section]).map((field) => <FieldRow
        key={field}
        target={target}
        file={file}
        section={section}
        field={field}
        onChange={(value) => {
          if (target === 'global') {
            if (value !== undefined) onChange(writeGlobal(file, section, field, value))
          } else {
            onChange(writeChannel(file, target, section, field, value))
          }
        }}
      />)}
    </section>)}
    <footer>
      <button type="button" className="bft-primary" onClick={save}>保存</button>
      <button type="button" onClick={copyJson}>JSON をコピー</button>
      <button type="button" onClick={onReset}>読み込み時に戻す</button>
      {target !== 'global' && <button type="button" onClick={() => onChange(clearChannel(file, target))}>{target.toUpperCase()} の上書きを全部消す</button>}
      {status && <p role="status">{status}</p>}
    </footer>
  </aside>
}

export function ButtonFaceTunerShell({ children }: { children: ReactNode }) {
  const [baseline] = useState(() => clone(defaultTuning as ButtonFaceTuningFile))
  const [file, setFile] = useState(() => clone(baseline))
  const value = useMemo(() => ({ file }), [file])
  return <ButtonFaceTuningContext.Provider value={value}>
    {children}
    <ButtonFaceTunerPanel file={file} onChange={setFile} onReset={() => setFile(clone(baseline))} />
  </ButtonFaceTuningContext.Provider>
}
