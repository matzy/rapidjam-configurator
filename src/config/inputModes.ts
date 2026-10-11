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
  { value: 6, label: 'Mega Drive / Genesis Mini', group: 'console' },
  { value: 7, label: 'NEOGEO mini', group: 'console' },
  { value: 8, label: 'PC Engine mini', group: 'console' },
  { value: 9, label: 'Egret II mini', group: 'console' },
  { value: 10, label: 'Astro City mini', group: 'console' },
  { value: 11, label: 'PlayStation Classic', group: 'console' },
  { value: 12, label: 'Original Xbox', group: 'console' },
  { value: 13, label: 'PS5', group: 'console', deviceTypes: [0, 6, 1, 2, 3, 4], authFields: ['ps5AuthType'] },
  { value: 14, label: 'Generic HID', group: 'PC / current', usbOverride: true },
  { value: 15, label: 'Nintendo Switch Pro', group: 'console' },
  { value: 16, label: 'P5 General', group: 'console', authFields: ['ps5AuthType'] },
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

export const KEY_CODES = [
  { label: 'None', value: 0x00 },
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((label, index) => ({ label, value: 0x04 + index })),
  ...['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((label, index) => ({ label, value: 0x1e + index })),
  { label: 'Enter', value: 0x28 }, { label: 'Escape', value: 0x29 }, { label: 'Backspace', value: 0x2a }, { label: 'Tab', value: 0x2b }, { label: 'Space', value: 0x2c },
  { label: 'Minus', value: 0x2d }, { label: 'Equal', value: 0x2e }, { label: 'Bracket Left', value: 0x2f }, { label: 'Bracket Right', value: 0x30 }, { label: 'Backslash', value: 0x31 }, { label: 'Intl Hash', value: 0x32 }, { label: 'Semicolon', value: 0x33 }, { label: 'Quote', value: 0x34 }, { label: 'Backquote', value: 0x35 }, { label: 'Comma', value: 0x36 }, { label: 'Period', value: 0x37 }, { label: 'Slash', value: 0x38 }, { label: 'CapsLock', value: 0x39 },
  ...Array.from({ length: 12 }, (_, index) => ({ label: `F${index + 1}`, value: 0x3a + index })),
  { label: 'Print Screen', value: 0x46 }, { label: 'Scroll Lock', value: 0x47 }, { label: 'Pause', value: 0x48 }, { label: 'Insert', value: 0x49 }, { label: 'Home', value: 0x4a }, { label: 'Page Up', value: 0x4b }, { label: 'Delete', value: 0x4c }, { label: 'End', value: 0x4d }, { label: 'Page Down', value: 0x4e },
  { label: 'Arrow Right', value: 0x4f }, { label: 'Arrow Left', value: 0x50 }, { label: 'Arrow Down', value: 0x51 }, { label: 'Arrow Up', value: 0x52 }, { label: 'NumLock', value: 0x53 }, { label: 'Numpad Slash', value: 0x54 }, { label: 'Numpad Asterisk', value: 0x55 }, { label: 'Numpad Minus', value: 0x56 }, { label: 'Numpad Plus', value: 0x57 }, { label: 'Numpad Enter', value: 0x58 },
  ...['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((label, index) => ({ label: `Numpad ${label}`, value: 0x59 + index })),
  { label: 'Numpad Period', value: 0x63 }, { label: 'Intl Backslash', value: 0x64 }, { label: 'Numpad Equals', value: 0x67 },
  ...Array.from({ length: 12 }, (_, index) => ({ label: `F${index + 13}`, value: 0x68 + index })),
  { label: 'Control Left', value: 0xe0 }, { label: 'Shift Left', value: 0xe1 }, { label: 'Alt Left', value: 0xe2 }, { label: 'Meta Left', value: 0xe3 }, { label: 'Control Right', value: 0xe4 }, { label: 'Shift Right', value: 0xe5 }, { label: 'Alt Right', value: 0xe6 }, { label: 'Meta Right', value: 0xe7 },
  { label: 'Next Track', value: 0xe8 }, { label: 'Prev Track', value: 0xe9 }, { label: 'Stop', value: 0xf0 }, { label: 'Play/Pause', value: 0xf1 }, { label: 'Mute', value: 0xf2 }, { label: 'Volume Up', value: 0xf3 }, { label: 'Volume Down', value: 0xf4 },
]

export function keyboardKeyLabel(value: number): string {
  return KEY_CODES.find((key) => key.value === value)?.label ?? `Unknown (0x${value.toString(16).padStart(2, '0').toUpperCase()})`
}
