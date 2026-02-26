import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

// Reuse the same custom URL scheme as Capacitor mobile — already whitelisted in Supabase
const PROTOCOL = 'com.svlaki.glyde'

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Dev: load from Vite dev server. Prod: load built files.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// Register glyde:// as default protocol client
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [process.argv[1]])
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL)
}

// Single-instance lock — prevents duplicate windows
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  let mainWindow: BrowserWindow | null = null

  // Windows/Linux: second instance launched with deep link URL
  app.on('second-instance', (_event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }

    // The deep link URL is the last argument
    const url = commandLine.find((arg) => arg.startsWith(`${PROTOCOL}://`))
    if (url) {
      handleDeepLink(url)
    }
  })

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.svlaki.glyde')

    // Dev: open DevTools with F12, ignore Cmd+R in prod
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    mainWindow = createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow()
      }
    })
  })

  // macOS: handle deep link via open-url event
  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleDeepLink(url)
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  function handleDeepLink(url: string): void {
    // Extract fragment or query params from glyde://oauth-callback#access_token=...
    const hashIndex = url.indexOf('#')
    const queryIndex = url.indexOf('?')
    const paramsStart = hashIndex !== -1 ? hashIndex + 1 : queryIndex !== -1 ? queryIndex + 1 : -1

    if (paramsStart === -1) return

    const params = url.substring(paramsStart)

    // Forward OAuth token params to renderer via IPC
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      win.webContents.send('oauth-callback', params)
    }
  }
}
