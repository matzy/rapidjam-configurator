import type { Action, KeyboardAction } from '../device'

type ButtonAction = Extract<Action, 'B1' | 'B2' | 'B3' | 'B4' | 'L1' | 'R1' | 'L2' | 'R2' | 'L3' | 'R3' | 'S1' | 'S2' | 'A1' | 'A2'>
type Direction = Extract<Action, 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'>
export type ButtonLabelAction = Action | KeyboardAction

export interface ButtonLabel {
  label: string
  unused: boolean
}

type ModeLabels = Partial<Record<ButtonAction, string>>

const XINPUT_LABELS: ModeLabels = {
  B1: 'A', B2: 'B', B3: 'X', B4: 'Y',
  L1: 'LB', R1: 'RB', L2: 'LT', R2: 'RT', L3: 'LS', R3: 'RS',
  S1: 'Back', S2: 'Start', A1: 'Guide',
}

const SWITCH_LABELS: ModeLabels = {
  B1: 'B', B2: 'A', B3: 'Y', B4: 'X',
  L1: 'L', R1: 'R', L2: 'ZL', R2: 'ZR', L3: 'LS', R3: 'RS',
  S1: '−', S2: '+', A1: 'Home', A2: 'Capture',
}

const PLAYSTATION_LABELS: ModeLabels = {
  B1: '✕', B2: '○', B3: '□', B4: '△',
  L1: 'L1', R1: 'R1', L2: 'L2', R2: 'R2', L3: 'L3', R3: 'R3',
  A1: 'PS',
}

const LABELS_BY_INPUT_MODE: Record<number, ModeLabels> = {
  0: XINPUT_LABELS,
  1: SWITCH_LABELS,
  2: { ...PLAYSTATION_LABELS, S1: 'Select', S2: 'Start', A2: 'Touchpad' },
  4: { ...PLAYSTATION_LABELS, S1: 'Share', S2: 'Options', A2: 'Touchpad' },
  5: { ...XINPUT_LABELS, S1: 'View', S2: 'Menu', A1: undefined },
  6: { B1: 'A', B2: 'B', B3: 'X', B4: 'Y', R1: 'Z', R2: 'C', S1: 'Mode', S2: 'Start' },
  7: { B1: 'B', B2: 'D', B3: 'A', B4: 'C', L1: 'L1', R1: 'R1', L2: 'L2', R2: 'R2', S1: 'Select', S2: 'Start', A1: 'Options' },
  8: { B1: 'I', B2: 'II', S1: 'Select', S2: 'Run' },
  9: { B1: 'A', B2: 'B', B3: 'D', B4: 'E', R1: 'F', R2: 'C', S1: 'Credit', S2: 'Start', A1: 'Menu' },
  10: { B1: 'A', B2: 'B', B3: 'D', B4: 'E', R1: 'F', R2: 'C', S1: 'Credit', S2: 'Start' },
  11: { ...PLAYSTATION_LABELS, L3: undefined, R3: undefined, S1: 'Start', S2: 'Select', A1: undefined },
  12: { ...XINPUT_LABELS, L1: 'White', R1: 'Black', S1: 'Back', S2: 'Start', A1: undefined },
  13: { ...PLAYSTATION_LABELS, S1: 'Create', S2: 'Options', A2: 'Touchpad' },
  14: XINPUT_LABELS,
  15: SWITCH_LABELS,
  16: { ...PLAYSTATION_LABELS, S1: 'Create', S2: 'Options', A2: 'Touchpad' },
}

const BUTTON_ACTIONS = new Set<ButtonAction>([
  'B1', 'B2', 'B3', 'B4', 'L1', 'R1', 'L2', 'R2', 'L3', 'R3', 'S1', 'S2', 'A1', 'A2',
])
const KEYBOARD_DIRECTIONS: Partial<Record<KeyboardAction, Direction>> = {
  Up: 'UP', Down: 'DOWN', Left: 'LEFT', Right: 'RIGHT',
}

function normalizeAction(action: ButtonLabelAction): Action {
  return KEYBOARD_DIRECTIONS[action as KeyboardAction] ?? action as Action
}

export function buttonLabel(inputMode: number, action: ButtonLabelAction, swapTouchpadShare = false): ButtonLabel {
  const normalized = normalizeAction(action)
  const labels = LABELS_BY_INPUT_MODE[inputMode] ?? XINPUT_LABELS

  if (!BUTTON_ACTIONS.has(normalized as ButtonAction)) {
    return { label: normalized, unused: false }
  }

  if ((inputMode === 4 || inputMode === 13 || inputMode === 16) && swapTouchpadShare) {
    if (normalized === 'S1') {
      return { label: 'Touchpad', unused: false }
    }
    if (normalized === 'A2') {
      return { label: inputMode === 13 || inputMode === 16 ? 'Create' : 'Share', unused: false }
    }
  }

  const label = labels[normalized as ButtonAction]
  return label === undefined
    ? { label: normalized, unused: true }
    : { label, unused: false }
}
