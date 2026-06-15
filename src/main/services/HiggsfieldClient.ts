import * as fs from 'node:fs/promises'

const BASE_URL = 'https://platform.higgsfield.ai'

interface UploadUrlResponse {
  public_url: string
  upload_url: string
}

interface SubmitResponse {
  request_id: string
  status_url: string
  cancel_url: string
  status: string
}

interface StatusResponse {
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'nsfw' | 'canceled'
  request_id: string
  images?: { url: string }[]
  video?: { url: string }
}

export class HiggsfieldClient {
  private readonly authHeader: string

  constructor(apiKey: string, apiKeySecret: string) {
    this.authHeader = `Key ${apiKey}:${apiKeySecret}`
  }

  // ── Diagnostics ───────────────────────────────────────────────────────────

  async testConnection(): Promise<{ upload: string; generate: string }> {
    // Test 1: upload endpoint
    let upload: string
    try {
      const r = await this.apiFetch<UploadUrlResponse>('POST', '/files/generate-upload-url', {
        content_type: 'image/jpeg',
      })
      upload = r.public_url ? `OK — got public_url` : `OK — response: ${JSON.stringify(r)}`
    } catch (e) {
      upload = e instanceof Error ? e.message : String(e)
    }

    // Test 2: image generation (uses a credit, but proves end-to-end auth works)
    let generate: string
    try {
      const r = await this.apiFetch<SubmitResponse>('POST', '/higgsfield-ai/soul/standard', {
        prompt: 'test',
        aspect_ratio: '1:1',
        mode: 'std',
      })
      generate = r.request_id ? `OK — request_id: ${r.request_id}` : `OK — ${JSON.stringify(r)}`
    } catch (e) {
      generate = e instanceof Error ? e.message : String(e)
    }

    return { upload, generate }
  }

  // ── File upload ────────────────────────────────────────────────────────────

  async uploadLocalImage(filePath: string): Promise<string> {
    const fileName = filePath.split('/').pop() ?? 'image.jpg'
    const mimeType = this.inferMimeType(fileName)
    const fileBytes = await fs.readFile(filePath)

    const uploadResp = await this.apiFetch<UploadUrlResponse>(
      'POST',
      '/files/generate-upload-url',
      { content_type: mimeType }
    )

    // PUT raw bytes to presigned URL — no auth header
    const putResp = await fetch(uploadResp.upload_url, {
      method: 'PUT',
      body: fileBytes,
      headers: { 'Content-Type': mimeType },
    })
    if (!putResp.ok) {
      const txt = await putResp.text().catch(() => '')
      throw new Error(`Upload PUT failed: HTTP ${putResp.status}: ${txt}`)
    }

    return uploadResp.public_url
  }

  // ── Image generation ───────────────────────────────────────────────────────

  // modelEndpoint: e.g. 'higgsfield-ai/soul/standard' or 'reve/text-to-image'
  async generateImage(params: {
    prompt: string
    modelEndpoint: string
    aspectRatio?: string
    resolution?: string
  }): Promise<string> {
    const body: Record<string, unknown> = {
      prompt: params.prompt,
      aspect_ratio: params.aspectRatio ?? '9:16',
      resolution: params.resolution ?? '720p',
    }

    const result = await this.apiFetch<SubmitResponse>(
      'POST',
      `/${params.modelEndpoint}`,
      body
    )
    return result.request_id
  }

  // ── Video generation ───────────────────────────────────────────────────────

  // modelEndpoint: e.g. 'higgsfield-ai/dop/standard' or 'bytedance/seedance/v1/pro/image-to-video'
  async generateVideo(params: {
    imageUrl: string
    prompt: string
    modelEndpoint: string
    durationSeconds?: number
  }): Promise<string> {
    const body: Record<string, unknown> = {
      image_url: params.imageUrl,
      prompt: params.prompt,
    }
    if (params.durationSeconds !== undefined) {
      body['duration'] = params.durationSeconds
    }

    const result = await this.apiFetch<SubmitResponse>(
      'POST',
      `/${params.modelEndpoint}`,
      body
    )
    return result.request_id
  }

  // ── Polling ────────────────────────────────────────────────────────────────

  async pollJob(requestId: string, opts: { timeoutMs?: number } = {}): Promise<string> {
    const timeoutMs = opts.timeoutMs ?? 360_000
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
      const status = await this.apiFetch<StatusResponse>(
        'GET',
        `/requests/${requestId}/status`
      )

      if (status.status === 'completed') {
        const url = status.images?.[0]?.url ?? status.video?.url
        if (!url) throw new Error(`Job ${requestId} completed but returned no output URL`)
        return url
      }

      if (status.status === 'failed' || status.status === 'nsfw') {
        throw new Error(`Job ${requestId} ended with status "${status.status}"`)
      }

      await this.sleep(4000)
    }

    throw new Error(`Job ${requestId} timed out after ${timeoutMs}ms`)
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async apiFetch<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${BASE_URL}${path}`
    const init: RequestInit = {
      method,
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'higgsfield-server-js/2.0',
      },
    }
    if (body !== undefined) {
      ;(init as RequestInit & { body: string }).body = JSON.stringify(body)
    }

    const res = await fetch(url, init)
    const text = await res.text()

    if (!res.ok) {
      throw new Error(`Higgsfield API ${method} ${url} → HTTP ${res.status}: ${text}`)
    }

    try {
      return JSON.parse(text) as T
    } catch {
      return text as unknown as T
    }
  }

  private inferMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
    const map: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg',
      png: 'image/png', webp: 'image/webp', gif: 'image/gif',
    }
    return map[ext] ?? 'image/jpeg'
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
