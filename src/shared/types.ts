export interface AppSettings {
  higgsfieldApiKey: string
  higgsfieldApiKeySecret: string
  outputDirectory: string
  higgsfieldImageModelId: string
  higgsfieldVideoModelId: string
}

export interface PipelineInput {
  storyboardJson: string
  characterImagePaths: string[]
}

export type PipelineStage =
  | 'uploading_references'
  | 'generating_storyboard'
  | 'generating_image'
  | 'polling_image'
  | 'generating_video'
  | 'polling_video'
  | 'downloading'
  | 'complete'
  | 'error'

export type ProgressStatus = 'started' | 'in_progress' | 'done' | 'error'

export interface ProgressPayload {
  sceneId?: string
  stage: PipelineStage
  status: ProgressStatus
  message: string
}

export interface SceneData {
  id: string
  narration: string
  visual_description: string
  image_prompt: string
}

export interface Storyboard {
  title: string
  scenes: SceneData[]
}

export interface SceneImageReadyPayload {
  sceneId: string
  imagePath: string
}

export interface SceneVideoReadyPayload {
  sceneId: string
  videoPath: string
}

export interface PipelineCompletePayload {
  outputDir: string
}

export interface PipelineErrorPayload {
  message: string
}
