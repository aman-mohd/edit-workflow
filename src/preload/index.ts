import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC_CHANNELS } from '../main/ipc/channels'
import type {
  AppSettings,
  PipelineInput,
  ProgressPayload,
  SceneImageReadyPayload,
  SceneVideoReadyPayload,
  PipelineCompletePayload,
  PipelineErrorPayload,
} from '../shared/types'

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),

  saveSettings: (settings: AppSettings): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings),

  startPipeline: (input: PipelineInput): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.PIPELINE_START, input),

  abortPipeline: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.PIPELINE_ABORT),

  openFolder: (dirPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.OPEN_FOLDER, dirPath),

  onProgress: (cb: (payload: ProgressPayload) => void): void => {
    ipcRenderer.on(IPC_CHANNELS.PIPELINE_PROGRESS, (_e, p: ProgressPayload) => cb(p))
  },

  onSceneImageReady: (cb: (payload: SceneImageReadyPayload) => void): void => {
    ipcRenderer.on(IPC_CHANNELS.SCENE_IMAGE_READY, (_e, p: SceneImageReadyPayload) => cb(p))
  },

  onSceneVideoReady: (cb: (payload: SceneVideoReadyPayload) => void): void => {
    ipcRenderer.on(IPC_CHANNELS.SCENE_VIDEO_READY, (_e, p: SceneVideoReadyPayload) => cb(p))
  },

  onComplete: (cb: (payload: PipelineCompletePayload) => void): void => {
    ipcRenderer.on(IPC_CHANNELS.PIPELINE_COMPLETE, (_e, p: PipelineCompletePayload) => cb(p))
  },

  onError: (cb: (payload: PipelineErrorPayload) => void): void => {
    ipcRenderer.on(IPC_CHANNELS.PIPELINE_ERROR, (_e, p: PipelineErrorPayload) => cb(p))
  },

  removeAllListeners: (channel: string): void => {
    ipcRenderer.removeAllListeners(channel)
  },

  getPathForFile: (file: File): string => webUtils.getPathForFile(file),

  testConnection: (): Promise<{ upload: string; generate: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.TEST_CONNECTION),

  cliLogin: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.CLI_LOGIN),
})
