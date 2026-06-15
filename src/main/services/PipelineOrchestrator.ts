import * as path from 'node:path'
import * as fs from 'node:fs'
import { HiggsfieldCLI } from './HiggsfieldCLI'
import { FileService } from './FileService'
import { findImageModel, findVideoModel } from '@shared/models'
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

// Maps lowercased character name → absolute image path
// e.g. "/path/John.jpg" → { "john": "/path/John.jpg" }
function buildCharacterMap(imagePaths: string[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const p of imagePaths) {
    if (fs.existsSync(p)) {
      const name = path.basename(p, path.extname(p)).toLowerCase().trim()
      map.set(name, p)
    }
  }
  return map
}

// Returns the subset of image paths relevant to a scene's character list.
// Falls back to all images if the scene has no characters specified.
function resolveSceneImages(
  scene: { characters?: string[] },
  characterMap: Map<string, string>,
  allImagePaths: string[]
): string[] {
  if (!scene.characters?.length || characterMap.size === 0) return allImagePaths
  const matched = scene.characters
    .map((name) => characterMap.get(name.toLowerCase().trim()))
    .filter((p): p is string => p !== undefined)
  return matched.length > 0 ? matched : allImagePaths
}

// Rewrites prompt to enforce character consistency with reference images.
// If references exist, strips appearance details and appends instruction to match them.
function rewritePromptForConsistency(
  prompt: string,
  sceneCharacters: string[] | undefined,
  characterMap: Map<string, string>
): string {
  if (!sceneCharacters?.length) return prompt

  // Check if any characters have references
  const withReferences = sceneCharacters.filter((c) =>
    characterMap.has(c.toLowerCase().trim())
  )
  if (withReferences.length === 0) return prompt

  // Strip appearance details (patterns: hair, skin tone, build, clothing, etc.)
  let rewritten = prompt
    .replace(
      /\b(hair|skin tone|skin|build|athletic|tall|short|stocky|clothing|jacket|shirt|jeans|shoes|coat|pants|dress|vest|eyes|facial|features|complexion|appearance|wears|wear|dressed|brown hair|blonde|black hair)\b[^.]*?(?=[.;,]|$)/gi,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim()

  // Append reference instruction
  const names = withReferences.join(' and ')
  rewritten += ` Character(s) ${names} appearance must match the provided reference images exactly.`

  return rewritten
}

export interface PipelineCallbacks {
  onProgress: (payload: ProgressPayload) => void
  onSceneImageReady: (payload: SceneImageReadyPayload) => void
  onSceneVideoReady: (payload: SceneVideoReadyPayload) => void
  onComplete: (payload: PipelineCompletePayload) => void
  onError: (payload: PipelineErrorPayload) => void
}

export class PipelineOrchestrator {
  private abortFlag = false
  private projectDir: string | null = null
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
      this.callbacks.onError({ message, outputDir: this.projectDir ?? undefined })
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

    // 2. Get model definitions and build final params (defaults + overrides)
    const imageModel = findImageModel(this.settings.higgsfieldImageModelId)
    const videoModel = findVideoModel(this.settings.higgsfieldVideoModelId)

    if (!imageModel) {
      throw new Error(`Image model not found: ${this.settings.higgsfieldImageModelId}`)
    }
    if (!videoModel) {
      throw new Error(`Video model not found: ${this.settings.higgsfieldVideoModelId}`)
    }

    const imageParams = { ...imageModel.payload, ...input.imageModelParams }
    const videoParams = { ...videoModel.payload, ...input.videoModelParams }

    // 3. Reuse existing dir on retry, otherwise create a new one
    const projectDir = input.retryFromDir
      ?? await this.files.createProjectDir(this.settings.outputDirectory, storyboard.title)
    this.projectDir = projectDir

    if (!input.retryFromDir) {
      await this.files.writeJson(path.join(projectDir, 'storyboard.json'), storyboard)
    }

    // 4. Build character → image path map from uploaded filenames
    const characterMap = buildCharacterMap(input.characterImagePaths)

    // 5. Process each scene sequentially, skipping already-completed ones on retry
    for (const scene of storyboard.scenes) {
      this.checkAbort()

      const imagePath = path.join(projectDir, `${scene.id}_image.jpg`)
      const videoPath = path.join(projectDir, `${scene.id}_video.mp4`)

      if (fs.existsSync(imagePath) && fs.existsSync(videoPath)) {
        // Scene already completed in a previous run — restore UI state and skip
        this.callbacks.onSceneImageReady({ sceneId: scene.id, imagePath })
        this.callbacks.onSceneVideoReady({ sceneId: scene.id, videoPath })
        this.emitScene(scene.id, 'complete', 'done', `${scene.id}: already completed`)
        continue
      }

      const sceneImages = resolveSceneImages(scene, characterMap, input.characterImagePaths)
      await this.processScene(scene, sceneImages, projectDir, characterMap, imageParams, videoParams)
    }

    this.callbacks.onComplete({ outputDir: projectDir })
  }

  private async processScene(
    scene: SceneData,
    referenceImagePaths: string[],
    projectDir: string,
    characterMap: Map<string, string>,
    imageParams: Record<string, unknown>,
    videoParams: Record<string, unknown>
  ): Promise<void> {
    const { id } = scene
    const imagePath = path.join(projectDir, `${id}_image.jpg`)
    const videoPath = path.join(projectDir, `${id}_video.mp4`)

    // --- IMAGE (skip if already downloaded from a partial retry) ---
    if (!fs.existsSync(imagePath)) {
      this.emitScene(id, 'generating_image', 'started', `${id}: generating image via CLI...`)
      const finalPrompt = rewritePromptForConsistency(scene.image_prompt, scene.characters, characterMap)
      const imageUrl = await this.cli.generateImage({
        prompt: finalPrompt,
        modelId: this.settings.higgsfieldImageModelId,
        referenceImagePaths,
        extraParams: imageParams,
      })

      this.emitScene(id, 'downloading', 'in_progress', `${id}: downloading image`)
      await this.files.downloadFile(imageUrl, imagePath)
      this.emitScene(id, 'generating_image', 'done', `${id}: image saved`)
    }

    this.callbacks.onSceneImageReady({ sceneId: id, imagePath })
    this.checkAbort()

    // --- VIDEO ---
    if (!fs.existsSync(videoPath)) {
      this.emitScene(id, 'generating_video', 'in_progress', `${id}: generating video via CLI...`)
      const videoUrl = await this.cli.generateVideo({
        imageFilePath: imagePath,
        prompt: scene.image_prompt,
        modelId: this.settings.higgsfieldVideoModelId,
        extraParams: videoParams,
      })

      this.emitScene(id, 'downloading', 'in_progress', `${id}: downloading video`)
      await this.files.downloadFile(videoUrl, videoPath)
      this.emitScene(id, 'generating_video', 'done', `${id}: video saved`)
    }

    this.callbacks.onSceneVideoReady({ sceneId: id, videoPath })
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
