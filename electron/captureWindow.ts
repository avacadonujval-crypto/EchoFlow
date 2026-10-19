import { BrowserWindow, screen } from 'electron'
import path from 'node:path'

let captureWindow: BrowserWindow | null = null

/**
 * Tiny always-visible window hosting mic capture.
 * It must stay on-screen: Chromium delivers silent audio for
 * off-screen/occluded capture windows.
 */
export function createCaptureWindow(): BrowserWindow {
  if (captureWindow && !captureWindow.isDestroyed()) return captureWindow

  const area = screen.getPrimaryDisplay().workArea
  const size = 2

  captureWindow = new BrowserWindow({
    width: size,
    height: size,
    x: area.x + area.width - size - 1,
    y: area.y + area.height - size - 1,
    show: false,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    hasShadow: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  })

  captureWindow.setMenu(null)
  captureWindow.webContents.setBackgroundThrottling(false)
  captureWindow.webContents.on('console-message', (_e, _level, message) => {
    console.log('[capture-page]', message)
  })
  captureWindow.setIgnoreMouseEvents(true)
  captureWindow.setAlwaysOnTop(true, 'screen-saver')
  captureWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (process.env.VITE_DEV_SERVER_URL) {
    void captureWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/capture`)
  } else {
    void captureWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      hash: '/capture',
    })
  }

  captureWindow.once('ready-to-show', () => {
    captureWindow?.showInactive()
  })

  captureWindow.on('closed', () => {
    captureWindow = null
  })

  return captureWindow
}

/** Keep the capture window on-screen so mic + Chromium stay awake in tray mode. */
export function ensureCaptureVisible(): void {
  const win = createCaptureWindow()
  if (win.isDestroyed()) return
  win.setAlwaysOnTop(true, 'screen-saver')
  if (!win.isVisible()) win.showInactive()
}

export function destroyCaptureWindow(): void {
  if (captureWindow && !captureWindow.isDestroyed()) {
    captureWindow.destroy()
    captureWindow = null
  }
}
