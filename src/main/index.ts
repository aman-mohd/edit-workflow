import { app, BrowserWindow, protocol, net } from 'electron'
import path from 'node:path'
import { registerIpcHandlers } from './ipc/handlers'

// Must be called before app is ready.
// Registers a 'localfile://' scheme the renderer uses to display generated
// images and videos. This avoids the Chromium restriction that blocks file://
// access from http://localhost in dev mode.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'localfile',
    privileges: { secure: true, standard: true, bypassCSP: true, supportFetchAPI: true, stream: true },
  },
])

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // Block any navigation (e.g. dragging a file onto the window navigates away)
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Serve local filesystem paths via localfile:// so the renderer can display
  // generated images/videos regardless of whether it's on localhost or file://.
  protocol.handle('localfile', (request) => {
    const filePath = request.url.replace(/^localfile:\/\//, 'file://')
    return net.fetch(filePath)
  })

  createWindow()
  if (mainWindow) registerIpcHandlers(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
