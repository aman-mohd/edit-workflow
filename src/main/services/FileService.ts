import * as fs from 'node:fs/promises'
import * as fsSync from 'node:fs'
import * as https from 'node:https'
import * as http from 'node:http'
import * as path from 'node:path'

export class FileService {
  async createProjectDir(baseDir: string, projectTitle: string): Promise<string> {
    const safe = projectTitle.replace(/[^a-z0-9_\-]/gi, '_').slice(0, 50)
    const dirName = `${Date.now()}_${safe}`
    const fullPath = path.join(baseDir, dirName)
    await fs.mkdir(fullPath, { recursive: true })
    return fullPath
  }

  async writeJson(filePath: string, data: unknown): Promise<void> {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
  }

  downloadFile(url: string, destPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const file = fsSync.createWriteStream(destPath)
      const transport = url.startsWith('https') ? https : http

      transport
        .get(url, (response) => {
          if (response.statusCode !== 200) {
            file.close()
            reject(new Error(`Download failed HTTP ${response.statusCode}: ${url}`))
            return
          }
          response.pipe(file)
          file.on('finish', () => {
            file.close()
            resolve(destPath)
          })
          file.on('error', reject)
        })
        .on('error', (err) => {
          file.close()
          fsSync.unlink(destPath, () => undefined)
          reject(err)
        })
    })
  }
}
