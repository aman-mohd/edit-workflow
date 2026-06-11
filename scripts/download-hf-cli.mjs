/**
 * Downloads the Higgsfield hf binary for the current platform into resources/bin/.
 * Run via: node scripts/download-hf-cli.mjs
 * Called automatically by the "postinstall" npm script.
 */
import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'
import { createGunzip } from 'node:zlib'
import { pipeline } from 'node:stream/promises'

const VERSION = '0.1.40'

const PLATFORM_MAP = { darwin: 'darwin', linux: 'linux', win32: 'windows' }
const ARCH_MAP = { x64: 'amd64', arm64: 'arm64' }

const platform = PLATFORM_MAP[process.platform]
const arch = ARCH_MAP[process.arch]

if (!platform || !arch) {
  console.error(`Unsupported platform: ${process.platform}/${process.arch}`)
  process.exit(1)
}

const binName = platform === 'windows' ? 'hf.exe' : 'hf'
const tarball = `hf_${VERSION}_${platform}_${arch}.tar.gz`
const url = `https://github.com/higgsfield-ai/cli/releases/download/v${VERSION}/${tarball}`
const outDir = path.join(process.cwd(), 'resources', 'bin')
const outBin = path.join(outDir, binName)

if (fs.existsSync(outBin)) {
  console.log(`hf binary already present at ${outBin}`)
  process.exit(0)
}

fs.mkdirSync(outDir, { recursive: true })

console.log(`Downloading ${url} ...`)

function get(targetUrl, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects'))
    https.get(targetUrl, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(get(res.headers.location, redirects + 1))
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
      resolve(res)
    }).on('error', reject)
  })
}

// Download tarball to a temp file, then extract just the binary
const tmpTar = outBin + '.tar.gz'

async function extractBinary(tarPath, outPath) {
  // Use Node's child_process to call system tar
  const { execFileSync } = await import('node:child_process')
  execFileSync('tar', ['-xzf', tarPath, '-C', path.dirname(outPath), binName])
}

const res = await get(url)
await pipeline(res, fs.createWriteStream(tmpTar))
console.log('Extracting...')
await extractBinary(tmpTar, outBin)
fs.unlinkSync(tmpTar)

if (platform !== 'windows') {
  fs.chmodSync(outBin, 0o755)
}

console.log(`hf binary installed at ${outBin}`)
