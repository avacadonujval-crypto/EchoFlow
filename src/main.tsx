import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { App } from './App'
import { OverlayPage } from './pages/OverlayPage'
import { CapturePage } from './pages/CapturePage'
import './styles.css'

function WindowChrome() {
  if (!window.echoflow?.windowMinimize) return null
  return (
    <>
      <div
        className="window-drag"
        onDoubleClick={() => void window.echoflow.windowToggleMaximize()}
      />
      <div className="window-controls">
        <button type="button" aria-label="Minimize" onClick={() => void window.echoflow.windowMinimize()}>
          &#8211;
        </button>
        <button
          type="button"
          aria-label="Maximize"
          onClick={() => void window.echoflow.windowToggleMaximize()}
        >
          &#9633;
        </button>
        <button
          type="button"
          className="close"
          aria-label="Close"
          onClick={() => void window.echoflow.windowClose()}
        >
          &#215;
        </button>
      </div>
    </>
  )
}

function HubRoot() {
  const [onboarded, setOnboarded] = useState<boolean | null>(null)

  useEffect(() => {
    if (!window.echoflow) {
      setOnboarded(false)
      return
    }
    void window.echoflow.getSettings().then((s) => setOnboarded(s.onboardingComplete))
  }, [])

  if (onboarded === null) {
    return (
      <>
        <WindowChrome />
        <div className="onboarding">
          <p className="muted">Starting EchoFlow…</p>
        </div>
      </>
    )
  }

  return (
    <>
      <WindowChrome />
      <App onboarded={onboarded} onOnboarded={() => setOnboarded(true)} />
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/overlay" element={<OverlayPage />} />
        <Route path="/capture" element={<CapturePage />} />
        <Route path="/*" element={<HubRoot />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>,
)
