import { ipcMain, BrowserWindow, shell } from 'electron'
import { IPC_CHANNELS } from './channels'
import { StoreService } from '../services/StoreService'
import { HiggsfieldCLI } from '../services/HiggsfieldCLI'
import { PipelineOrchestrator } from '../services/PipelineOrchestrator'
import type {
  AppSettings,
  PipelineInput,
  ProgressPayload,
  SceneImageReadyPayload,
  SceneVideoReadyPayload,
  PipelineCompletePayload,
  PipelineErrorPayload,
} from '@shared/types'

export function registerIpcHandlers(win: BrowserWindow): void {
  const store = new StoreService()
  let activeOrchestrator: PipelineOrchestrator | null = null

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, (): AppSettings => {
    return store.getSettings()
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_e, settings: AppSettings): void => {
    store.setSettings(settings)
  })

  ipcMain.handle(IPC_CHANNELS.OPEN_FOLDER, async (_e, dirPath: string): Promise<void> => {
    await shell.openPath(dirPath)
  })

  ipcMain.handle(IPC_CHANNELS.PIPELINE_START, (_e, input: PipelineInput): void => {
    activeOrchestrator = new PipelineOrchestrator(store.getSettings(), {
      onProgress: (payload: ProgressPayload) =>
        win.webContents.send(IPC_CHANNELS.PIPELINE_PROGRESS, payload),
      onSceneImageReady: (payload: SceneImageReadyPayload) =>
        win.webContents.send(IPC_CHANNELS.SCENE_IMAGE_READY, payload),
      onSceneVideoReady: (payload: SceneVideoReadyPayload) =>
        win.webContents.send(IPC_CHANNELS.SCENE_VIDEO_READY, payload),
      onComplete: (payload: PipelineCompletePayload) =>
        win.webContents.send(IPC_CHANNELS.PIPELINE_COMPLETE, payload),
      onError: (payload: PipelineErrorPayload) =>
        win.webContents.send(IPC_CHANNELS.PIPELINE_ERROR, payload),
    })

    activeOrchestrator.run(input).catch(() => {
      // errors are forwarded via onError callback
    })
  })

  ipcMain.handle(IPC_CHANNELS.PIPELINE_ABORT, (): void => {
    activeOrchestrator?.abort()
    activeOrchestrator = null
  })

  ipcMain.handle(IPC_CHANNELS.CLI_LOGIN, async (): Promise<void> => {
    const cli = new HiggsfieldCLI()
    await cli.login()
  })

  ipcMain.handle(IPC_CHANNELS.CLI_LOGOUT, async (): Promise<void> => {
    const cli = new HiggsfieldCLI()
    await cli.logout()
  })

  ipcMain.handle(
    IPC_CHANNELS.TEST_CONNECTION,
    async (): Promise<{ upload: string; generate: string }> => {
      const cli = new HiggsfieldCLI()
      const result = await cli.checkInstalled()
      return {
        upload: result.ok ? `CLI found: ${result.version}` : `CLI not found: ${result.error}`,
        generate: result.ok ? 'Run "higgsfield auth login" in terminal if not logged in' : 'Install CLI first',
      }
    }
  )
}
