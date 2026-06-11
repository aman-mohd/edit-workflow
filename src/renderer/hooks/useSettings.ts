import { useState, useEffect } from 'react'
import type { AppSettings } from '../../shared/types'

const EMPTY_SETTINGS: AppSettings = {
  higgsfieldApiKey: '',
  higgsfieldApiKeySecret: '',
  outputDirectory: '',
  higgsfieldImageModelId: 'nano_banana_2',
  higgsfieldVideoModelId: 'seedance_2_0',
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(EMPTY_SETTINGS)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.electronAPI.getSettings().then(setSettings)
  }, [])

  const saveSettings = async (next: AppSettings) => {
    await window.electronAPI.saveSettings(next)
    setSettings(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return { settings, setSettings, saveSettings, saved }
}
