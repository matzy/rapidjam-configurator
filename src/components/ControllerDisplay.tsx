import type { KeyboardEvent, MouseEvent } from 'react'
import { keyboardActionFor, type DeviceConfig } from '../device'
import type { CalibrationResults } from '../types/calibration'
import type { HallChannel } from '../device'
import { keyboardKeyLabel } from '../config/inputModes'
import { useLocale } from '../useLocale'
import { useButtonLabels } from '../useButtonLabels'
import { hardwareLabelText } from '../config/hardwareLabels'
import { buttonFaceStyle, resolveButtonFace } from '../config/buttonFaceTuning'
import { useButtonFaceTuning } from '../config/buttonFaceTuningContext'
import { getButtonFaceArt, getButtonFaceDocument } from '../config/buttonFaceArt'
import { ButtonFace, ControllerBody } from './ButtonFace'

const layout: HallChannel[] = ['ch7', 'ch6', 'ch5', 'ch4', 'ch3', 'ch2', 'ch8', 'ch9', 'ch11', 'ch12', 'ch14', 'ch0', 'ch1', 'ch15', 'ch10', 'ch13']

// Label box in SVG user units, centered on the label anchor.
const LABEL_WIDTH = 96
const LABEL_HEIGHT = 24

export interface SelectModifiers {
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}

interface ControllerDisplayProps {
  config: DeviceConfig
  savedConfig: DeviceConfig
  activeButton: HallChannel
  selectedButtons?: ReadonlyArray<HallChannel>
  onSelect: (id: HallChannel, event?: SelectModifiers) => void
  calibrationMode?: boolean
  calibrationResults?: CalibrationResults
  readingChannel?: number | null
  keyboardMode?: boolean
}

export function ControllerDisplay({ config, savedConfig, activeButton, selectedButtons = [], onSelect, calibrationMode = false, calibrationResults, readingChannel = null, keyboardMode = false }: ControllerDisplayProps) {
  const { t } = useLocale()
  const { actionLabel } = useButtonLabels()
  const { file: faceTuning } = useButtonFaceTuning()
  const doc = getButtonFaceDocument()
  if (!doc) return null
  return <div className="controller">
    <svg className="controller-svg" viewBox={`${doc.viewBox.x} ${doc.viewBox.y} ${doc.viewBox.width} ${doc.viewBox.height}`} role="group" aria-label="RAPIDJAM">
      <ControllerBody />
      {layout.map((id) => {
        const art = getButtonFaceArt(id)
        if (!art) return null
        const action = keyboardActionFor(config.hallMappings[id])
        const savedAction = keyboardActionFor(savedConfig.hallMappings[id])
        const changed = keyboardMode
          ? action !== savedAction || (action !== null && config.keyboardMappings[action] !== savedConfig.keyboardMappings[action])
          : config.hallMappings[id] !== savedConfig.hallMappings[id] || JSON.stringify(config.hall[id]) !== JSON.stringify(savedConfig.hall[id])
        const state = calibrationResults?.[id]?.status
        const reading = calibrationMode && readingChannel === Number(id.slice(2))
        const selected = selectedButtons.includes(id)
        const label = calibrationMode ? id.toUpperCase() : keyboardMode ? action === null ? actionLabel(config.hallMappings[id]) : t(keyboardKeyLabel(config.keyboardMappings[action])) : actionLabel(config.hallMappings[id])
        const engraving = hardwareLabelText(id)
        const labelTuning = resolveButtonFace(id, faceTuning).label
        const labelX = art.labelAnchor.x + labelTuning.offsetX - LABEL_WIDTH / 2
        const labelY = art.labelAnchor.y + labelTuning.offsetY - LABEL_HEIGHT / 2
        const classes = ['controller-key', `key-${id}`, activeButton === id ? 'active' : '', selected ? 'selected' : '', changed ? 'changed' : '', calibrationMode && state ? `calibration-${state}` : '', reading ? 'calibration-reading' : ''].filter(Boolean).join(' ')
        const select = (event: MouseEvent<SVGGElement> | KeyboardEvent<SVGGElement>) => onSelect(id, event)
        const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          onSelect(id, event)
        }
        return <g key={id} role="button" tabIndex={0} aria-label={`${id.toUpperCase()}${engraving ? ` · hardware engraving ${engraving}` : ''} · ${label}`} className={classes} style={buttonFaceStyle(id, faceTuning)} onClick={select} onKeyDown={onKeyDown}>
          <ButtonFace channel={id} />
          <foreignObject x={labelX} y={labelY} width={LABEL_WIDTH} height={LABEL_HEIGHT} pointerEvents="none" aria-hidden="true">
            <div className="controller-function-label">{label}</div>
          </foreignObject>
        </g>
      })}
    </svg>
  </div>
}
