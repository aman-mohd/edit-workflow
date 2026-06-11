import Store from 'electron-store'
import type { AppSettings } from '@shared/types'

const ENCRYPTION_KEY = 'vid-edit-tool-enc-v1'

interface StoreSchema {
  settings: AppSettings
}

const DEFAULT_SETTINGS: AppSettings = {
  higgsfieldApiKey: '',
  higgsfieldApiKeySecret: '',
  outputDirectory: '',
  higgsfieldImageModelId: 'nano_banana_2',
  higgsfieldVideoModelId: 'seedance_2_0',
}

export class StoreService {
  private readonly store: Store<StoreSchema>

  constructor() {
    this.store = new Store<StoreSchema>({
      name: 'app-config',
      encryptionKey: ENCRYPTION_KEY,
      defaults: { settings: DEFAULT_SETTINGS },
    })
  }

  getSettings(): AppSettings {
    return { ...DEFAULT_SETTINGS, ...this.store.get('settings') }
  }

  setSettings(settings: AppSettings): void {
    this.store.set('settings', settings)
  }
}
