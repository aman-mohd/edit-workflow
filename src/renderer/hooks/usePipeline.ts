import { useState, useEffect, useCallback, useRef } from 'react'
import type { PipelineInput, ProgressPayload } from '../../shared/types'
import { IPC_CHANNELS } from '../../main/ipc/channels'

export interface SceneState {
  sceneId: string
  stage: string
  status: string
  message: string
  imagePath?: string
  videoPath?: string
}

export function usePipeline() {
  const [running, setRunning] = useState(false)
  const [scenes, setScenes] = useState<Record<string, SceneState>>({})
  const [globalMessage, setGlobalMessage] = useState('')
  const [outputDir, setOutputDir] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryDir, setRetryDir] = useState<string | null>(null)

  // Keep latest input around so retry can reuse it without the caller passing it again
  const lastInputRef = useRef<Omit<PipelineInput, 'retryFromDir'> | null>(null)

  useEffect(() => {
    window.electronAPI.onProgress((p: ProgressPayload) => {
      if (p.sceneId) {
        setScenes((prev) => ({
          ...prev,
          [p.sceneId!]: {
            ...(prev[p.sceneId!] ?? { sceneId: p.sceneId! }),
            stage: p.stage,
            status: p.status,
            message: p.message,
          },
        }))
      } else {
        setGlobalMessage(p.message)
      }
    })

    window.electronAPI.onSceneImageReady(({ sceneId, imagePath }) => {
      setScenes((prev) => ({
        ...prev,
        [sceneId]: { ...(prev[sceneId] ?? { sceneId, stage: '', status: '', message: '' }), imagePath },
      }))
    })

    window.electronAPI.onSceneVideoReady(({ sceneId, videoPath }) => {
      setScenes((prev) => ({
        ...prev,
        [sceneId]: { ...(prev[sceneId] ?? { sceneId, stage: '', status: '', message: '' }), videoPath },
      }))
    })

    window.electronAPI.onComplete(({ outputDir: dir }) => {
      setRunning(false)
      setOutputDir(dir)
      setRetryDir(null)
      setGlobalMessage('Pipeline complete.')
    })

    window.electronAPI.onError(({ message, outputDir: partialDir }) => {
      setRunning(false)
      setError(message)
      if (partialDir) setRetryDir(partialDir)
    })

    return () => {
      window.electronAPI.removeAllListeners(IPC_CHANNELS.PIPELINE_PROGRESS)
      window.electronAPI.removeAllListeners(IPC_CHANNELS.SCENE_IMAGE_READY)
      window.electronAPI.removeAllListeners(IPC_CHANNELS.SCENE_VIDEO_READY)
      window.electronAPI.removeAllListeners(IPC_CHANNELS.PIPELINE_COMPLETE)
      window.electronAPI.removeAllListeners(IPC_CHANNELS.PIPELINE_ERROR)
    }
  }, [])

  const start = useCallback(async (input: PipelineInput) => {
    lastInputRef.current = { storyboardJson: input.storyboardJson, characterImagePaths: input.characterImagePaths }
    setRunning(true)
    setScenes({})
    setOutputDir(null)
    setRetryDir(null)
    setError(null)
    setGlobalMessage('')
    await window.electronAPI.startPipeline(input)
  }, [])

  const retry = useCallback(async () => {
    if (!retryDir || !lastInputRef.current) return
    setRunning(true)
    setError(null)
    setGlobalMessage('')
    // Keep existing scene cards — the orchestrator will restore completed ones and
    // clear the failed one as it re-runs it
    await window.electronAPI.startPipeline({ ...lastInputRef.current, retryFromDir: retryDir })
  }, [retryDir])

  const abort = useCallback(async () => {
    await window.electronAPI.abortPipeline()
    setRunning(false)
    setGlobalMessage('Aborted.')
  }, [])

  return { running, scenes, globalMessage, outputDir, error, retryDir, start, retry, abort }
}
