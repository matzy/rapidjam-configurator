import { useEffect, useState } from 'react'
import type { DeviceConfig, DeviceInfo, DeviceTransport, GpioAssignment, GpioPin, HallCalibrationPatch, HallChannel, HallSetting } from '../device'
import { defaultConfig } from '../device'

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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to connect'
      setNotice(message)
      setDiagnostic(`${new Date().toLocaleTimeString()}  ${message}`)
      setConnectionFailed(true)
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
      const message = error instanceof Error ? error.message : 'Unable to restart RapidJAM'
      setNotice(message)
      setDiagnostic(`${new Date().toLocaleTimeString()}  ${message}`)
    } finally { setBusy(false) }
  }

  async function updateConfig(next: DeviceConfig) {
    setConfig(next)
    try {
      await transport.previewConfig(next)
      setNotice('Preview active on device')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Preview failed') }
  }

  function updateMapping(button: HallChannel, action: DeviceConfig['hallMappings'][HallChannel]) {
    void updateConfig({ ...config, hallMappings: { ...config.hallMappings, [button]: action } })
  }

  function updateHall(button: HallChannel, patch: Partial<HallSetting>) {
    void updateConfig({ ...config, hall: { ...config.hall, [button]: { ...config.hall[button], ...patch } } })
  }

  function updateGpio(button: GpioPin, action: GpioAssignment) {
    void updateConfig({ ...config, gpioMappings: { ...config.gpioMappings, [button]: action } })
  }

  async function save() {
    setBusy(true)
    try {
      await transport.commitConfig(config)
      const confirmed = await transport.readConfig()
      setConfig(confirmed)
      setSavedConfig(structuredClone(confirmed))
      setNotice('Saved to RapidJAM')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Save failed') }
    finally { setBusy(false) }
  }

  async function discard() {
    await transport.discardPreview()
    setConfig(structuredClone(savedConfig))
    setNotice('Changes discarded')
  }

  async function saveHallCalibration(patches: Partial<Record<HallChannel, HallCalibrationPatch>>, nextConfig: DeviceConfig) {
    setBusy(true)
    try {
      await transport.saveHallCalibration(patches)
      setConfig(nextConfig)
      setSavedConfig(structuredClone(nextConfig))
      setNotice('Calibration results saved to RapidJAM')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Calibration save failed')
      throw error
    } finally { setBusy(false) }
  }

  return { device, config, savedConfig, dirty, busy, notice, diagnostic, connectionFailed, restartComplete, setNotice, connect, restartToGamepad, updateConfig, updateMapping, updateHall, updateGpio, save, discard, saveHallCalibration }
}
