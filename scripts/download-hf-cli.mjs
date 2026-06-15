/**
 * Downloads hf binaries for darwin arm64 + amd64 and merges them into a
 * universal binary using `lipo`. On Linux/Windows, downloads the single
 * platform-appropriate binary.
 *
 * Run via: node scripts/download-hf-cli.mjs
 * Called automatically by the "postinstall" npm script.
 */
import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const VERSION = '0.1.40'

const outDir = path.join(process.cwd(), 'resources', 'bin')
const binName = process.platform === 'win32' ? 'hf.exe' : 'hf'
const outBin = path.join(outDir, binName)

if (fs.existsSync(outBin)) {
  console.log(`hf binary already present at ${outBin}`)
  process.exit(0)
}

fs.mkdirSync(outDir, { recursive: true })

function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects'))
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(download(res.headers.location, dest, redirects + 1))
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
      const file = fs.createWriteStream(dest)
      res.pipe(file)
      file.on('finish', () => file.close(resolve))
      file.on('error', reject)
    }).on('error', reject)
  })
}

function downloadAndExtract(arch, destBin) {
  const PLATFORM_MAP = { darwin: 'darwin', linux: 'linux', win32: 'windows' }
  const platform = PLATFORM_MAP[process.platform]
  const tarball = `hf_${VERSION}_${platform}_${arch}.tar.gz`
  const url = `https://github.com/higgsfield-ai/cli/releases/download/v${VERSION}/${tarball}`
  const tmpTar = destBin + '.tar.gz'

  console.log(`Downloading ${url} ...`)
  return download(url, tmpTar).then(() => {
    execFileSync('tar', ['-xzf', tmpTar, '-C', path.dirname(destBin), binName])
    fs.renameSync(path.join(path.dirname(destBin), binName), destBin)
    fs.unlinkSync(tmpTar)
    if (process.platform !== 'win32') fs.chmodSync(destBin, 0o755)
  })
}

if (process.platform === 'darwin') {
  // Download both architectures and lipo-merge into a universal binary
  const arm64Bin = outBin + '_arm64'
  const amd64Bin = outBin + '_amd64'

  await downloadAndExtract('arm64', arm64Bin)
  await downloadAndExtract('amd64', amd64Bin)

  console.log('Creating universal binary with lipo...')
  execFileSync('lipo', ['-create', '-output', outBin, arm64Bin, amd64Bin])
  fs.unlinkSync(arm64Bin)
  fs.unlinkSync(amd64Bin)
  fs.chmodSync(outBin, 0o755)
  console.log(`Universal hf binary installed at ${outBin}`)
} else {
  const ARCH_MAP = { x64: 'amd64', arm64: 'arm64' }
  const arch = ARCH_MAP[process.arch] ?? 'amd64'
  await downloadAndExtract(arch, outBin)
  console.log(`hf binary installed at ${outBin}`)
}
