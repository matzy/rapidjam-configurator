import type { CalibrationAction } from '../types/calibration'
import { useLocale } from '../useLocale'

const GUIDE_LABEL: Record<Exclude<CalibrationAction, 'none'>, string> = {
  'hands-off': 'Do not touch the button',
  press: 'Press the button all the way down',
  hold: 'Hold the button down',
  release: 'Release the button',
}

// Oblique view of a keycap on its housing. The key group is animated in CSS (see .guide-key).
export function CalibrationActionGuide({ action }: { action: CalibrationAction }) {
  const { t } = useLocale()
  if (action === 'none') return null
  return <svg className={`calibration-action-guide guide-${action}`} viewBox="0 0 120 96" role="img" aria-label={t(GUIDE_LABEL[action])}>
    <g className="guide-housing">
      <polygon className="guide-housing-top" points="20,60 90,60 104,46 34,46" />
      <polygon className="guide-housing-front" points="20,60 90,60 90,74 20,74" />
      <polygon className="guide-housing-side" points="90,60 104,46 104,60 90,74" />
    </g>
    <g className="guide-key">
      <polygon className="guide-key-top" points="30,40 80,40 96,24 46,24" />
      <polygon className="guide-key-front" points="30,40 80,40 80,60 30,60" />
      <polygon className="guide-key-side" points="80,40 96,24 96,44 80,60" />
    </g>
    {action === 'hands-off' && <g className="guide-cross"><line x1="104" y1="6" x2="116" y2="18" /><line x1="116" y1="6" x2="104" y2="18" /></g>}
    {action === 'release' && <g className="guide-arrow guide-arrow-up"><polygon points="55,14 71,14 63,2" /><line x1="63" y1="10" x2="63" y2="22" /></g>}
    {(action === 'press' || action === 'hold') && <g className="guide-arrow guide-arrow-down"><line x1="63" y1="0" x2="63" y2="16" /><polygon points="55,12 71,12 63,22" /></g>}
  </svg>
}
