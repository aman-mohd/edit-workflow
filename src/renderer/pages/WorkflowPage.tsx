import React, { useState, useCallback, useRef, useEffect } from 'react'
import { usePipeline, SceneState } from '../hooks/usePipeline'
import { useSettings } from '../hooks/useSettings'
import { findImageModel, findVideoModel, RESERVED_FIELDS } from '../../shared/models'

function renderGenerationControls(
  modelLabel: string,
  modelId: string,
  params: Record<string, unknown>,
  setParams: (p: Record<string, unknown>) => void
): JSX.Element {
  const model = modelLabel.includes('Image') ? findImageModel(modelId) : findVideoModel(modelId)
  if (!model) return <div />

  const controls = Object.entries(model.fields)
    .filter(([key]) => !RESERVED_FIELDS.has(key))
    .map(([fieldKey, field]) => {
      if (field.type === 'select' && field.values) {
        return (
          <div key={fieldKey} className="control-group">
            <label>{fieldKey}</label>
            <select
              value={String(params[fieldKey] ?? '')}
              onChange={(e) => setParams({ ...params, [fieldKey]: e.target.value })}
            >
              {field.values.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        )
      } else if (field.type === 'number') {
        return (
          <div key={fieldKey} className="control-group">
            <label>{fieldKey}</label>
            <input
              type="number"
              min={field.min ?? 1}
              value={String(params[fieldKey] ?? '')}
              onChange={(e) => setParams({ ...params, [fieldKey]: Number(e.target.value) })}
            />
          </div>
        )
      }
      return null
    })

  return controls.length > 0 ? (
    <fieldset>
      <legend>{modelLabel}</legend>
      <div className="control-row">{controls}</div>
    </fieldset>
  ) : (
    <div />
  )
}

const PROMPT_TEMPLATE = `Break the script below into a visual storyboard and return ONLY valid JSON — no markdown, no explanation — matching this exact structure:

{
  "title": "short project title (max 60 chars)",
  "scenes": [
    {
      "id": "scene_01",
      "narration": "exact spoken or on-screen text for this scene",
      "visual_description": "camera angle, lighting mood, subject positioning, background",
      "characters": ["CharacterName1", "CharacterName2"],
      "image_prompt": "detailed AI image prompt (max 200 words): don't describe character's physical appearance, only the action/pose, setting, lighting style, camera lens, mood/color palette, also charcter must always be referenced by name so there is no confusion that means we don't want to give the image style caroonish or animated or comic etc we strictly want to follow the style from the referenced image. Must be fully self-contained with no references to other scenes. Include shot type (close-up, wide shot, etc.)."
    }
  ]
}

Rules:
- Split at natural visual cuts
- "characters" must list exactly the character names that appear in that scene (use the exact same spelling as the character reference image filenames you were given)
- Each image_prompt must stand alone — never write "as seen before" or "same as scene X"
- Describe each character physically in every image_prompt (use reference images that will be provided separately for consistency)
- If a scene has no characters (e.g. a title card or landscape shot), use an empty array: "characters": []

Script:
[PASTE YOUR SCRIPT HERE]`

function SceneCard({ scene }: { scene: SceneState }): JSX.Element {
  const isDone = scene.status === 'done'
  const isError = scene.status === 'error'

  return (
    <div className={`scene-card ${isDone ? 'done' : ''} ${isError ? 'error' : ''}`}>
      <div className="scene-header">
        <span className="scene-id">{scene.sceneId}</span>
        <span className={`scene-status status-${scene.status}`}>{scene.stage}</span>
      </div>
      <p className="scene-message">{scene.message}</p>
      <div className="scene-media">
        {scene.imagePath && (
          <img
            src={`localfile://${scene.imagePath}`}
            alt={`${scene.sceneId} preview`}
            className="scene-thumbnail"
          />
        )}
        {scene.videoPath && (
          <video className="scene-video" controls width={240}>
            <source src={`localfile://${scene.videoPath}`} type="video/mp4" />
          </video>
        )}
      </div>
    </div>
  )
}

export function WorkflowPage(): JSX.Element {
  const [storyboardJson, setStoryboardJson] = useState('')
  const [charImages, setCharImages] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [jsonError, setJsonError] = useState<string | null>(null)
  const { running, scenes, globalMessage, outputDir, error, retryDir, start, retry, abort } = usePipeline()
  const { settings } = useSettings()
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null)
  const [imageParams, setImageParams] = useState<Record<string, unknown>>({})
  const [videoParams, setVideoParams] = useState<Record<string, unknown>>({})

  // Initialize generation params from model defaults whenever model selection changes
  useEffect(() => {
    const imageModel = findImageModel(settings.higgsfieldImageModelId)
    const videoModel = findVideoModel(settings.higgsfieldVideoModelId)
    if (imageModel) setImageParams({ ...imageModel.payload })
    if (videoModel) setVideoParams({ ...videoModel.payload })
  }, [settings.higgsfieldImageModelId, settings.higgsfieldVideoModelId])

  // Start a 3-second countdown whenever a retryable failure occurs
  useEffect(() => {
    if (error && retryDir) {
      setRetryCountdown(3)
    } else {
      setRetryCountdown(null)
    }
  }, [error, retryDir])

  // Tick the countdown down and auto-fire retry at 0
  useEffect(() => {
    if (retryCountdown === null) return
    if (retryCountdown === 0) {
      retry()
      return
    }
    const timer = setTimeout(() => setRetryCountdown((c) => (c !== null ? c - 1 : null)), 1000)
    return () => clearTimeout(timer)
  }, [retryCountdown, retry])

  const handleManualRetry = () => {
    setRetryCountdown(null)
    retry()
  }

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setStoryboardJson(val)
    if (!val.trim()) { setJsonError(null); return }
    try {
      const parsed = JSON.parse(val)
      setJsonError(parsed.scenes?.length ? null : 'Missing "scenes" array')
    } catch {
      setJsonError('Invalid JSON')
    }
  }

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(PROMPT_TEMPLATE)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const addImageFiles = useCallback((files: FileList | File[]) => {
    const paths = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .map((f) => window.electronAPI.getPathForFile(f))
      .filter((p): p is string => typeof p === 'string' && p.length > 0)
    setCharImages((prev) => [...new Set([...prev, ...paths])])
  }, [])

  const handleImageDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    addImageFiles(e.dataTransfer.files)
  }, [addImageFiles])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addImageFiles(e.target.files)
      e.target.value = ''
    }
  }, [addImageFiles])

  const removeImage = (index: number) => {
    setCharImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleStart = async () => {
    await start({ storyboardJson, characterImagePaths: charImages, imageModelParams: imageParams, videoModelParams: videoParams })
  }

  const canStart = !running && storyboardJson.trim().length > 0 && !jsonError

  const sceneList = Object.values(scenes).sort((a, b) => a.sceneId.localeCompare(b.sceneId))

  return (
    <div className="workflow-page">
      <div className="workflow-inputs">
        <section className="input-section">
          <div className="section-header">
            <h2>Storyboard JSON</h2>
            <button type="button" className="btn-copy" onClick={handleCopyPrompt}>
              {copied ? 'Copied!' : 'Copy ChatGPT prompt'}
            </button>
          </div>
          <p className="hint">
            Use ChatGPT or any AI with the prompt above, then paste the JSON output here.
          </p>
          <textarea
            className={`script-input ${jsonError ? 'input-error' : ''}`}
            value={storyboardJson}
            onChange={handleJsonChange}
            placeholder={'{\n  "title": "My Project",\n  "scenes": [...]\n}'}
            rows={14}
            disabled={running}
          />
          {jsonError && <span className="field-error">{jsonError}</span>}
        </section>

        <section className="input-section">
          <h2>Character Reference Images</h2>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileInputChange}
          />
          <div
            className={`drop-zone ${running ? 'disabled' : ''}`}
            onDrop={running ? undefined : handleImageDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => !running && fileInputRef.current?.click()}
          >
            <span>Click or drag and drop reference images here</span>
            <span className="hint">(JPG, PNG, WebP — used for character consistency)</span>
          </div>

          {charImages.length > 0 && (
            <ul className="image-list">
              {charImages.map((p, i) => {
                const filename = p.split('/').pop() ?? p
                const charName = filename.replace(/\.[^.]+$/, '')
                return (
                  <li key={p}>
                    <span className="char-name">{charName}</span>
                    <span className="image-name">{filename}</span>
                    <button
                      className="btn-remove"
                      onClick={() => removeImage(i)}
                      disabled={running}
                    >
                      ✕
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="generation-settings">
        <h3>Generation Settings</h3>
        {renderGenerationControls('Image Model', settings.higgsfieldImageModelId, imageParams, setImageParams)}
        {renderGenerationControls('Video Model', settings.higgsfieldVideoModelId, videoParams, setVideoParams)}
      </div>

      <div className="workflow-actions">
        <button
          className="btn-primary btn-large"
          onClick={handleStart}
          disabled={!canStart}
        >
          {running ? 'Running...' : 'Generate'}
        </button>

        {running && (
          <button className="btn-abort" onClick={abort}>
            Abort
          </button>
        )}

        {!running && error && retryDir && (
          <button className="btn-retry" onClick={handleManualRetry}>
            Retry from failure {retryCountdown !== null ? `(${retryCountdown})` : ''}
          </button>
        )}
      </div>

      {globalMessage && (
        <p className={`global-status ${error ? 'error' : ''}`}>
          {error ? `Error: ${error}` : globalMessage}
        </p>
      )}

      {error && !globalMessage && (
        <p className="global-status error">Error: {error}</p>
      )}

      {outputDir && (
        <div className="output-notice">
          <span>Output saved to: <code>{outputDir}</code></span>
          <button
            className="btn-secondary"
            onClick={() => window.electronAPI.openFolder(outputDir)}
          >
            Open Folder
          </button>
        </div>
      )}

      {sceneList.length > 0 && (
        <section className="scene-grid-section">
          <h2>Scene Progress</h2>
          <div className="scene-grid">
            {sceneList.map((scene) => (
              <SceneCard key={scene.sceneId} scene={scene} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
