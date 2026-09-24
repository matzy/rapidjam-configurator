import type { Action, GpioAssignment, GpioPin, HallChannel } from '../device'

export const HALL_LABELS: Record<HallChannel, string> = {
  ch0: 'B2', ch1: 'R2', ch2: 'L2', ch3: 'B3', ch4: 'B4', ch5: 'R1', ch6: 'L1', ch7: 'S1',
  ch8: 'LEFT', ch9: 'DOWN', ch10: 'L3', ch11: 'UP', ch12: 'RIGHT', ch13: 'S2', ch14: 'B1', ch15: 'R3',
}

export const GPIO_LABELS: Record<GpioPin, string> = { gp0: 'GP0', gp1: 'GP1', gp2: 'GP2', gp3: 'GP3', gp4: 'GP4', gp5: 'GP5' }

export const ACTIONS: Action[] = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'B1', 'B2', 'B3', 'B4', 'L1', 'R1', 'L2', 'R2', 'L3', 'R3', 'S1', 'S2', 'A1', 'A2', 'NONE']

export const GPIO_ASSIGNMENTS: Array<{ value: GpioAssignment, label: string }> = [
  ...ACTIONS.map((action) => ({ value: action, label: action === 'NONE' ? 'Unassigned' : action })),
  { value: 'TURBO_B1', label: 'Turbo · B1' }, { value: 'TURBO_B2', label: 'Turbo · B2' }, { value: 'TURBO_B3', label: 'Turbo · B3' }, { value: 'TURBO_B4', label: 'Turbo · B4' },
  { value: 'MACRO_1', label: 'Macro 1' }, { value: 'MACRO_2', label: 'Macro 2' }, { value: 'MACRO_3', label: 'Macro 3' }, { value: 'MACRO_4', label: 'Macro 4' },
  { value: 'ACCELERATOR', label: 'Accelerator' }, { value: 'BRAKE', label: 'Brake' }, { value: 'HOME', label: 'Home' }, { value: 'MENU_DOWN', label: 'Menu Down' }, { value: 'MENU_SELECT', label: 'Menu Select' }, { value: 'MENU_BACK', label: 'Menu Back' }, { value: 'FN', label: 'Function (Fn)' },
]

export const CALIBRATION_POLL_INTERVAL_MS = 250
export const CALIBRATION_BASELINE_WAIT_MS = 45
export const CALIBRATION_BASELINE_ROUNDS = 6
export const CALIBRATION_SAMPLE_TARGET = 3
export const CALIBRATION_PRESS_THRESHOLD = 150
export const CALIBRATION_VOLTAGE_READ_ATTEMPTS = 30
export const CALIBRATION_VOLTAGE_RETRY_INTERVAL_MS = 50
