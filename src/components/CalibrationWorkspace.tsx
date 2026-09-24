import { HALL_LABELS } from '../config/constants'
import type { DeviceConfig, HallChannel } from '../device'
import type { CalibrationProgress, CalibrationResults, CalibrationStage } from '../types/calibration'
import { ControllerDisplay } from './ControllerDisplay'

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
  const rows = Object.entries(results) as [HallChannel, CalibrationResults[HallChannel]][]
  const complete = rows.filter(([, result]) => result.status === 'complete' || result.status === 'skipped').length
  const failed = rows.filter(([, result]) => result.status === 'error')
  const title = stage === 'baseline' ? 'Measuring idle position' : stage === 'capture' ? `Press each button once · ${complete}/16 complete` : stage === 'review' ? 'Review calibration results' : 'Calibration error'

  return <div className={`calibration-workspace calibration-stage-${stage}`}>
    <div className="calibration-page-header"><div><p className="eyebrow">MAGNETIC INPUT / CALIBRATION</p><h1>{title}</h1><p className="lede">{stage === 'baseline' ? 'Leave all buttons untouched while every channel is measured.' : stage === 'capture' ? 'Yellow buttons need a press. Click yellow to skip or green to remeasure.' : 'Review the measured values before applying them to the draft.'}</p></div><button className="secondary-button" onClick={onCancel}>Cancel</button></div>
    <div className="calibration-live-status"><strong>{progress.phase}</strong><span>{progress.channel === null ? 'Preparing...' : `CH${progress.channel} · ${HALL_LABELS[`ch${progress.channel}` as HallChannel]}`}</span><span>Attempt {progress.attempt || '—'} / 30</span><span>{progress.successful} / {progress.total} complete</span></div>
    <div className="calibration-page-grid">
      <div className="preview-panel"><div className="panel-topline"><span>PHYSICAL PROGRESS · CH IDs</span></div><ControllerDisplay config={config} savedConfig={savedConfig} activeButton="ch14" calibrationMode calibrationResults={results} readingChannel={progress.channel} onSelect={onCircleClick} /><div className="calibration-progress"><strong>{complete} / 16 complete</strong><span>{failed.length ? `${failed.length} failed` : 'Blue = reading now · Yellow = skip · Green = complete'}</span></div></div>
      <div className="calibration-status-panel"><div className="selected-label">CHANNEL STATUS</div><div className="calibration-status-list">{rows.map(([id, result]) => <button key={id} className={`calibration-status-item ${result.status}`} onClick={() => onCircleClick(id)}><span>{id.toUpperCase()} · {HALL_LABELS[id]}</span><strong>{result.status}</strong><small>{result.attempt ? `Attempt ${result.attempt}/30` : result.sampleCount ? `${result.sampleCount} samples` : result.latestVoltage !== undefined ? `${result.latestVoltage} ADC` : result.error ?? '—'}</small></button>)}</div>{stage === 'capture' && <button className="secondary-button" onClick={onFinish}>Finish capture and review</button>}{stage === 'review' && <button className="primary-button" onClick={onApply}>Apply and save calibration</button>}</div>
    </div>
    <details className="calibration-results" open={stage === 'review'}><summary>Raw calibration results</summary><div className="calibration-table"><div className="calibration-row calibration-header"><span>CH</span><span>Button</span><span>Idle</span><span>Pressed</span><span>Span</span><span>Samples</span><span>Latest</span><span>Status</span></div>{rows.map(([id, result]) => <div className={`calibration-row ${result.status}`} key={id}><span>{id.toUpperCase()}</span><span>{HALL_LABELS[id]}</span><span>{result.idle}</span><span>{result.pressed ?? '—'}</span><span>{result.pressed === null ? '—' : Math.abs(result.pressed - result.idle)}</span><span>{result.sampleCount ?? 0}</span><span>{result.latestVoltage ?? '—'}</span><span>{result.error ?? result.status}</span></div>)}</div></details>
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
  if (stage === 'idle') return null
  const rows = results ? Object.entries(results) as [HallChannel, CalibrationResults[HallChannel]][] : []
  const complete = rows.filter(([, result]) => result.status === 'complete').length
  return <section className="calibration-panel"><div className="calibration-heading"><div><div className="selected-label">AUTOMATIC CALIBRATION</div><h2>{stage === 'baseline' ? 'Measuring idle position' : stage === 'capture' ? `Press each button once · ${complete}/16 complete` : stage === 'review' ? 'Review calibration results' : 'Calibration error'}</h2></div>{stage !== 'baseline' && <button className="text-button" onClick={onCancel}>Cancel</button>}</div>{stage === 'baseline' && <p className="calibration-instruction">Leave all Hall buttons untouched. The configurator is sampling every channel automatically.</p>}{stage === 'capture' && <><p className="calibration-instruction">Press each button fully once, in any order. Completed buttons turn green.</p><button className="secondary-button" onClick={onFinish}>Finish capture and review</button></>}{stage === 'review' && <button className="primary-button" onClick={onApply}>Apply and save calibration</button>}<details className="calibration-results" open={stage === 'review'}><summary>Calibration results</summary><div className="calibration-table"><div className="calibration-row calibration-header"><span>CH</span><span>Button</span><span>Idle</span><span>Pressed</span><span>Span</span><span>Polarity</span><span>Status</span></div>{rows.map(([id, result]) => <div className={`calibration-row ${result.status}`} key={id}><span>{id.toUpperCase()}</span><span>{HALL_LABELS[id]}</span><span>{result.idle}</span><span>{result.pressed ?? '—'}</span><span>{result.pressed === null ? '—' : Math.abs(result.pressed - result.idle)}</span><span>{result.polarity ?? '—'}</span><span>{result.status}</span></div>)}</div></details></section>
}
