import type { ReactNode } from 'react'
import type { MouseEvent } from 'react'
import type { DeviceConfig, HallChannel, HallSetting } from '../device'
import { HALL_LABELS } from '../config/constants'
import { ControllerDisplay } from './ControllerDisplay'
import { SettingNumber, SettingSlider } from './SettingControls'
import { ChevronRight, Zap } from 'lucide-react'
import { useLocale } from '../useLocale'

interface HallPanelProps {
  config: DeviceConfig
  savedConfig: DeviceConfig
  activeButton: HallChannel
  selectedButtons: ReadonlyArray<HallChannel>
  hall: HallSetting
  onSelect: (id: HallChannel, event?: MouseEvent<HTMLButtonElement>) => void
  onSelectAll: () => void
  onChange: (buttons: ReadonlyArray<HallChannel>, patch: Partial<HallSetting>) => void
  calibrationAvailable: boolean
  onStartCalibration: () => void
  calibrationPanel: ReactNode
}

export function HallPanel({ config, savedConfig, activeButton, selectedButtons, hall, onSelect, onSelectAll, onChange, calibrationAvailable, onStartCalibration, calibrationPanel }: HallPanelProps) {
  const { t } = useLocale()
  return <div className="hall-stack">
    <div className="hall-layout">
      <div className="hall-preview">
        <div className="panel-topline"><span>{t('KEY SELECTOR · ADC29')}</span><span className="live-chip"><span />{t('Live signal')}</span></div>
        <ControllerDisplay config={config} savedConfig={savedConfig} activeButton={activeButton} selectedButtons={selectedButtons} onSelect={onSelect} />
        <div className="selection-toolbar"><button className="text-button" onClick={onSelectAll}>{t('Select all')}</button><span>{t('{{count}} selected', { count: selectedButtons.length })}</span></div>
        <div className="travel-meter"><div className="meter-label"><span>{t('{{channel}} · {{label}} travel', { channel: activeButton.toUpperCase(), label: HALL_LABELS[activeButton] })}</span><strong>{hall.press.toFixed(2)} mm</strong></div><div className="meter-track"><div style={{ width: `${Math.min(100, hall.press / 1.5 * 100)}%` }} /></div><div className="meter-scale"><span>0.0</span><span>0.75</span><span>1.5 mm</span></div></div>
      </div>
      <div className="hall-editor"><div className="selected-label">{t('EDITING')}{selectedButtons.length > 1 ? t('· {{count}} CHANNELS', { count: selectedButtons.length }) : ''}</div><h2>{activeButton.toUpperCase()} <span>· {HALL_LABELS[activeButton]}</span></h2><SettingSlider label={t('Actuation point')} value={hall.press} onChange={(value) => onChange(selectedButtons, { press: value })} /><SettingSlider label={t(hall.rapidTrigger ? 'Rapid Trigger Threshold' : 'Release point')} value={hall.release} onChange={(value) => onChange(selectedButtons, { release: value })} />{hall.rapidTrigger && <SettingNumber label={t('Rapid Trigger Noise Filter')} value={hall.noise} min={0} max={4095} onChange={(value) => onChange(selectedButtons, { noise: value })} />}<label className="toggle-row"><span><strong>{t('Rapid Trigger')}</strong><small>{t('Reset as soon as the key moves upward')}</small></span><input aria-label={t('Rapid Trigger')} type="checkbox" checked={hall.rapidTrigger} onChange={(event) => onChange(selectedButtons, { rapidTrigger: event.target.checked })} /><span className="toggle" /></label><button className="calibrate-button" onClick={onStartCalibration} disabled={!calibrationAvailable}>{t('Calibrate all Hall buttons')} <ChevronRight size={16} /></button>{!calibrationAvailable && <p className="calibration-unavailable">{t('Live calibration is disabled until firmware supports ADC29 voltage reads.')}</p>}</div>
    </div>
    {calibrationPanel}
  </div>
}
