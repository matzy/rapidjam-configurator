import type { Action, GpioAssignment, GpioPin } from '../device'
import type { TranslationValues } from '../i18nContext'

export const GPIO_LABELS: Record<GpioPin, string> = { gp0: 'GP0', gp1: 'GP1', gp2: 'GP2', gp3: 'GP3', gp4: 'GP4', gp5: 'GP5' }

export const ACTIONS: Action[] = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'B1', 'B2', 'B3', 'B4', 'L1', 'R1', 'L2', 'R2', 'L3', 'R3', 'S1', 'S2', 'A1', 'A2', 'NONE']

export const GPIO_ASSIGNMENTS: GpioAssignment[] = [
  ...ACTIONS,
  'TURBO_B1', 'TURBO_B2', 'TURBO_B3', 'TURBO_B4',
  'MACRO_1', 'MACRO_2', 'MACRO_3', 'MACRO_4',
  'ACCELERATOR', 'BRAKE', 'HOME', 'MENU_DOWN', 'MENU_SELECT', 'MENU_BACK', 'FN',
]

const GPIO_SPECIAL_LABELS: Partial<Record<GpioAssignment, string>> = {
  NONE: 'Unassigned',
  MACRO_1: 'Macro 1', MACRO_2: 'Macro 2', MACRO_3: 'Macro 3', MACRO_4: 'Macro 4',
  ACCELERATOR: 'Accelerator', BRAKE: 'Brake', HOME: 'Home', MENU_DOWN: 'Menu Down', MENU_SELECT: 'Menu Select', MENU_BACK: 'Menu Back', FN: 'Function (Fn)',
}

export function gpioAssignmentLabel(assignment: GpioAssignment, actionLabel: (action: Action) => string, t: (text: string, values?: TranslationValues) => string): string {
  if (assignment.startsWith('TURBO_')) return t('Turbo · {{button}}', { button: actionLabel(assignment.slice('TURBO_'.length) as Action) })
  const special = GPIO_SPECIAL_LABELS[assignment]
  return special ? t(special) : actionLabel(assignment as Action)
}

export const CALIBRATION_POLL_INTERVAL_MS = 250
export const CALIBRATION_BASELINE_WAIT_MS = 45
export const CALIBRATION_BASELINE_ROUNDS = 8
export const CALIBRATION_SAMPLE_TARGET = 5
export const CALIBRATION_PRESS_SAMPLE_INTERVAL_MS = 100
export const CALIBRATION_PRESS_THRESHOLD = 150
export const CALIBRATION_PRESS_CYCLES = 3
export const CALIBRATION_MAX_PRESS_CYCLES = 5
export const CALIBRATION_PRESS_SPREAD_LIMIT = 0.08
export const CALIBRATION_RELEASE_SETTLE_MS = 150
export const CALIBRATION_RELEASE_IDLE_SAMPLES = 3
export const CALIBRATION_FOCUS_TIMEOUT_MS = 10000
export const CALIBRATION_VOLTAGE_READ_ATTEMPTS = 30
export const CALIBRATION_VOLTAGE_RETRY_INTERVAL_MS = 50
