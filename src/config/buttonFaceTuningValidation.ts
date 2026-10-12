import type { ButtonFaceOverride, ButtonFaceTuningFile } from './buttonFaceTuning.ts'

export type ButtonFaceSection = 'engraving' | 'label'

export const BUTTON_FACE_FIELD_RANGES: Record<ButtonFaceSection, Record<string, [number, number]>> = {
  engraving: { offsetX: [-150, 150], offsetY: [-150, 150], scale: [0.2, 3], opacity: [0, 1], shadow: [0, 1] },
  label: { offsetX: [-150, 150], offsetY: [-150, 150], fontSize: [6, 32], opacity: [0, 1] },
}

export type ButtonFaceParseResult = { ok: true; value: ButtonFaceTuningFile } | { ok: false; error: string }

const SECTIONS: ButtonFaceSection[] = ['engraving', 'label']
const CHANNEL_PATTERN = /^ch(\d+)$/

type Dict = Record<string, unknown>

function isDict(value: unknown): value is Dict {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseNumber(section: ButtonFaceSection, key: string, value: unknown, path: string): number | string {
  const range = Object.prototype.hasOwnProperty.call(BUTTON_FACE_FIELD_RANGES[section], key) ? BUTTON_FACE_FIELD_RANGES[section][key] : undefined
  if (!range) return `${path}: unknown field`
  if (typeof value !== 'number' || !Number.isFinite(value)) return `${path}: must be a finite number`
  if (value < range[0] || value > range[1]) return `${path}: must be between ${range[0]} and ${range[1]}`
  return value
}

function parseSection(section: ButtonFaceSection, input: unknown, path: string, requireAll: boolean): Record<string, number> | string {
  if (!isDict(input)) return `${path}: must be an object`
  const output: Record<string, number> = {}
  for (const [key, value] of Object.entries(input)) {
    const parsed = parseNumber(section, key, value, `${path}.${key}`)
    if (typeof parsed === 'string') return parsed
    output[key] = parsed
  }
  if (requireAll) {
    for (const key of Object.keys(BUTTON_FACE_FIELD_RANGES[section])) {
      if (!(key in output)) return `${path}.${key}: is required`
    }
  }
  return output
}

export function parseButtonFaceTuningFile(input: unknown): ButtonFaceParseResult {
  if (!isDict(input)) return { ok: false, error: 'root must be an object' }
  for (const key of Object.keys(input)) {
    if (key !== 'engraving' && key !== 'label' && key !== 'perChannel') return { ok: false, error: `unknown key: ${key}` }
  }

  const sections = {} as Record<ButtonFaceSection, Record<string, number>>
  for (const section of SECTIONS) {
    const parsed = parseSection(section, input[section], section, true)
    if (typeof parsed === 'string') return { ok: false, error: parsed }
    sections[section] = parsed
  }

  const perChannelInput = input.perChannel ?? {}
  if (!isDict(perChannelInput)) return { ok: false, error: 'perChannel: must be an object' }
  const perChannel: ButtonFaceTuningFile['perChannel'] = {}
  for (const [channel, override] of Object.entries(perChannelInput)) {
    const match = CHANNEL_PATTERN.exec(channel)
    if (!match || Number(match[1]) > 15) return { ok: false, error: `perChannel.${channel}: invalid channel id` }
    if (!isDict(override)) return { ok: false, error: `perChannel.${channel}: must be an object` }
    const normalized: Partial<Record<ButtonFaceSection, Record<string, number>>> = {}
    for (const key of Object.keys(override)) {
      const section = SECTIONS.find((candidate) => candidate === key)
      if (!section) return { ok: false, error: `perChannel.${channel}: unknown key ${key}` }
      const parsed = parseSection(section, override[key], `perChannel.${channel}.${key}`, false)
      if (typeof parsed === 'string') return { ok: false, error: parsed }
      if (Object.keys(parsed).length > 0) normalized[section] = parsed
    }
    if (Object.keys(normalized).length > 0) perChannel[channel as `ch${number}`] = normalized as ButtonFaceOverride
  }

  return { ok: true, value: { engraving: sections.engraving, label: sections.label, perChannel } as unknown as ButtonFaceTuningFile }
}
