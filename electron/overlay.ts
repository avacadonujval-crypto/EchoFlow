import {
  BrowserWindow,
  screen,
  ipcMain,
  app,
} from 'electron'
import path from 'node:path'

let overlayWindow: BrowserWindow | null = null

export function createOverlayWindow(): BrowserWindow {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow
  }

  const display = screen.getPrimaryDisplay()
  const width = 118
  const height = 58
  const x = Math.round(display.workArea.x + (display.workArea.width - width) / 2)
  const y = Math.round(display.workArea.y + display.workArea.height - height - 36)

  overlayWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  })

  overlayWindow.webContents.setBackgroundThrottling(false)
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (process.env.VITE_DEV_SERVER_URL) {
    overlayWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/overlay`)
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      hash: '/overlay',
    })
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })

  return overlayWindow
}

let dismissTimer: ReturnType<typeof setTimeout> | null = null

export function showOverlay(): void {
  if (dismissTimer) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
  const win = createOverlayWindow()
  if (!win.isVisible()) win.showInactive()
}

export function hideOverlay(): void {
  if (dismissTimer) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide()
  }
}

/** Animate the listening mark out, then hide the window. */
export function dismissOverlay(): void {
  if (!overlayWindow || overlayWindow.isDestroyed() || !overlayWindow.isVisible()) {
    return
  }
  if (dismissTimer) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
  overlayWindow.webContents.send('overlay:state', {
    listening: false,
    processing: false,
    transcript: '',
    status: '',
    dismissing: true,
  })
  dismissTimer = setTimeout(() => {
    dismissTimer = null
    hideOverlay()
  }, 340)
}

export function sendOverlayState(state: {
  listening: boolean
  processing: boolean
  transcript: string
  status: string
  dismissing?: boolean
}): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('overlay:state', state)
  }
}

export function registerOverlayIpc(): void {
  ipcMain.handle('overlay:hide', () => {
    hideOverlay()
  })
}

export function destroyOverlay(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.destroy()
    overlayWindow = null
  }
}

// Keep reference for app quit
app.on('before-quit', () => {
  destroyOverlay()
})
