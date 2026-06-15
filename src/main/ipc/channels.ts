export const IPC_CHANNELS = {
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  PIPELINE_START: 'pipeline:start',
  PIPELINE_ABORT: 'pipeline:abort',
  OPEN_FOLDER: 'shell:openFolder',
  PIPELINE_PROGRESS: 'pipeline:progress',
  PIPELINE_COMPLETE: 'pipeline:complete',
  PIPELINE_ERROR: 'pipeline:error',
  SCENE_IMAGE_READY: 'scene:imageReady',
  SCENE_VIDEO_READY: 'scene:videoReady',
  TEST_CONNECTION: 'higgsfield:testConnection',
  CLI_LOGIN: 'higgsfield:cliLogin',
  CLI_LOGOUT: 'higgsfield:cliLogout',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
