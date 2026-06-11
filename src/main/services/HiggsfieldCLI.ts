import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import * as fs from 'node:fs'
import * as path from 'node:path'

const execFileAsync = promisify(execFile)

function buildEnv(): NodeJS.ProcessEnv {
  const extra = [
    '/usr/local/bin', '/opt/homebrew/bin',
    `${process.env.HOME}/.npm-global/bin`,
    '/usr/bin', '/bin',
  ].join(':')
  return { ...process.env, PATH: `${process.env.PATH ?? ''}:${extra}` }
}

function bundledBinPath(): string {
  const binName = process.platform === 'win32' ? 'hf.exe' : 'hf'
  // In packaged app: resourcesPath points to the app's resources folder
  // In dev: look next to the project root in resources/bin/
  const candidates = [
    process.resourcesPath && path.join(process.resourcesPath, 'bin', binName),
    path.join(process.cwd(), 'resources', 'bin', binName),
    path.join(__dirname, '..', '..', '..', 'resources', 'bin', binName),
  ].filter(Boolean) as string[]

  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return ''
}

async function findBinary(): Promise<string> {
  // 1. Bundled binary (ships inside the app)
  const bundled = bundledBinPath()
  if (bundled) return bundled

  // 2. System-installed fallback
  const env = buildEnv()
  for (const name of ['higgsfield', 'hf']) {
    try {
      const { stdout } = await execFileAsync('which', [name], { env })
      const bin = stdout.trim()
      if (bin) return bin
    } catch { /* try next */ }
  }

  throw new Error(
    'Higgsfield CLI binary not found. Run "npm install" in the project to download it.'
  )
}

interface GenerateResult {
  result_url?: string
  result_urls?: string[]
  status?: string
  id?: string
}

export class HiggsfieldCLI {
  private binPromise: Promise<string> | null = null

  private getBin(): Promise<string> {
    if (!this.binPromise) this.binPromise = findBinary()
    return this.binPromise
  }

  async login(): Promise<void> {
    const bin = await this.getBin()
    // auth login opens a browser and blocks until the user completes OAuth
    await execFileAsync(bin, ['auth', 'login'], { env: buildEnv(), timeout: 300_000 })
  }

  async checkInstalled(): Promise<{ ok: boolean; version?: string; error?: string }> {
    try {
      const bin = await findBinary()
      const { stdout } = await execFileAsync(bin, ['version'], { env: buildEnv() })
      return { ok: true, version: stdout.trim() }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  async generateImage(params: {
    prompt: string
    modelId: string             // e.g. 'nano_banana_2'
    referenceImagePaths?: string[]
    aspectRatio?: string        // e.g. '9:16'
    resolution?: string         // e.g. '1k'
  }): Promise<string> {
    const bin = await this.getBin()
    const args = [
      'generate', 'create', params.modelId,
      '--prompt', params.prompt,
      '--aspect_ratio', params.aspectRatio ?? '9:16',
      '--resolution', params.resolution ?? '1k',
      '--wait', '--json',
    ]

    for (const imgPath of params.referenceImagePaths ?? []) {
      args.push('--image', imgPath)
    }

    return this.runAndExtractUrl(bin, args)
  }

  async generateVideo(params: {
    imageFilePath: string
    prompt: string
    modelId: string             // e.g. 'seedance_2_0'
    aspectRatio?: string
    duration?: number
    resolution?: string
  }): Promise<string> {
    const bin = await this.getBin()
    const args = [
      'generate', 'create', params.modelId,
      '--prompt', params.prompt,
      '--start-image', params.imageFilePath,
      '--aspect_ratio', params.aspectRatio ?? '9:16',
      '--duration', String(params.duration ?? 5),
      '--resolution', params.resolution ?? '720p',
      '--wait', '--json',
    ]

    return this.runAndExtractUrl(bin, args)
  }

  private async runAndExtractUrl(bin: string, args: string[]): Promise<string> {
    let stdout: string
    let stderr: string
    try {
      const result = await execFileAsync(bin, args, {
        env: buildEnv(),
        maxBuffer: 10 * 1024 * 1024,
        timeout: 600_000, // 10 min max
      })
      stdout = result.stdout
      stderr = result.stderr
    } catch (e: unknown) {
      const err = e as { stdout?: string; stderr?: string; message?: string }
      throw new Error(
        `Higgsfield CLI failed:\n${err.stderr ?? ''}\n${err.message ?? ''}`
      )
    }

    // Try to parse JSON from stdout. CLI may emit log lines before the JSON blob.
    const jsonMatch = stdout.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      // --wait without --json sometimes just prints a URL on its own line
      const urlMatch = stdout.match(/https?:\/\/\S+/)
      if (urlMatch) return urlMatch[0].trim()
      throw new Error(
        `Could not find result URL in CLI output:\nstdout: ${stdout}\nstderr: ${stderr}`
      )
    }

    const data = JSON.parse(jsonMatch[0]) as GenerateResult
    const url =
      data.result_url ??
      data.result_urls?.[0]

    if (!url) {
      throw new Error(
        `CLI returned JSON but no result_url:\n${JSON.stringify(data, null, 2)}`
      )
    }

    return url
  }
}
