export interface InputModeOption {
  value: number
  label: string
  group: 'PC / current' | 'console'
  deviceTypes?: number[]
  authFields?: Array<'xinputAuthType' | 'ps4AuthType' | 'ps5AuthType'>
  usbOverride?: boolean
}

export const INPUT_MODE_OPTIONS: InputModeOption[] = [
  { value: 0, label: 'XInput', group: 'PC / current', deviceTypes: [0, 1, 3, 4], authFields: ['xinputAuthType'], usbOverride: true },
  { value: 1, label: 'Nintendo Switch', group: 'console' },
  { value: 2, label: 'PS3', group: 'console', deviceTypes: [0, 1, 3, 4] },
  { value: 3, label: 'Keyboard', group: 'PC / current' },
  { value: 4, label: 'PS4', group: 'console', deviceTypes: [0, 1, 2, 3, 4], authFields: ['ps4AuthType'] },
  { value: 5, label: 'Xbox One', group: 'console' },
  { value: 12, label: 'Original Xbox', group: 'console' },
  { value: 13, label: 'PS5', group: 'console', deviceTypes: [0, 6, 1, 2, 3, 4], authFields: ['ps5AuthType'] },
  { value: 14, label: 'Generic HID', group: 'PC / current', usbOverride: true },
  { value: 15, label: 'Nintendo Switch Pro', group: 'console' },
  { value: 16, label: 'P5 General', group: 'console', authFields: ['ps5AuthType'] },
  { value: 17, label: 'SInput', group: 'PC / current' },
]

export const DEVICE_TYPE_OPTIONS = [
  { value: 0, label: 'Gamepad' },
  { value: 1, label: 'Wheel' },
  { value: 2, label: 'HOTAS' },
  { value: 3, label: 'Guitar' },
  { value: 4, label: 'Drums' },
  { value: 6, label: 'Arcade stick' },
]

export const AUTH_OPTIONS = [
  { value: 0, label: 'None' },
  { value: 1, label: 'Keys' },
  { value: 2, label: 'USB host' },
  { value: 3, label: 'I2C' },
]

export const keyboardLabels = ['Up', 'Down', 'Left', 'Right', 'B1', 'B2', 'B3', 'B4', 'L1', 'R1', 'L2', 'R2', 'S1', 'S2', 'L3', 'R3', 'A1', 'A2', 'A3', 'A4', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12'] as const
