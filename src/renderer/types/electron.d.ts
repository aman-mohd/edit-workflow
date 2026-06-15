import type {
  AppSettings,
  PipelineInput,
  ProgressPayload,
  SceneImageReadyPayload,
  SceneVideoReadyPayload,
  PipelineCompletePayload,
  PipelineErrorPayload,
} from '../../shared/types'

declare global {
  interface Window {
    electronAPI: {
      getSettings: () => Promise<AppSettings>
      saveSettings: (settings: AppSettings) => Promise<void>
      startPipeline: (input: PipelineInput) => Promise<void>
      abortPipeline: () => Promise<void>
      openFolder: (dirPath: string) => Promise<void>
      onProgress: (cb: (payload: ProgressPayload) => void) => void
      onSceneImageReady: (cb: (payload: SceneImageReadyPayload) => void) => void
      onSceneVideoReady: (cb: (payload: SceneVideoReadyPayload) => void) => void
      onComplete: (cb: (payload: PipelineCompletePayload) => void) => void
      onError: (cb: (payload: PipelineErrorPayload) => void) => void
      removeAllListeners: (channel: string) => void
      getPathForFile: (file: File) => string
      testConnection: () => Promise<{ upload: string; generate: string }>
      cliLogin: () => Promise<void>
      cliLogout: () => Promise<void>
    }
  }
}
