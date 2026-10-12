import { useEffect, useState } from 'react'
import type { DeviceConfig, DeviceInfo, DeviceTransport, GpioAssignment, GpioPin, HallCalibrationPatch, HallChannel, HallSetting, InputModeConfig } from '../device'
import { defaultConfig } from '../device'
import type { RawDeviceSnapshot } from '../transport/configPersistence.mjs'
import type { RestorePlan } from '../transport/settingsBackup.mjs'

export function useDeviceConfig(transport: DeviceTransport) {
  const [device, setDevice] = useState<DeviceInfo | null>(null)
  const [config, setConfig] = useState<DeviceConfig>(structuredClone(defaultConfig))
  const [savedConfig, setSavedConfig] = useState<DeviceConfig>(structuredClone(defaultConfig))
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [diagnostic, setDiagnostic] = useState('')
  const [connectionFailed, setConnectionFailed] = useState(false)
  const [restartComplete, setRestartComplete] = useState(false)

  const dirty = JSON.stringify(config) !== JSON.stringify(savedConfig)

  function recordDiagnostic(error: unknown) {
    const detail = error instanceof Error ? error.message : String(error)
    setDiagnostic(`${new Date().toLocaleTimeString()}  ${detail}`)
  }

  useEffect(() => { void connect() }, [])

  async function connect() {
    setBusy(true)
    try {
      const info = await transport.connect()
      const next = await transport.readConfig()
      setDevice(info)
      setConfig(next)
      setSavedConfig(structuredClone(next))
      setNotice('Ready to configure')
      setConnectionFailed(false)
      setRestartComplete(false)
      return true
    } catch (error) {
      recordDiagnostic(error)
      setNotice('Failed to connect to RapidJAM. Check the USB cable and WebConfig/RNDIS mode.')
      setConnectionFailed(true)
      return false
    } finally { setBusy(false) }
  }

  async function restartToGamepad() {
    setBusy(true)
    try {
      await transport.restartToGamepad()
      setDevice(null)
      setRestartComplete(true)
      setNotice('RapidJAM is restarting in gamepad mode')
    } catch (error) {
      recordDiagnostic(error)
      setNotice('Failed to restart RapidJAM.')
    } finally { setBusy(false) }
  }

  async function updateConfig(next: DeviceConfig) {
    setConfig(next)
    try {
      await transport.previewConfig(next)
      setNotice('Preview active on device')
    } catch (error) {
      recordDiagnostic(error)
      setNotice('Preview failed')
    }
  }

  function updateMapping(button: HallChannel, action: DeviceConfig['hallMappings'][HallChannel]) {
    void updateConfig({ ...config, hallMappings: { ...config.hallMappings, [button]: action } })
  }

  function updateHall(button: HallChannel, patch: Partial<HallSetting>) {
    void updateConfig({ ...config, hall: { ...config.hall, [button]: { ...config.hall[button], ...patch } } })
  }

  function updateHallMany(buttons: ReadonlyArray<HallChannel>, patch: Partial<HallSetting>) {
    if (!buttons.length) return
    const hall = { ...config.hall }
    buttons.forEach((button) => { hall[button] = { ...hall[button], ...patch } })
    void updateConfig({ ...config, hall })
  }

  function updateGpio(button: GpioPin, action: GpioAssignment) {
    void updateConfig({ ...config, gpioMappings: { ...config.gpioMappings, [button]: action } })
  }

  function updateInputMode(patch: Partial<InputModeConfig>) {
    void updateConfig({ ...config, inputMode: { ...config.inputMode, ...patch } })
  }

  function updateKeyboardMapping(action: keyof DeviceConfig['keyboardMappings'], key: number) {
    void updateConfig({ ...config, keyboardMappings: { ...config.keyboardMappings, [action]: key } })
  }

  async function save() {
    setBusy(true)
    try {
      await transport.commitConfig(config)
      const confirmed = await transport.readConfig()
      setConfig(confirmed)
      setSavedConfig(structuredClone(confirmed))
      setNotice('Saved to RapidJAM')
    } catch (error) {
      recordDiagnostic(error)
      setNotice('Failed to save configuration. Your changes are still available to retry.')
    }
    finally { setBusy(false) }
  }

  async function discard() {
    await transport.discardPreview()
    setConfig(structuredClone(savedConfig))
    setNotice('Changes discarded')
  }

  function readSettingsSnapshot(): Promise<RawDeviceSnapshot> {
    return transport.readRawSnapshot()
  }

  async function applySettingsRestore(plan: RestorePlan, baseline: RawDeviceSnapshot) {
    if (busy || !device || dirty) throw new Error('Restore is not available until pending changes are saved or discarded.')
    setBusy(true)
    try {
      const restored = await transport.restoreSettings(plan, baseline)
      setConfig(restored)
      setSavedConfig(structuredClone(restored))
      setNotice('Settings restored to RapidJAM')
    } catch (error) {
      recordDiagnostic(error)
      setNotice('Restore did not complete. Current device settings are shown.')
      try {
        const current = await transport.readConfig()
        setConfig(current)
        setSavedConfig(structuredClone(current))
      } catch (readError) {
        recordDiagnostic(readError)
      }
      throw error
    } finally { setBusy(false) }
  }

  async function saveHallCalibration(patches: Partial<Record<HallChannel, HallCalibrationPatch>>, nextConfig: DeviceConfig) {
    setBusy(true)
    try {
      await transport.saveHallCalibration(patches)
      setConfig(nextConfig)
      setSavedConfig(structuredClone(nextConfig))
      setNotice('Calibration results saved to RapidJAM')
    } catch (error) {
      recordDiagnostic(error)
      setNotice('Calibration save failed')
      throw error
    } finally { setBusy(false) }
  }

  return { device, config, savedConfig, dirty, busy, notice, diagnostic, connectionFailed, restartComplete, setNotice, connect, restartToGamepad, updateConfig, updateMapping, updateHall, updateHallMany, updateGpio, updateInputMode, updateKeyboardMapping, save, discard, saveHallCalibration, readSettingsSnapshot, applySettingsRestore }
}
