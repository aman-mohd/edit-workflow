import * as path from 'node:path'
import { HiggsfieldCLI } from './HiggsfieldCLI'
import { FileService } from './FileService'
import type {
  AppSettings,
  PipelineInput,
  SceneData,
  Storyboard,
  ProgressPayload,
  SceneImageReadyPayload,
  SceneVideoReadyPayload,
  PipelineCompletePayload,
  PipelineErrorPayload,
} from '@shared/types'

export interface PipelineCallbacks {
  onProgress: (payload: ProgressPayload) => void
  onSceneImageReady: (payload: SceneImageReadyPayload) => void
  onSceneVideoReady: (payload: SceneVideoReadyPayload) => void
  onComplete: (payload: PipelineCompletePayload) => void
  onError: (payload: PipelineErrorPayload) => void
}

export class PipelineOrchestrator {
  private abortFlag = false
  private readonly cli: HiggsfieldCLI
  private readonly files: FileService

  constructor(
    private readonly settings: AppSettings,
    private readonly callbacks: PipelineCallbacks
  ) {
    this.cli = new HiggsfieldCLI()
    this.files = new FileService()
  }

  abort(): void {
    this.abortFlag = true
  }

  async run(input: PipelineInput): Promise<void> {
    try {
      await this.execute(input)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.callbacks.onError({ message })
    }
  }

  private async execute(input: PipelineInput): Promise<void> {
    // 1. Parse storyboard JSON
    this.emit('generating_storyboard', 'started', 'Parsing storyboard...')
    let storyboard: Storyboard
    try {
      storyboard = JSON.parse(input.storyboardJson) as Storyboard
    } catch {
      throw new Error('Invalid storyboard JSON — please check the format and try again')
    }
    if (!storyboard.scenes?.length) {
      throw new Error('Storyboard has no scenes')
    }
    this.emit(
      'generating_storyboard',
      'done',
      `Storyboard ready — ${storyboard.scenes.length} scenes`
    )

    this.checkAbort()

    // 2. Create output directory + write storyboard JSON
    const projectDir = await this.files.createProjectDir(
      this.settings.outputDirectory,
      storyboard.title
    )
    await this.files.writeJson(path.join(projectDir, 'storyboard.json'), storyboard)

    // 3. Process each scene sequentially
    for (const scene of storyboard.scenes) {
      this.checkAbort()
      await this.processScene(scene, input.characterImagePaths, projectDir)
    }

    this.callbacks.onComplete({ outputDir: projectDir })
  }

  private async processScene(
    scene: SceneData,
    referenceImagePaths: string[],
    projectDir: string
  ): Promise<void> {
    const { id } = scene

    // --- IMAGE ---
    this.emitScene(id, 'generating_image', 'started', `${id}: generating image via CLI...`)
    const imageUrl = await this.cli.generateImage({
      prompt: scene.image_prompt,
      modelId: this.settings.higgsfieldImageModelId,
      referenceImagePaths,
      aspectRatio: '9:16',
      resolution: '1k',
    })

    this.emitScene(id, 'downloading', 'in_progress', `${id}: downloading image`)
    const imagePath = path.join(projectDir, `${id}_image.jpg`)
    await this.files.downloadFile(imageUrl, imagePath)
    this.callbacks.onSceneImageReady({ sceneId: id, imagePath })
    this.emitScene(id, 'generating_image', 'done', `${id}: image saved`)

    this.checkAbort()

    // --- VIDEO (pass the downloaded image file directly to CLI) ---
    this.emitScene(id, 'generating_video', 'in_progress', `${id}: generating video via CLI...`)
    const videoUrl = await this.cli.generateVideo({
      imageFilePath: imagePath,
      prompt: scene.image_prompt,
      modelId: this.settings.higgsfieldVideoModelId,
      aspectRatio: '9:16',
      duration: 5,
      resolution: '720p',
    })

    this.emitScene(id, 'downloading', 'in_progress', `${id}: downloading video`)
    const videoPath = path.join(projectDir, `${id}_video.mp4`)
    await this.files.downloadFile(videoUrl, videoPath)
    this.callbacks.onSceneVideoReady({ sceneId: id, videoPath })
    this.emitScene(id, 'generating_video', 'done', `${id}: video saved`)
  }

  private emit(
    stage: ProgressPayload['stage'],
    status: ProgressPayload['status'],
    message: string
  ): void {
    this.callbacks.onProgress({ stage, status, message })
  }

  private emitScene(
    sceneId: string,
    stage: ProgressPayload['stage'],
    status: ProgressPayload['status'],
    message: string
  ): void {
    this.callbacks.onProgress({ sceneId, stage, status, message })
  }

  private checkAbort(): void {
    if (this.abortFlag) {
      throw new Error('Pipeline aborted by user')
    }
  }
}
