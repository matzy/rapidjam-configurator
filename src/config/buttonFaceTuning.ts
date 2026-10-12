import type { CSSProperties } from 'react'
import type { HallChannel } from '../device'

export interface EngravingTuning {
  /** SVG user units (px in the 565-wide artwork). */
  offsetX: number
  /** SVG user units (px in the 565-wide artwork). */
  offsetY: number
  /** Multiplier on the engraving size. */
  scale: number
  opacity: number
  /** Multiplier on the highlight and shadow strength, 0 to 1. */
  shadow: number
}

export interface LabelTuning {
  /** SVG user units, added to the label-anchor center. */
  offsetX: number
  /** SVG user units, added to the label-anchor center. */
  offsetY: number
  /** Pixels. */
  fontSize: number
  opacity: number
}

export interface ButtonFaceTuning {
  engraving: EngravingTuning
  label: LabelTuning
}

export interface ButtonFaceOverride {
  engraving?: Partial<EngravingTuning>
  label?: Partial<LabelTuning>
}

export interface ButtonFaceTuningFile extends ButtonFaceTuning {
  perChannel: Partial<Record<HallChannel, ButtonFaceOverride>>
}

export function resolveButtonFace(channel: HallChannel, file: ButtonFaceTuningFile): ButtonFaceTuning {
  const override = file.perChannel[channel]
  return {
    engraving: { ...file.engraving, ...override?.engraving },
    label: { ...file.label, ...override?.label },
  }
}

export function buttonFaceStyle(channel: HallChannel, file: ButtonFaceTuningFile): CSSProperties {
  const { engraving, label } = resolveButtonFace(channel, file)
  return {
    '--engraving-offset-x': `${engraving.offsetX}px`,
    '--engraving-offset-y': `${engraving.offsetY}px`,
    '--engraving-scale': String(engraving.scale),
    '--engraving-opacity': String(engraving.opacity),
    '--engraving-shadow': String(engraving.shadow),
    '--label-font-size': `${label.fontSize}px`,
    '--label-opacity': String(label.opacity),
  } as CSSProperties
}
