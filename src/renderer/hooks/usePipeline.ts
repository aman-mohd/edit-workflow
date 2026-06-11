import { useState, useEffect, useCallback } from 'react'
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
      setGlobalMessage('Pipeline complete.')
    })

    window.electronAPI.onError(({ message }) => {
      setRunning(false)
      setError(message)
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
    setRunning(true)
    setScenes({})
    setOutputDir(null)
    setError(null)
    setGlobalMessage('')
    await window.electronAPI.startPipeline(input)
  }, [])

  const abort = useCallback(async () => {
    await window.electronAPI.abortPipeline()
    setRunning(false)
    setGlobalMessage('Aborted.')
  }, [])

  return { running, scenes, globalMessage, outputDir, error, start, abort }
}
