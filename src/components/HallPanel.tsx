import type { ReactNode } from 'react'
import type { MouseEvent } from 'react'
import { useRef, useState } from 'react'
import type { DeviceConfig, HallChannel, HallSetting } from '../device'
import { HALL_LABELS } from '../config/constants'
import { ControllerDisplay } from './ControllerDisplay'
import { SettingNumber, SettingSlider } from './SettingControls'
import { ChevronRight, Zap } from 'lucide-react'
import { useLocale } from '../useLocale'
import type { HallTravelReading } from '../hooks/useHallTravel'
import { STROKE_MAX_MM, STROKE_MIN_MM, STROKE_STEP_MM, type StrokeSource } from '../config/strokeProfiles'
import { millimetersToRatio, POSITION_STEP_MM, ratioToMillimeters, rawToTravelMillimeters } from '../utils/calibrationMath'
import { MeterThresholdHandle } from './MeterThresholdHandle'

interface HallPanelProps {
  config: DeviceConfig
  savedConfig: DeviceConfig
  activeButton: HallChannel
  selectedButtons: ReadonlyArray<HallChannel>
  hall: HallSetting
  travelReading: HallTravelReading
  strokeMm: number
  strokeLabel: string
  strokeSource: StrokeSource
  showStrokeEditor: boolean
  unsupportedDevice: boolean
  onStrokeChange: (strokeMm: number) => void
  onStrokeReset: () => void
  isDemo: boolean
  calibrationStarting: boolean
  calibrationBlocked: boolean
  onSelect: (id: HallChannel, event?: MouseEvent<HTMLButtonElement>) => void
  onSelectAll: () => void
  onChange: (buttons: ReadonlyArray<HallChannel>, patch: Partial<HallSetting>) => void
  calibrationAvailable: boolean
  onStartCalibration: () => void
  calibrationPanel: ReactNode
  actuationMax: number
}

export function HallPanel({ config, savedConfig, activeButton, selectedButtons, hall, travelReading, strokeMm, strokeLabel, strokeSource, showStrokeEditor, unsupportedDevice, onStrokeChange, onStrokeReset, isDemo, calibrationStarting, calibrationBlocked, onSelect, onSelectAll, onChange, calibrationAvailable, onStartCalibration, calibrationPanel, actuationMax }: HallPanelProps) {
  const { t } = useLocale()
  const meterTrackRef = useRef<HTMLDivElement>(null)
  const [dragPreview, setDragPreview] = useState<{ field: 'press' | 'release', value: number } | null>(null)
  const travel = (travelReading.status === 'ready' || travelReading.status === 'stale') && travelReading.voltage !== null
    ? rawToTravelMillimeters(travelReading.voltage, hall.idle, hall.pressed, hall.calibrated, strokeMm)
    : null
  const settingPositionMm = (ratio: number) => Math.max(POSITION_STEP_MM, Math.min(strokeMm, ratioToMillimeters(ratio, strokeMm)))
  const displayedPress = dragPreview?.field === 'press' ? dragPreview.value : settingPositionMm(hall.pressRatio)
  const displayedRelease = dragPreview?.field === 'release' ? dragPreview.value : settingPositionMm(hall.releaseRatio)
  const actuationPosition = Math.max(0, Math.min(100, displayedPress / strokeMm * 100))
  const thresholdPosition = hall.rapidTrigger ? Math.max(0, Math.min(100, displayedRelease / strokeMm * 100)) : null
  const restrictedActuationStart = actuationMax < strokeMm ? actuationMax / strokeMm * 100 : null
  const updateActuation = (value: number) => onChange(selectedButtons, { pressRatio: millimetersToRatio(Math.max(POSITION_STEP_MM, Math.min(actuationMax, value)), strokeMm) })
  const signalLabel = isDemo
    ? t('Demo signal · no hardware reading')
      : travelReading.status === 'ready' ? t('Live signal')
        : travelReading.status === 'stale' ? t('Temporary signal interruption')
      : travelReading.status === 'reading' ? t('Reading live signal...')
        : travelReading.status === 'error' ? t('ADC29 reading unavailable')
          : t('Waiting for live signal')
  return <div className="hall-stack">
    <div className="hall-layout">
      <div className="hall-preview">
        <div className="panel-topline"><span>{t('KEY SELECTOR · ADC29')}</span><span className={`live-chip meter-signal ${travelReading.status}`}><span />{signalLabel}</span></div>
        <ControllerDisplay config={config} savedConfig={savedConfig} activeButton={activeButton} selectedButtons={selectedButtons} onSelect={onSelect} />
        <div className="selection-toolbar"><button className="text-button" onClick={onSelectAll}>{t('Select all')}</button><span>{t('{{count}} selected', { count: selectedButtons.length })}</span></div>
        <div className="travel-meter">
          <div className="meter-label"><span>{t('{{channel}} · {{label}} estimated travel', { channel: activeButton.toUpperCase(), label: HALL_LABELS[activeButton] })}</span><strong>{travel === null ? '—' : `${travel.toFixed(2)} mm`}</strong></div>
          {showStrokeEditor && <div className="meter-stroke-setting">
            <label htmlFor="stroke-length">{t('Full stroke length')}</label>
            <span>{t('Stroke: {{value}} mm ({{label}})', { value: strokeMm.toFixed(1), label: strokeSource === 'custom' ? `${strokeLabel} · ${t('Custom')}` : strokeLabel })}</span>
            <input id="stroke-length" aria-label={t('Full stroke length in mm')} type="number" min={STROKE_MIN_MM} max={STROKE_MAX_MM} step={STROKE_STEP_MM} value={strokeMm.toFixed(1)} onChange={(event) => {
              const value = event.currentTarget.valueAsNumber
              if (event.currentTarget.validity.valid && Number.isFinite(value)) onStrokeChange(value)
            }} />
            {strokeSource === 'custom' && <button type="button" className="text-button" onClick={onStrokeReset}>{t('Use device preset')}</button>}
          </div>}
          {unsupportedDevice && !showStrokeEditor && <p className="meter-note meter-error">{t('This device is not supported in Standard mode. Please use Expert mode.')}</p>}
          <div className="meter-control-track">
            <div ref={meterTrackRef} className={`meter-track ${travel === null ? 'unavailable' : ''} ${travelReading.status === 'stale' ? 'stale' : ''}`} role="meter" aria-valuemin={0} aria-valuemax={strokeMm} aria-valuenow={travel ?? undefined} aria-valuetext={travel === null ? undefined : `${travel.toFixed(2)} mm${travelReading.status === 'stale' ? ` · ${t('Previous reading')}` : ''}`} aria-label={t('{{channel}} estimated travel', { channel: activeButton.toUpperCase() })}>
              {restrictedActuationStart !== null && <div className="meter-restricted-zone" style={{ left: `${restrictedActuationStart}%` }} title={t('Actuation point above {{value}} mm requires Expert mode', { value: actuationMax.toFixed(2) })} />}
              {travel !== null && <div className="meter-fill" style={{ width: `${travel / strokeMm * 100}%` }} />}
            </div>
            <div className="meter-handle-layer">
              <MeterThresholdHandle
                trackRef={meterTrackRef}
                sessionKey={`${activeButton}:${selectedButtons.join(',')}:${hall.rapidTrigger}`}
                strokeMm={strokeMm}
                value={settingPositionMm(hall.pressRatio)}
                displayValue={displayedPress}
                label={t('Actuation point setting: {{value}} mm', { value: displayedPress.toFixed(2) })}
                className="actuation"
                style={{ left: `${actuationPosition}%` }}
                max={actuationMax}
                onPreview={(value) => setDragPreview(value === null ? null : { field: 'press', value })}
                onCommit={updateActuation}
              />
              {thresholdPosition !== null && <MeterThresholdHandle
                trackRef={meterTrackRef}
                sessionKey={`${activeButton}:${selectedButtons.join(',')}:${hall.rapidTrigger}`}
                strokeMm={strokeMm}
                value={settingPositionMm(hall.releaseRatio)}
                displayValue={displayedRelease}
                label={t('Rapid Trigger threshold setting: {{value}} mm', { value: displayedRelease.toFixed(2) })}
                className="threshold"
                style={{ left: `${thresholdPosition}%` }}
                onPreview={(value) => setDragPreview(value === null ? null : { field: 'release', value })}
                onCommit={(value) => onChange(selectedButtons, { releaseRatio: millimetersToRatio(value, strokeMm) })}
              />}
            </div>
          </div>
          <div className="meter-scale"><span>0.0</span><span>{(strokeMm / 2).toFixed(1)}</span><span>{strokeMm.toFixed(1)} mm</span></div>
          <div className="meter-legend">
            <span><i className="actuation-key" />{t('Actuation point setting')} <strong>{displayedPress.toFixed(2)} mm</strong></span>
            {hall.rapidTrigger && <span><i className="threshold-key" />{t('Rapid Trigger threshold setting')} <strong>{displayedRelease.toFixed(2)} mm</strong></span>}
          </div>
            {!isDemo && <p className="meter-note">{t('Drag a colored marker to adjust it. The setting is applied when you release it.')}</p>}
          <div className="meter-input-indicator">
            <span className="meter-input-caption">{t('Estimated key input')}</span>
            <strong className={`meter-input-state ${isDemo ? 'unknown' : travelReading.inputEstimate}`} role="status">{t(isDemo || travelReading.inputEstimate === 'unknown' ? 'Unknown' : travelReading.inputEstimate === 'on' ? 'Estimated ON' : 'Estimated OFF')}</strong>
          </div>
          {!isDemo && <p className="meter-note">{t('ON/OFF is estimated from sampled ADC values and draft settings, not the actual gamepad input. Unsaved changes are not active on the controller.')}</p>}
          {!isDemo && <p className="meter-note">{t('HTTP polling may cause the displayed travel to lag behind the physical switch movement.')}</p>}
          {selectedButtons.length > 1 && <p className="meter-note">{t('Showing active channel only: {{channel}}', { channel: activeButton.toUpperCase() })}</p>}
          {travelReading.status === 'stale' && <p className="meter-note">{t('Live reading temporarily unavailable; showing the last successful value.')}</p>}
          {isDemo && <p className="meter-note">{t('Demo mode does not provide a physical switch reading.')}</p>}
          {!isDemo && travelReading.status === 'error' && <p className="meter-note meter-error">{t('Check ADC29 support and the controller connection.')}</p>}
          {travelReading.status === 'ready' && travel === null && <p className="meter-note meter-error">{t('Travel is unavailable until this channel has valid calibration.')}</p>}
        </div>
      </div>
      <div className="hall-editor">
        <div className="selected-label">{t('EDITING')}{selectedButtons.length > 1 ? t('· {{count}} CHANNELS', { count: selectedButtons.length }) : ''}</div>
        <h2>{activeButton.toUpperCase()} <span>· {HALL_LABELS[activeButton]}</span></h2>
        <SettingSlider label={t('Actuation point')} value={displayedPress} max={actuationMax} onChange={updateActuation} />
        {hall.rapidTrigger && <SettingSlider label={t('Rapid Trigger Threshold')} value={displayedRelease} max={strokeMm} onChange={(value) => onChange(selectedButtons, { releaseRatio: millimetersToRatio(value, strokeMm) })} />}
        {hall.rapidTrigger && <SettingNumber label={t('Rapid Trigger Noise Filter')} value={hall.noise} min={0} max={4095} onChange={(value) => onChange(selectedButtons, { noise: value })} />}
        <label className="toggle-row"><span><strong>{t('Rapid Trigger')}</strong><small>{t('Reset as soon as the key moves upward')}</small></span><input aria-label={t('Rapid Trigger')} type="checkbox" checked={hall.rapidTrigger} onChange={(event) => onChange(selectedButtons, { rapidTrigger: event.target.checked })} /><span className="toggle" /></label>
        <button className="calibrate-button" onClick={onStartCalibration} disabled={!calibrationAvailable || calibrationStarting || calibrationBlocked}>{t(calibrationStarting ? 'Waiting for live read to finish...' : calibrationBlocked ? 'Reconnect device before calibrating' : 'Calibrate all Hall buttons')} <ChevronRight size={16} /></button>
        {!calibrationAvailable && <p className="calibration-unavailable">{t('Live calibration is disabled until firmware supports ADC29 voltage reads.')}</p>}
        {calibrationBlocked && <p className="calibration-unavailable">{t('Calibration is blocked because a live request timed out. Reconnect the controller first.')}</p>}
      </div>
    </div>
    {calibrationPanel}
  </div>
}
