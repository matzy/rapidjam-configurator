export type Action = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'B1' | 'B2' | 'B3' | 'B4' | 'L1' | 'R1' | 'L2' | 'R2' | 'L3' | 'R3' | 'S1' | 'S2' | 'A1' | 'A2' | 'NONE'

export type HallChannel = `ch${number}`
export type GpioPin = `gp${0 | 1 | 2 | 3 | 4 | 5}`
export type GpioAssignment = Action | 'TURBO_B1' | 'TURBO_B2' | 'TURBO_B3' | 'TURBO_B4' | 'MACRO_1' | 'MACRO_2' | 'MACRO_3' | 'MACRO_4' | 'ACCELERATOR' | 'BRAKE' | 'HOME' | 'MENU_DOWN' | 'MENU_SELECT' | 'MENU_BACK' | 'FN'

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
}

export interface DeviceInfo {
  product: string
  firmware: string
  transport: 'mock' | 'http'
}

export interface DeviceTransport {
  connect(): Promise<DeviceInfo>
  restartToGamepad(): Promise<void>
  readConfig(): Promise<DeviceConfig>
  supportsLiveHallCalibration(): boolean
  prepareHallCalibration(): Promise<void>
  readHallVoltage(channel: number, onAttempt?: (attempt: number) => void): Promise<number>
  previewConfig(config: DeviceConfig): Promise<void>
  commitConfig(config: DeviceConfig): Promise<void>
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

export const defaultConfig: DeviceConfig = {
  hallMappings,
  gpioMappings,
  hall: Object.fromEntries(hallChannels.map((id, index) => [id, defaultHallSetting(index)])) as Record<HallChannel, HallSetting>,
}

const cloneConfig = (config: DeviceConfig): DeviceConfig => structuredClone(config)

const gpioActionValues: Record<string, number> = {
  NONE: -10, UP: 1, DOWN: 2, LEFT: 3, RIGHT: 4, B1: 5, B2: 6, B3: 7, B4: 8,
  L1: 9, R1: 10, L2: 11, R2: 12, S1: 13, S2: 14, A1: 15, A2: 16, L3: 17, R3: 18, FN: 19,
  MENU_DOWN: 73, MENU_SELECT: 76, MENU_BACK: 77,
  TURBO_B1: 32, MACRO_1: 34, MACRO_2: 35, MACRO_3: 36, MACRO_4: 37,
}

const actionFromGpioValue = (value: number): GpioAssignment => {
  const entry = Object.entries(gpioActionValues).find(([, numericValue]) => numericValue === value)
  if (!entry) throw new Error(`Unsupported GP2040 GPIO action: ${value}`)
  return entry[0] as GpioAssignment
}

const rawToMillimeters = (value: number, idle: number, pressed: number): number => Math.max(0.05, Math.min(1.5, ((value - idle) / Math.max(1, pressed - idle)) * 1.5))
const millimetersToRaw = (value: number, idle: number, pressed: number): number => Math.round(idle + (Math.max(0, Math.min(1.5, value)) / 1.5) * (pressed - idle))
const calibrationWait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

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
  async previewConfig(config: DeviceConfig): Promise<void> { this.preview = cloneConfig(config) }
  async commitConfig(config: DeviceConfig): Promise<void> { this.config = cloneConfig(config); this.preview = null }
  async discardPreview(): Promise<void> { this.preview = null }
  async disconnect(): Promise<void> { this.preview = null }
}

export class HttpTransport implements DeviceTransport {
  constructor(private readonly baseUrl: string) {}

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const method = options?.method ?? 'GET'
    console.info(`[RapidJAM HTTP] ${method} ${url}`)
    let response: Response
    try {
      response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } })
    } catch (error) {
      const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      console.error(`[RapidJAM HTTP] network failure ${method} ${url}`, error)
      throw new Error(`Cannot reach ${url}. ${detail}. Check WebConfig/RNDIS mode and the 192.168.7.1 route.`)
    }
    console.info(`[RapidJAM HTTP] ${response.status} ${method} ${url}`)
    if (!response.ok) throw new Error(`Device request failed (${response.status}) at ${url}`)
    return response.json() as Promise<T>
  }

  async connect(): Promise<DeviceInfo> {
    const version = await this.request<{ version?: string }>('/api/getFirmwareVersion')
    return { product: 'RapidJAM', firmware: version.version ?? 'GP2040-CE', transport: 'http' }
  }

  async restartToGamepad(): Promise<void> {
    await this.request('/api/reboot', { method: 'POST', body: JSON.stringify({ bootMode: 0 }) })
  }

  supportsLiveHallCalibration(): boolean { return true }

  async readConfig(): Promise<DeviceConfig> {
    const [pinMappings, calibrations] = await Promise.all([
      this.request<Record<string, { action: number, customButtonMask: number, customDpadMask: number }>>('/api/getPinMappings'),
      this.request<{ triggers: Array<{ action: number, idle: number, active: number, pressed: number, is_polarized: number, release: number, noise: number, rapidTrigger: number }> }>('/api/getHETriggerCalibrations'),
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
  }
  async discardPreview(): Promise<void> {}
  async disconnect(): Promise<void> {}
}
