import type { CalibrationAction } from '../types/calibration'
import { useLocale } from '../useLocale'

const GUIDE_LABEL: Record<Exclude<CalibrationAction, 'none'>, string> = {
  'hands-off': 'Do not touch the button',
  press: 'Press the button all the way down',
  hold: 'Hold the button down',
  release: 'Release the button',
}

// Oblique view of a round keycap sinking into its housing. The key group is animated in CSS (see .guide-key).
// The clip path hides the part of the key that is below the housing top, so it looks like it goes into a hole.
export function CalibrationActionGuide({ action }: { action: CalibrationAction }) {
  const { t } = useLocale()
  if (action === 'none') return null
  return <svg className={`calibration-action-guide guide-${action}`} viewBox="0 0 120 96" role="img" aria-label={t(GUIDE_LABEL[action])}>
    <defs>
      <clipPath id="guide-key-clip"><path d="M0,0 H120 V58 H88 A28,9 0 0 1 32,58 H0 Z" /></clipPath>
    </defs>
    <path className="guide-housing-wall" d="M24,58 V72 A36,11 0 0 0 96,72 V58 Z" />
    <ellipse className="guide-housing-top" cx="60" cy="58" rx="36" ry="11" />
    <ellipse className="guide-hole" cx="60" cy="58" rx="28" ry="9" />
    <g clipPath="url(#guide-key-clip)">
      <g className="guide-key">
        <path className="guide-key-wall" d="M32,34 V58 A28,9 0 0 0 88,58 V34 Z" />
        <ellipse className="guide-key-top" cx="60" cy="34" rx="28" ry="9" />
      </g>
    </g>
    {action === 'hands-off' && <g className="guide-cross"><line x1="104" y1="6" x2="116" y2="18" /><line x1="116" y1="6" x2="104" y2="18" /></g>}
    {action === 'release' && <g className="guide-arrow guide-arrow-up"><polygon points="52,14 68,14 60,2" /><line x1="60" y1="10" x2="60" y2="22" /></g>}
    {(action === 'press' || action === 'hold') && <g className="guide-arrow guide-arrow-down"><line x1="60" y1="0" x2="60" y2="16" /><polygon points="52,12 68,12 60,22" /></g>}
  </svg>
}
