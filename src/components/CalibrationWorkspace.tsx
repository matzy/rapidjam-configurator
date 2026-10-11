import { hardwareLabelText } from '../config/hardwareLabels'
import type { DeviceConfig, HallChannel } from '../device'
import type { CalibrationProgress, CalibrationResults, CalibrationStage } from '../types/calibration'
import { ControllerDisplay } from './ControllerDisplay'
import { useLocale } from '../useLocale'

const CAPTURE_PRESS_HINT = 'Press all the way, just like you normally press the button. This calibrates to match how you actually play.'

interface CalibrationWorkspaceProps {
  config: DeviceConfig
  savedConfig: DeviceConfig
  stage: CalibrationStage
  results: CalibrationResults
  progress: CalibrationProgress
  onCircleClick: (channel: HallChannel) => void
  onFinish: () => void
  onApply: () => void
  onCancel: () => void
}

export function CalibrationWorkspace({ config, savedConfig, stage, results, progress, onCircleClick, onFinish, onApply, onCancel }: CalibrationWorkspaceProps) {
  const { t } = useLocale()
  const rows = Object.entries(results) as [HallChannel, CalibrationResults[HallChannel]][]
  const complete = rows.filter(([, result]) => result.status === 'complete' || result.status === 'skipped').length
  const failed = rows.filter(([, result]) => result.status === 'error')
  const title = stage === 'baseline' ? t('Measuring idle position') : stage === 'capture' ? t('Press each button once · {{complete}}/16 complete', { complete }) : stage === 'review' ? t('Review calibration results') : t('Calibration error')

  const progressChannel = progress.channel === null ? null : `ch${progress.channel}` as HallChannel
  const progressEngraving = progressChannel ? hardwareLabelText(progressChannel) : null

  return <div className={`calibration-workspace calibration-stage-${stage}`}>
    <div className="calibration-page-header"><div><p className="eyebrow">{t('MAGNETIC INPUT / CALIBRATION')}</p><h1>{title}</h1><p className="lede">{t(stage === 'baseline' ? 'Leave all buttons untouched while every channel is measured.' : stage === 'capture' ? 'Yellow buttons need a press. Click yellow to skip or green to remeasure.' : 'Review the measured values before applying them to the draft.')}</p>{stage === 'capture' && <p className="calibration-hint">{t(CAPTURE_PRESS_HINT)}</p>}</div><button className="secondary-button" onClick={onCancel}>{t('Cancel')}</button></div>
    <div className="calibration-live-status"><strong>{t(progress.phase)}</strong><span>{progress.channel === null ? t('Preparing...') : progressEngraving ? t('CH{{channel}} · {{label}}', { channel: progress.channel, label: progressEngraving }) : t('CH{{channel}}', { channel: progress.channel })}</span><span>{t('Attempt {{attempt}} / 30', { attempt: progress.attempt || '—' })}</span><span>{t('{{successful}} / {{total}} complete', { successful: progress.successful, total: progress.total })}</span></div>
    <div className="calibration-page-grid">
      <div className="preview-panel"><div className="panel-topline"><span>{t('PHYSICAL PROGRESS · CH IDs')}</span></div><ControllerDisplay config={config} savedConfig={savedConfig} activeButton="ch14" calibrationMode calibrationResults={results} readingChannel={progress.channel} onSelect={onCircleClick} /><div className="calibration-progress"><strong>{t('{{complete}} / 16 complete', { complete })}</strong><span>{failed.length ? t('{{failed}} failed', { failed: failed.length }) : t('Blue = reading now · Yellow = skip · Green = complete')}</span></div></div>
      <div className="calibration-status-panel"><div className="selected-label">{t('CHANNEL STATUS')}</div><div className="calibration-status-list">{rows.map(([id, result]) => { const engraving = hardwareLabelText(id); const label = engraving ? `${id.toUpperCase()} · ${engraving}` : id.toUpperCase(); return <button key={id} className={`calibration-status-item ${result.status}`} aria-label={`${label} · ${t(result.status)}`} onClick={() => onCircleClick(id)}><span>{label}</span><strong>{t(result.status)}</strong><small>{result.attempt ? t('Attempt {{attempt}}/30', { attempt: result.attempt }) : result.sampleCount ? t('{{count}} samples', { count: result.sampleCount }) : result.latestVoltage !== undefined ? `${result.latestVoltage} ADC` : result.error ? t(result.error) : '—'}</small></button> })}</div>{stage === 'capture' && <button className="secondary-button" onClick={onFinish}>{t('Finish capture and review')}</button>}{stage === 'review' && <button className="primary-button" onClick={onApply}>{t('Apply and save calibration')}</button>}</div>
    </div>
    <details className="calibration-results" open={stage === 'review'}><summary>{t('Raw calibration results')}</summary><div className="calibration-table"><div className="calibration-row calibration-header"><span>CH</span><span>{t('Engraving')}</span><span>{t('Idle')}</span><span>{t('Pressed')}</span><span>{t('Span')}</span><span>{t('Samples')}</span><span>{t('Latest')}</span><span>{t('Status')}</span></div>{rows.map(([id, result]) => <div className={`calibration-row ${result.status}`} key={id}><span>{id.toUpperCase()}</span><span>{hardwareLabelText(id) ?? '—'}</span><span>{result.idle}</span><span>{result.pressed ?? '—'}</span><span>{result.pressed === null ? '—' : Math.abs(result.pressed - result.idle)}</span><span>{result.sampleCount ?? 0}</span><span>{result.latestVoltage ?? '—'}</span><span>{result.error ? t(result.error) : t(result.status)}</span></div>)}</div></details>
  </div>
}

interface CalibrationPanelProps {
  stage: CalibrationStage
  results: CalibrationResults | null
  onFinish: () => void
  onApply: () => void
  onCancel: () => void
}

export function CalibrationPanel({ stage, results, onFinish, onApply, onCancel }: CalibrationPanelProps) {
  const { t } = useLocale()
  if (stage === 'idle') return null
  const rows = results ? Object.entries(results) as [HallChannel, CalibrationResults[HallChannel]][] : []
  const complete = rows.filter(([, result]) => result.status === 'complete').length
  return <section className="calibration-panel"><div className="calibration-heading"><div><div className="selected-label">{t('AUTOMATIC CALIBRATION')}</div><h2>{stage === 'baseline' ? t('Measuring idle position') : stage === 'capture' ? t('Press each button once · {{complete}}/16 complete', { complete }) : stage === 'review' ? t('Review calibration results') : t('Calibration error')}</h2></div>{stage !== 'baseline' && <button className="text-button" onClick={onCancel}>{t('Cancel')}</button>}</div>{stage === 'baseline' && <p className="calibration-instruction">{t('Leave all Hall buttons untouched. The configurator is sampling every channel automatically.')}</p>}{stage === 'capture' && <><p className="calibration-instruction">{t('Press each button fully once, in any order.')}</p><p className="calibration-hint">{t(CAPTURE_PRESS_HINT)}</p><button className="secondary-button" onClick={onFinish}>{t('Finish capture and review')}</button></>}{stage === 'review' && <button className="primary-button" onClick={onApply}>{t('Apply and save calibration')}</button>}<details className="calibration-results" open={stage === 'review'}><summary>{t('Calibration results')}</summary><div className="calibration-table"><div className="calibration-row calibration-header"><span>CH</span><span>{t('Engraving')}</span><span>{t('Idle')}</span><span>{t('Pressed')}</span><span>{t('Span')}</span><span>{t('Polarity')}</span><span>{t('Status')}</span></div>{rows.map(([id, result]) => <div className={`calibration-row ${result.status}`} key={id}><span>{id.toUpperCase()}</span><span>{hardwareLabelText(id) ?? '—'}</span><span>{result.idle}</span><span>{result.pressed ?? '—'}</span><span>{result.pressed === null ? '—' : Math.abs(result.pressed - result.idle)}</span><span>{result.polarity ?? '—'}</span><span>{t(result.status)}</span></div>)}</div></details></section>
}
