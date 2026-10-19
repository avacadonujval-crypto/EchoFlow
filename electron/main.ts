import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  Notification,
  screen,
  session,
  shell,
  Tray,
} from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { startPushToTalk } from './hotkeys'
import { createOverlayWindow, registerOverlayIpc, ensureOverlayReady } from './overlay'
import { createCaptureWindow, ensureCaptureVisible } from './captureWindow'
import { shutdownNativeCapture } from './micCapture'
import {
  beginListening,
  endListening,
  registerVoiceIpc,
  setHubWindow,
} from './voicePipeline'

// Keep PTT + overlay alive when the hub is hidden in the tray.
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
if (process.platform === 'win32') {
  app.setAppUserModelId('com.echoflow.app')
}

type AppWithQuitFlag = typeof app & { isQuitting?: boolean }

function isAppQuitting(): boolean {
  return Boolean((app as AppWithQuitFlag).isQuitting)
}

function markAppQuitting(): void {
  ;(app as AppWithQuitFlag).isQuitting = true
}

let trayHintShown = false

function noteRunningInBackground(): void {
  if (trayHintShown || !Notification.isSupported()) return
  trayHintShown = true
  new Notification({
    title: 'EchoFlow is still running',
    body: 'Hold Ctrl+Alt to speak. Open from the tray icon anytime.',
  }).show()
}

function keepBackgroundAlive(): void {
  ensureCaptureVisible()
  ensureOverlayReady()
}
import {
  addHistory,
  clearHistory,
  connectApp,
  deleteAlias,
  deleteMacro,
  deleteSnippet,
  disconnectApp,
  activateVoiceProfile,
  chooseMembership,
  deleteVoiceProfile,
  getAliases,
  getConnectedApps,
  getHistory,
  getMacros,
  getMembership,
  getSettings,
  getSnippets,
  getVoiceStudio,
  saveAlias,
  saveMacro,
  saveSnippet,
  saveVoiceProfile,
  updateSettings,
} from './storage'
import { listInstalledApps } from './appLauncher'
import { listChromeProfiles } from './chromeProfiles'
import { testGeminiKey } from './gemini'
import type { CommandAlias, InstalledApp, Macro } from './types'

function loadEnvFile(): void {
  const candidates = [
    path.join(process.cwd(), '.env'),
    path.join(app.getAppPath(), '.env'),
    // Packaged installs: electron-builder extraResources → resources/.env
    path.join(process.resourcesPath, '.env'),
    path.join(path.dirname(app.getPath('exe')), '.env'),
  ]
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue
      const text = fs.readFileSync(file, 'utf8')
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eq = trimmed.indexOf('=')
        if (eq < 1) continue
        const key = trimmed.slice(0, eq).trim()
        const value = trimmed.slice(eq + 1).trim()
        if (!(key in process.env)) process.env[key] = value
      }
      break
    } catch {
      // ignore
    }
  }
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let stopHotkeys: (() => void) | null = null

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

function createMainWindow(): BrowserWindow {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize
  const minWidth = Math.round(screenWidth * 0.7)
  mainWindow = new BrowserWindow({
    width: Math.max(minWidth, Math.min(screenWidth, 1280)),
    height: 720,
    minWidth,
    minHeight: 600,
    title: 'EchoFlow',
    backgroundColor: '#ffffff',
    frame: false,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  })

  mainWindow.webContents.setBackgroundThrottling(false)
  mainWindow.setMenu(null)
  mainWindow.setMenuBarVisibility(false)

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (e) => {
    // Close = hide to tray; Quit from the tray menu fully exits.
    if (!isAppQuitting()) {
      e.preventDefault()
      mainWindow?.hide()
      keepBackgroundAlive()
      noteRunningInBackground()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    setHubWindow(null)
  })

  setHubWindow(mainWindow)
  return mainWindow
}

function createTray(): void {
  // Simple generated tray icon (16x16 black circle on transparent)
  const size = 16
  const canvas = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const cx = x - 7.5
      const cy = y - 7.5
      const r = Math.sqrt(cx * cx + cy * cy)
      const on = r < 6
      canvas[i] = on ? 29 : 0
      canvas[i + 1] = on ? 29 : 0
      canvas[i + 2] = on ? 31 : 0
      canvas[i + 3] = on ? 255 : 0
    }
  }
  const icon = nativeImage.createFromBuffer(canvas, { width: size, height: size })
  tray = new Tray(icon)
  tray.setToolTip('EchoFlow — hold Ctrl+Alt to speak')
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open EchoFlow',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      },
    },
    {
      label: 'Start listening',
      click: () => {
        void beginListening()
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        markAppQuitting()
        app.quit()
      },
    },
  ])
  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
  tray.on('double-click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
}

function registerIpc(): void {
  registerVoiceIpc()
  registerOverlayIpc()

  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:update', (_e, partial) => {
    const next = updateSettings(partial)
    if (partial.launchAtStartup !== undefined) {
      app.setLoginItemSettings({
        openAtLogin: next.launchAtStartup,
        path: process.execPath,
      })
    }
    return next
  })

  ipcMain.handle('gemini:test', async () => testGeminiKey())

  ipcMain.handle('aliases:list', () => getAliases())
  ipcMain.handle('aliases:save', (_e, alias: CommandAlias) => saveAlias(alias))
  ipcMain.handle('aliases:delete', (_e, id: string) => deleteAlias(id))

  ipcMain.handle('macros:list', () => getMacros())
  ipcMain.handle('macros:save', (_e, macro: Macro) => saveMacro(macro))
  ipcMain.handle('macros:delete', (_e, id: string) => deleteMacro(id))

  ipcMain.handle('snippets:list', () => getSnippets())
  ipcMain.handle('snippets:save', (_e, snippet) => saveSnippet(snippet))
  ipcMain.handle('snippets:delete', (_e, id: string) => deleteSnippet(id))

  ipcMain.handle('history:list', () => getHistory())
  ipcMain.handle('history:clear', () => {
    clearHistory()
    return []
  })
  ipcMain.handle('history:add', (_e, entry) => addHistory(entry))

  ipcMain.handle('apps:list-installed', () => listInstalledApps())
  ipcMain.handle('chrome:list-profiles', () => listChromeProfiles(true))
  ipcMain.handle('apps:list-connected', () => getConnectedApps())
  ipcMain.handle('apps:connect', (_e, appInfo: InstalledApp) => connectApp(appInfo))
  ipcMain.handle('apps:disconnect', (_e, appId: string) => disconnectApp(appId))

  ipcMain.handle('shell:open-external', (_e, url: string) => shell.openExternal(url))
  ipcMain.handle('app:get-version', () => app.getVersion())
  ipcMain.handle('app:show-hub', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:toggle-maximize', () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.handle('window:close', () => mainWindow?.close())

  ipcMain.handle('voice-studio:get', () => getVoiceStudio())
  ipcMain.handle('voice-studio:save', (_e, input: { id?: string; name: string; dailyGoal?: number }) =>
    saveVoiceProfile(input),
  )
  ipcMain.handle('voice-studio:activate', (_e, id: string) => activateVoiceProfile(id))
  ipcMain.handle('voice-studio:delete', (_e, id: string) => deleteVoiceProfile(id))
  ipcMain.handle('membership:get', () => getMembership())
  ipcMain.handle(
    'membership:choose',
    (
      _e,
      choice: { plan: 'personal' | 'studio' | 'maison'; cadence: 'monthly' | 'yearly'; email: string },
    ) => chooseMembership(choice),
  )
}

app.whenReady().then(() => {
  nativeTheme.themeSource = 'light'
  Menu.setApplicationMenu(null)
  loadEnvFile()

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === 'media') {
      callback(true)
      return
    }
    callback(false)
  })

  registerIpc()
  createMainWindow()
  createCaptureWindow()
  createOverlayWindow()
  createTray()

  try {
    stopHotkeys = startPushToTalk({
      emit: (event) => {
        if (event === 'ptt-down') {
          keepBackgroundAlive()
          void beginListening()
        }
        if (event === 'ptt-up') void endListening()
        return true
      },
    })
  } catch (err) {
    console.error('Failed to start global hotkeys:', err)
  }

  keepBackgroundAlive()

  const settings = getSettings()
  app.setLoginItemSettings({
    openAtLogin: settings.launchAtStartup,
    path: process.execPath,
  })
})

app.on('window-all-closed', () => {
  // Stay alive for tray + hotkeys — never quit when the hub is only hidden.
})

app.on('before-quit', () => {
  markAppQuitting()
  stopHotkeys?.()
  shutdownNativeCapture()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  else mainWindow?.show()
})
