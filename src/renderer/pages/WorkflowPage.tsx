import React, { useState, useCallback } from 'react'
import { usePipeline, SceneState } from '../hooks/usePipeline'

const PROMPT_TEMPLATE = `Break the script below into a visual storyboard and return ONLY valid JSON — no markdown, no explanation — matching this exact structure:

{
  "title": "short project title (max 60 chars)",
  "scenes": [
    {
      "id": "scene_01",
      "narration": "exact spoken or on-screen text for this scene",
      "visual_description": "camera angle, lighting mood, subject positioning, background",
      "image_prompt": "detailed AI image prompt (max 200 words): describe subject appearance physically (no character names), action/pose, setting, lighting style, camera lens, mood/color palette. Must be fully self-contained with no references to other scenes. Include shot type (close-up, wide shot, etc.)."
    }
  ]
}

Rules:
- Split at natural visual cuts (aim for 4–12 scenes)
- Each image_prompt must stand alone — never write "as seen before" or "same as scene X"
- Describe the subject physically in every image_prompt (reference images will be provided separately)

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
            src={`file://${scene.imagePath}`}
            alt={`${scene.sceneId} preview`}
            className="scene-thumbnail"
          />
        )}
        {scene.videoPath && (
          <video className="scene-video" controls width={240}>
            <source src={`file://${scene.videoPath}`} type="video/mp4" />
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
  const [jsonError, setJsonError] = useState<string | null>(null)
  const { running, scenes, globalMessage, outputDir, error, start, abort } = usePipeline()

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

  const handleImageDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const paths = Array.from(e.dataTransfer.files)
      .filter((f) => f.type.startsWith('image/'))
      .map((f) => window.electronAPI.getPathForFile(f))
      .filter((p): p is string => typeof p === 'string' && p.length > 0)
    setCharImages((prev) => [...new Set([...prev, ...paths])])
  }, [])

  const removeImage = (index: number) => {
    setCharImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleStart = async () => {
    await start({ storyboardJson, characterImagePaths: charImages })
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
          <div
            className={`drop-zone ${running ? 'disabled' : ''}`}
            onDrop={running ? undefined : handleImageDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <span>Drag and drop reference images here</span>
            <span className="hint">(JPG, PNG, WebP — used for character consistency)</span>
          </div>

          {charImages.length > 0 && (
            <ul className="image-list">
              {charImages.map((p, i) => (
                <li key={p}>
                  <span className="image-name">{p.split('/').pop()}</span>
                  <button
                    className="btn-remove"
                    onClick={() => removeImage(i)}
                    disabled={running}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
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
