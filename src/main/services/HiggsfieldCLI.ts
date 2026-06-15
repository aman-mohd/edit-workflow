import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import * as fs from 'node:fs'
import * as path from 'node:path'

const execFileAsync = promisify(execFile)

const RESERVED_FIELDS = new Set(['prompt', 'image', 'start_image', 'end_image'])

function buildExtraArgs(params: Record<string, unknown>): string[] {
  const args: string[] = []
  for (const [key, value] of Object.entries(params)) {
    if (RESERVED_FIELDS.has(key) || value === undefined || value === null) continue
    // Convert camelCase/snake_case to --flag-name format
    const flag = `--${key.replace(/_/g, '_')}`
    args.push(flag, String(value))
  }
  return args
}

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

async function clearQuarantineIfNeeded(binPath: string): Promise<void> {
  if (process.platform !== 'darwin') return
  try {
    // Downloaded apps carry com.apple.quarantine on everything inside them.
    // Clearing it here lets macOS execute the binary without Gatekeeper blocking it.
    await execFileAsync('xattr', ['-d', 'com.apple.quarantine', binPath])
  } catch {
    // Attribute may not exist — that's fine
  }
}

async function findBinary(): Promise<string> {
  // 1. Bundled binary (ships inside the app)
  const bundled = bundledBinPath()
  if (bundled) {
    await clearQuarantineIfNeeded(bundled)
    return bundled
  }

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

  async logout(): Promise<void> {
    const bin = await this.getBin()
    await execFileAsync(bin, ['auth', 'logout'], { env: buildEnv(), timeout: 30_000 })
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
    modelId: string
    referenceImagePaths?: string[]
    extraParams?: Record<string, unknown>
  }): Promise<string> {
    const bin = await this.getBin()
    const args = ['generate', 'create', params.modelId, '--prompt', params.prompt]

    // Add extra params (aspect_ratio, resolution, etc.)
    const extra = buildExtraArgs(params.extraParams ?? {})
    args.push(...extra)

    // Add reference images
    for (const imgPath of params.referenceImagePaths ?? []) {
      args.push('--image', imgPath)
    }

    args.push('--wait', '--json')
    return this.runAndExtractUrl(bin, args)
  }

  async generateVideo(params: {
    imageFilePath: string
    prompt: string
    modelId: string
    extraParams?: Record<string, unknown>
  }): Promise<string> {
    const bin = await this.getBin()
    const args = [
      'generate', 'create', params.modelId,
      '--prompt', params.prompt,
      '--start-image', params.imageFilePath,
    ]

    // Add extra params (aspect_ratio, duration, mode, etc.)
    const extra = buildExtraArgs(params.extraParams ?? {})
    args.push(...extra)

    args.push('--wait', '--json')
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

    if (data.status === 'failed') {
      throw new Error(`Higgsfield job failed (id: ${data.id ?? 'unknown'})`)
    }

    const url = data.result_url || data.result_urls?.[0]

    if (!url) {
      throw new Error(
        `CLI returned JSON but no result_url:\n${JSON.stringify(data, null, 2)}`
      )
    }

    return url
  }
}
