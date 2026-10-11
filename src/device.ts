import { invoke } from '@tauri-apps/api/core'
import { millimetersToRaw, rawToMillimeters } from './utils/calibrationMath'

export type Action = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'B1' | 'B2' | 'B3' | 'B4' | 'L1' | 'R1' | 'L2' | 'R2' | 'L3' | 'R3' | 'S1' | 'S2' | 'A1' | 'A2' | 'A3' | 'A4' | 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6' | 'E7' | 'E8' | 'E9' | 'E10' | 'E11' | 'E12' | 'NONE'

export type HallChannel = `ch${number}`
export type GpioPin = `gp${0 | 1 | 2 | 3 | 4 | 5}`
export type GpioAssignment = Action | 'TURBO_B1' | 'TURBO_B2' | 'TURBO_B3' | 'TURBO_B4' | 'MACRO_1' | 'MACRO_2' | 'MACRO_3' | 'MACRO_4' | 'ACCELERATOR' | 'BRAKE' | 'HOME' | 'MENU_DOWN' | 'MENU_SELECT' | 'MENU_BACK' | 'FN'
export type KeyboardAction = 'Up' | 'Down' | 'Left' | 'Right' | 'B1' | 'B2' | 'B3' | 'B4' | 'L1' | 'R1' | 'L2' | 'R2' | 'S1' | 'S2' | 'L3' | 'R3' | 'A1' | 'A2' | 'A3' | 'A4' | 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6' | 'E7' | 'E8' | 'E9' | 'E10' | 'E11' | 'E12'

export interface InputModeConfig {
  inputMode: number
  inputDeviceType: number
  ps4AuthType: number
  ps5AuthType: number
  xinputAuthType: number
  ps4ControllerIDMode: number
  switchTpShareForDs4: boolean
  usbDescOverride: boolean
  usbDescProduct: string
  usbDescManufacturer: string
  usbDescVersion: string
  usbOverrideID: boolean
  usbVendorID: string
  usbProductID: string
}

export type KeyboardMappings = Record<KeyboardAction, number>

export function keyboardActionFor(action: Action | GpioAssignment): KeyboardAction | null {
  if (action === 'NONE' || action.startsWith('TURBO_') || action.startsWith('MACRO_') || ['ACCELERATOR', 'BRAKE', 'HOME', 'MENU_DOWN', 'MENU_SELECT', 'MENU_BACK', 'FN'].includes(action)) return null
  if (action === 'UP') return 'Up'
  if (action === 'DOWN') return 'Down'
  if (action === 'LEFT') return 'Left'
  if (action === 'RIGHT') return 'Right'
  return action as KeyboardAction
}

export interface HallSetting {
  idle: number
  active: number
  pressed: number
  threshold: number
  noise: number
  polarity: 'N' | 'P'
  press: number
  release: number
  rapidTrigger: boolean
  calibrated: boolean
}

export interface DeviceConfig {
  hallMappings: Record<HallChannel, Action>
  gpioMappings: Record<GpioPin, GpioAssignment>
  hall: Record<HallChannel, HallSetting>
  inputMode: InputModeConfig
  keyboardMappings: KeyboardMappings
}

export interface HallCalibrationPatch {
  idle: number
  active: number
  pressed: number
  threshold: number
  polarity: 'N' | 'P'
}

export interface DeviceInfo {
  product: string
  firmware: string
  transport: 'mock' | 'http' | 'tauri'
}

export interface DeviceTransport {
  connect(): Promise<DeviceInfo>
  restartToGamepad(): Promise<void>
  readConfig(): Promise<DeviceConfig>
  supportsLiveHallCalibration(): boolean
  prepareHallCalibration(): Promise<void>
  readHallVoltage(channel: number, onAttempt?: (attempt: number) => void): Promise<number>
  readHallVoltageLive(channel: number): Promise<number>
  previewConfig(config: DeviceConfig): Promise<void>
  commitConfig(config: DeviceConfig): Promise<void>
  saveHallCalibration(patches: Partial<Record<HallChannel, HallCalibrationPatch>>): Promise<void>
  discardPreview(): Promise<void>
  disconnect(): Promise<void>
}

const hallChannels = Array.from({ length: 16 }, (_, index) => `ch${index}` as HallChannel)
const gpioPins: GpioPin[] = ['gp0', 'gp1', 'gp2', 'gp3', 'gp4', 'gp5']
const hallMappings: Record<HallChannel, Action> = {
  ch0: 'B2', ch1: 'R2', ch2: 'L2', ch3: 'B3', ch4: 'B4', ch5: 'R1', ch6: 'L1', ch7: 'S1',
  ch8: 'LEFT', ch9: 'DOWN', ch10: 'L3', ch11: 'UP', ch12: 'RIGHT', ch13: 'S2', ch14: 'B1', ch15: 'R3',
}
const gpioMappings: Record<GpioPin, GpioAssignment> = { gp0: 'S2', gp1: 'A1', gp2: 'MENU_DOWN', gp3: 'MENU_SELECT', gp4: 'MENU_BACK', gp5: 'FN' }
const defaultHallSetting = (channel: number): HallSetting => ({ idle: 2350, active: channel === 13 ? 2700 : 2450, pressed: 3100, threshold: 2800, noise: 30, polarity: 'N', press: 0.3, release: 0.8, rapidTrigger: true, calibrated: true })
const keyboardActions: KeyboardAction[] = ['Up', 'Down', 'Left', 'Right', 'B1', 'B2', 'B3', 'B4', 'L1', 'R1', 'L2', 'R2', 'S1', 'S2', 'L3', 'R3', 'A1', 'A2', 'A3', 'A4', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12']
const defaultKeyboardMappings = Object.fromEntries(keyboardActions.map((action) => [action, ({ Up: 26, Down: 22, Left: 4, Right: 7, B1: 11, B2: 13, B3: 28, B4: 24, L1: 18, R1: 15, L2: 12, R2: 14, S1: 42, S2: 40 } as Record<string, number>)[action] ?? 0])) as KeyboardMappings

export const defaultConfig: DeviceConfig = {
  hallMappings,
  gpioMappings,
  hall: Object.fromEntries(hallChannels.map((id, index) => [id, defaultHallSetting(index)])) as Record<HallChannel, HallSetting>,
  inputMode: { inputMode: 0, inputDeviceType: 0, ps4AuthType: 0, ps5AuthType: 0, xinputAuthType: 0, ps4ControllerIDMode: 0, switchTpShareForDs4: false, usbDescOverride: false, usbDescProduct: '', usbDescManufacturer: '', usbDescVersion: '', usbOverrideID: false, usbVendorID: '0000', usbProductID: '0000' },
  keyboardMappings: defaultKeyboardMappings,
}

const cloneConfig = (config: DeviceConfig): DeviceConfig => structuredClone(config)

export const gpioActionValues: Record<string, number> = {
  NONE: -10, UP: 1, DOWN: 2, LEFT: 3, RIGHT: 4, B1: 5, B2: 6, B3: 7, B4: 8,
  L1: 9, R1: 10, L2: 11, R2: 12, S1: 13, S2: 14, A1: 15, A2: 16, L3: 17, R3: 18, FN: 19,
  A3: 41, A4: 42, E1: 43, E2: 44, E3: 45, E4: 46, E5: 47, E6: 48, E7: 49, E8: 50, E9: 51, E10: 52, E11: 53, E12: 54,
  MENU_DOWN: 73, MENU_SELECT: 76, MENU_BACK: 77,
  TURBO_B1: 32, MACRO_1: 34, MACRO_2: 35, MACRO_3: 36, MACRO_4: 37,
}

const actionFromGpioValue = (value: number): GpioAssignment => {
  const entry = Object.entries(gpioActionValues).find(([, numericValue]) => numericValue === value)
  if (!entry) throw new Error(`Unsupported GP2040 GPIO action: ${value}`)
  return entry[0] as GpioAssignment
}

const calibrationWait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
const jsonBoolean = (value: unknown): boolean => value === true || value === 1 || value === '1'

interface TauriDeviceApiResponse {
  status: number
  body: string
}

async function requestDeviceApi(path: string, method: string, body?: BodyInit | null): Promise<Response> {
  const payload = body == null
    ? undefined
    : typeof body === 'string'
      ? JSON.parse(body) as unknown
      : (() => { throw new Error('Tauri device requests only support JSON text bodies') })()
  const response = await invoke<TauriDeviceApiResponse>('device_request', {
    path,
    method,
    ...(payload === undefined ? {} : { body: payload }),
  })
  return new Response(response.body, { status: response.status })
}

export class MockTransport implements DeviceTransport {
  private config = cloneConfig(defaultConfig)
  private preview: DeviceConfig | null = null

  async connect(): Promise<DeviceInfo> {
    await new Promise((resolve) => setTimeout(resolve, 350))
    return { product: 'RapidJAM prototype', firmware: 'GP2040-CE 0.7.10', transport: 'mock' }
  }

  async restartToGamepad(): Promise<void> {}
  async readConfig(): Promise<DeviceConfig> { return cloneConfig(this.config) }
  supportsLiveHallCalibration(): boolean { return true }
  async prepareHallCalibration(): Promise<void> {}
  async readHallVoltage(channel: number): Promise<number> { return this.config.hall[`ch${channel}` as HallChannel].idle }
  async readHallVoltageLive(channel: number): Promise<number> { return this.config.hall[`ch${channel}` as HallChannel].idle }
  async previewConfig(config: DeviceConfig): Promise<void> { this.preview = cloneConfig(config) }
  async commitConfig(config: DeviceConfig): Promise<void> { this.config = cloneConfig(config); this.preview = null }
  async saveHallCalibration(patches: Partial<Record<HallChannel, HallCalibrationPatch>>): Promise<void> {
    Object.entries(patches).forEach(([id, patch]) => {
      if (!patch) return
      const current = this.config.hall[id as HallChannel]
      this.config.hall[id as HallChannel] = {
        ...current,
        ...patch,
        press: rawToMillimeters(patch.active, patch.idle, patch.pressed),
        release: rawToMillimeters(patch.threshold, patch.idle, patch.pressed),
        calibrated: patch.idle !== patch.pressed,
      }
    })
  }
  async discardPreview(): Promise<void> { this.preview = null }
  async disconnect(): Promise<void> { this.preview = null }
}

export class HttpTransport implements DeviceTransport {
  constructor(private readonly baseUrl: string, private readonly useTauri = false) {}

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const method = (options?.method ?? 'GET').toUpperCase()
    // Reads are safe to retry. Writes may already have reached the controller even when
    // the response is lost (for example, reboot drops RNDIS), so never replay a POST.
    const maxAttempts = method === 'GET' ? 3 : 1
    let lastError: Error | null = null
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.info(`[RapidJAM HTTP] ${method} ${url} (attempt ${attempt}/${maxAttempts})`)
      try {
        const response = this.useTauri
          ? await requestDeviceApi(path, method, options?.body)
          : await fetch(url, { ...options, method, headers: { 'Content-Type': 'application/json', ...options?.headers } })
        console.info(`[RapidJAM HTTP] ${response.status} ${method} ${url}`)
        if (!response.ok) throw new Error(`Device request failed (${response.status}) at ${url}`)
        const body = await response.text()
        try {
          return JSON.parse(body) as T
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error)
          console.error(`[RapidJAM HTTP] invalid JSON from ${url}: length=${body.length}, tail=${body.slice(-120)}`, error)
          throw new Error(`Invalid JSON from ${url}: ${detail}`)
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (attempt < maxAttempts) await calibrationWait(150)
      }
    }
    if (lastError?.message.includes('Cannot reach')) throw lastError
    throw new Error(lastError?.message ?? `Request failed: ${method} ${url}`)
  }

  async connect(): Promise<DeviceInfo> {
    const version = await this.request<{ version?: string }>('/api/getFirmwareVersion')
    return { product: 'RapidJAM', firmware: version.version ?? 'GP2040-CE', transport: this.useTauri ? 'tauri' : 'http' }
  }

  async restartToGamepad(): Promise<void> {
    await this.request('/api/reboot', { method: 'POST', body: JSON.stringify({ bootMode: 0 }) })
  }

  supportsLiveHallCalibration(): boolean { return true }

  async readConfig(): Promise<DeviceConfig> {
    const [pinMappings, calibrations, gamepadOptions, keyboardMappings] = await Promise.all([
      this.request<Record<string, { action: number, customButtonMask: number, customDpadMask: number }>>('/api/getPinMappings'),
      this.request<{ triggers: Array<{ action: number, idle: number, active: number, pressed: number, is_polarized: number, release: number, noise: number, rapidTrigger: number }> }>('/api/getHETriggerCalibrations'),
      this.request<Record<string, unknown>>('/api/getGamepadOptions'),
      this.request<Record<string, number>>('/api/getKeyMappings'),
    ])
    const next = cloneConfig(defaultConfig)
    for (let pin = 0; pin <= 5; pin++) {
      const mapping = pinMappings[`pin${String(pin).padStart(2, '0')}`]
      if (mapping) next.gpioMappings[`gp${pin}` as GpioPin] = actionFromGpioValue(mapping.action)
    }
    for (let channel = 0; channel < 16; channel++) {
      const trigger = calibrations.triggers[channel]
      if (!trigger) continue
      const id = `ch${channel}` as HallChannel
      next.hallMappings[id] = actionFromGpioValue(trigger.action) as Action
      next.hall[id] = {
        idle: trigger.idle,
        active: trigger.active,
        pressed: trigger.pressed,
        threshold: trigger.release,
        noise: trigger.noise,
        polarity: trigger.is_polarized ? 'P' : 'N',
        press: rawToMillimeters(trigger.active, trigger.idle, trigger.pressed),
        release: rawToMillimeters(trigger.release, trigger.idle, trigger.pressed),
        rapidTrigger: Boolean(trigger.rapidTrigger),
        calibrated: trigger.idle !== trigger.pressed,
      }
    }
    next.inputMode = {
      inputMode: Number(gamepadOptions.inputMode ?? next.inputMode.inputMode),
      inputDeviceType: Number(gamepadOptions.inputDeviceType ?? next.inputMode.inputDeviceType),
      ps4AuthType: Number(gamepadOptions.ps4AuthType ?? next.inputMode.ps4AuthType),
      ps5AuthType: Number(gamepadOptions.ps5AuthType ?? next.inputMode.ps5AuthType),
      xinputAuthType: Number(gamepadOptions.xinputAuthType ?? next.inputMode.xinputAuthType),
      ps4ControllerIDMode: Number(gamepadOptions.ps4ControllerIDMode ?? next.inputMode.ps4ControllerIDMode),
      switchTpShareForDs4: jsonBoolean(gamepadOptions.switchTpShareForDs4),
      usbDescOverride: jsonBoolean(gamepadOptions.usbDescOverride),
      usbDescProduct: String(gamepadOptions.usbDescProduct ?? ''),
      usbDescManufacturer: String(gamepadOptions.usbDescManufacturer ?? ''),
      usbDescVersion: String(gamepadOptions.usbDescVersion ?? ''),
      usbOverrideID: jsonBoolean(gamepadOptions.usbOverrideID),
      usbVendorID: String(gamepadOptions.usbVendorID ?? '0000'),
      usbProductID: String(gamepadOptions.usbProductID ?? '0000'),
    }
    Object.keys(next.keyboardMappings).forEach((key) => {
      if (typeof keyboardMappings[key] === 'number') next.keyboardMappings[key as KeyboardAction] = keyboardMappings[key]
    })
    return next
  }

  async prepareHallCalibration(): Promise<void> {
    await this.request('/api/setHETriggerOptions', {
      method: 'POST',
      body: JSON.stringify({
        muxChannels: 16,
        muxSelectPin0: 13,
        muxSelectPin1: 14,
        muxSelectPin2: 15,
        muxSelectPin3: 26,
        muxADCPin0: 29,
        muxADCPin1: -1,
        muxADCPin2: -1,
        muxADCPin3: -1,
        heTriggerSmoothing: true,
        heTriggerSmoothingFactor: 5,
      }),
    })
    await calibrationWait(1500)
  }

  async readHallVoltage(channel: number, onAttempt?: (attempt: number) => void): Promise<number> {
    let lastError: Error | null = null
    for (let attempt = 0; attempt < 30; attempt++) {
      onAttempt?.(attempt + 1)
      try {
        const result = await this.request<{ voltage?: number, error?: string }>('/api/getHETriggerVoltage', { method: 'POST', body: JSON.stringify({ targetId: channel }) })
        if (typeof result.voltage !== 'number') throw new Error(result.error ?? `No voltage returned for CH${channel}`)
        return result.voltage
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (attempt < 29) await calibrationWait(50)
      }
    }
    throw new Error(`CH${channel} voltage read failed after 30 attempts: ${lastError?.message ?? 'unknown error'}`)
  }

  async readHallVoltageLive(channel: number): Promise<number> {
    const controller = this.useTauri ? undefined : new AbortController()
    let timedOut = false
    const timeout = controller ? setTimeout(() => { timedOut = true; controller.abort() }, 8000) : undefined
    try {
      const result = await this.request<{ voltage?: number, error?: string }>('/api/getHETriggerVoltage', {
        method: 'POST',
        body: JSON.stringify({ targetId: channel }),
        ...(controller ? { signal: controller.signal } : {}),
      })
      if (typeof result.voltage !== 'number' || !Number.isFinite(result.voltage)) {
        throw new Error(result.error ?? `No voltage returned for CH${channel}`)
      }
      return result.voltage
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      if (timedOut || /timed?\s*out|timeout/i.test(detail)) {
        const timeoutError = new Error('Live Hall voltage read timed out; reconnect before starting calibration')
        timeoutError.name = 'LiveHallReadTimeoutError'
        throw timeoutError
      }
      throw error
    } finally {
      if (timeout !== undefined) clearTimeout(timeout)
    }
  }

  async previewConfig(): Promise<void> {}

  async commitConfig(config: DeviceConfig): Promise<void> {
    const pinMappings = await this.request<Record<string, { action: number, customButtonMask: number, customDpadMask: number }>>('/api/getPinMappings')
    for (let pin = 0; pin <= 5; pin++) {
      const assignment = config.gpioMappings[`gp${pin}` as GpioPin]
      const action = gpioActionValues[assignment]
      if (action === undefined) throw new Error(`${assignment} is not supported by the GP2040 GPIO API`)
      const key = `pin${String(pin).padStart(2, '0')}`
      pinMappings[key] = { action, customButtonMask: pinMappings[key]?.customButtonMask ?? 0, customDpadMask: pinMappings[key]?.customDpadMask ?? 0 }
    }
    await this.request('/api/setPinMappings', { method: 'POST', body: JSON.stringify(pinMappings) })

    const calibrationResponse = await this.request<{ triggers: Array<Record<string, number>> }>('/api/getHETriggerCalibrations')
    const triggers = calibrationResponse.triggers
    for (let channel = 0; channel < 16; channel++) {
      const id = `ch${channel}` as HallChannel
      const setting = config.hall[id]
      const existing = triggers[channel] ?? {}
      triggers[channel] = {
        ...existing,
        action: gpioActionValues[config.hallMappings[id]],
        idle: setting.idle,
        active: millimetersToRaw(setting.press, setting.idle, setting.pressed),
        pressed: setting.pressed,
        is_polarized: setting.polarity === 'P' ? 1 : 0,
        release: millimetersToRaw(setting.release, setting.idle, setting.pressed),
        noise: setting.noise,
        rapidTrigger: setting.rapidTrigger ? 1 : 0,
      }
    }
    await this.request('/api/setHETriggerCalibrations', { method: 'POST', body: JSON.stringify({ triggers }) })

    await this.request('/api/setKeyMappings', {
      method: 'POST',
      body: JSON.stringify(config.keyboardMappings),
    })

    const gamepadOptions = await this.request<Record<string, unknown>>('/api/getGamepadOptions')
    const inputMode = config.inputMode
    const gamepadPatch = {
      ...gamepadOptions,
      inputMode: inputMode.inputMode,
      inputDeviceType: inputMode.inputDeviceType,
      ps4AuthType: inputMode.ps4AuthType,
      ps5AuthType: inputMode.ps5AuthType,
      xinputAuthType: inputMode.xinputAuthType,
      ps4ControllerIDMode: inputMode.ps4ControllerIDMode,
      switchTpShareForDs4: inputMode.switchTpShareForDs4 ? 1 : 0,
      usbDescOverride: inputMode.usbDescOverride ? 1 : 0,
      usbDescProduct: inputMode.usbDescProduct,
      usbDescManufacturer: inputMode.usbDescManufacturer,
      usbDescVersion: inputMode.usbDescVersion,
      usbOverrideID: inputMode.usbOverrideID ? 1 : 0,
      usbVendorID: inputMode.usbVendorID,
      usbProductID: inputMode.usbProductID,
    }
    await this.request('/api/setGamepadOptions', { method: 'POST', body: JSON.stringify(gamepadPatch) })
  }
  async saveHallCalibration(patches: Partial<Record<HallChannel, HallCalibrationPatch>>): Promise<void> {
    const calibrationResponse = await this.request<{ triggers: Array<Record<string, number>> }>('/api/getHETriggerCalibrations')
    const triggers = calibrationResponse.triggers
    Object.entries(patches).forEach(([id, patch]) => {
      if (!patch) return
      const channel = Number(id.slice(2))
      const existing = triggers[channel] ?? {}
      triggers[channel] = {
        ...existing,
        idle: patch.idle,
        active: patch.active,
        pressed: patch.pressed,
        is_polarized: patch.polarity === 'P' ? 1 : 0,
        release: patch.threshold,
      }
    })
    await this.request('/api/setHETriggerCalibrations', { method: 'POST', body: JSON.stringify({ triggers }) })
  }
  async discardPreview(): Promise<void> {}
  async disconnect(): Promise<void> {}
}
