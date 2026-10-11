import { useEffect, useState } from 'react'
import { DEFAULT_SETTING_MODE, SETTING_MODE_STORAGE_KEY, parseSettingMode, type SettingMode } from '../config/settingMode'

function getInitialSettingMode(): SettingMode {
  try {
    return parseSettingMode(localStorage.getItem(SETTING_MODE_STORAGE_KEY))
  } catch {
    // Storage may be unavailable in restricted browser contexts.
    return DEFAULT_SETTING_MODE
  }
}

export function useSettingMode() {
  const [settingMode, setSettingMode] = useState<SettingMode>(getInitialSettingMode)

  useEffect(() => {
    try {
      localStorage.setItem(SETTING_MODE_STORAGE_KEY, settingMode)
    } catch {
      // Mode switching still works for this session if storage is unavailable.
    }
  }, [settingMode])

  return { settingMode, setSettingMode }
}
