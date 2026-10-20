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

/** Keep the overlay BrowserWindow alive (hidden) while the hub is in the tray. */
export function ensureOverlayReady(): void {
  createOverlayWindow()
}

export function showOverlay(): void {
  if (dismissTimer) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
  const win = createOverlayWindow()
  placeOverlay(LISTEN_SIZE.width, LISTEN_SIZE.height)
  // Re-assert z-order every show — Windows drops always-on-top after the
  // hub is hidden and another app takes focus.
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  // Prefer show() over showInactive(): with the hub hidden, showInactive
  // often never paints a transparent skipTaskbar window.
  win.show()
  win.moveTop()
}

/** Question at the bottom of the screen when the hub is hidden. */
export function showAskOverlay(question: string): void {
  if (dismissTimer) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
  const win = createOverlayWindow()
  placeOverlay(ASK_SIZE.width, ASK_SIZE.height)
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.show()
  win.moveTop()
  sendOverlayState({
    listening: false,
    processing: false,
    transcript: '',
    status: 'Hold Ctrl+Alt to answer',
    question,
  })
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

const LISTEN_SIZE = { width: 118, height: 58 }
const ASK_SIZE = { width: 460, height: 148 }

function placeOverlay(width: number, height: number): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  const display = screen.getPrimaryDisplay()
  const x = Math.round(display.workArea.x + (display.workArea.width - width) / 2)
  const y = Math.round(display.workArea.y + display.workArea.height - height - 36)
  overlayWindow.setBounds({ x, y, width, height })
}

export function sendOverlayState(state: {
  listening: boolean
  processing: boolean
  transcript: string
  status: string
  dismissing?: boolean
  question?: string
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
