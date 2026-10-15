import { useEffect, useRef, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { HomePage, TranscriptPage } from './pages/HomePage'
import { AppsPage } from './pages/AppsPage'
import { ChatPage } from './pages/ChatPage'
import { SettingsPage } from './pages/SettingsPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { VoicePage } from './pages/VoicePage'
import { MembershipPage } from './pages/MembershipPage'
import { Onboarding } from './pages/Onboarding'
import { LockScreen } from './LockScreen'

const NAV = [
  { to: '/words', label: 'Words' },
  { to: '/transcript', label: 'Transcript' },
  { to: '/voice', label: 'Voice' },
  { to: '/chat', label: 'Chat' },
  { to: '/apps', label: 'Apps' },
  { to: '/settings', label: 'Settings' },
]

function NameHero() {
  const [name, setName] = useState('')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    void window.echoflow.getSettings().then((settings) => setName(settings.displayName ?? ''))
  }, [])

  const save = async () => {
    const next = name.trim().slice(0, 32)
    setName(next)
    setEditing(false)
    await window.echoflow.updateSettings({ displayName: next })
  }

  return (
    <header className="site-hero">
      {editing ? (
        <input
          className="site-name-input"
          value={name}
          autoFocus
          placeholder="Your name"
          aria-label="Your name"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void save()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save()
          }}
        />
      ) : (
        <button type="button" className="site-name" onClick={() => setEditing(true)}>
          {name || 'Your name'}
        </button>
      )}
      <p className="site-kicker">Spoken on this computer.</p>
    </header>
  )
}

const PAGE_ORDER = ['/', '/words', '/transcript', '/voice', '/chat', '/apps', '/settings', '/membership', '/privacy']

function Shell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { pathname } = location
  const [name, setName] = useState('')
  const [phase, setPhase] = useState<'locked' | 'opening' | 'open'>('locked')
  const previousPath = useRef(pathname)
  const direction = useRef<'forward' | 'back'>('forward')
  if (previousPath.current !== pathname) {
    const from = PAGE_ORDER.indexOf(previousPath.current)
    const to = PAGE_ORDER.indexOf(pathname)
    if (from !== -1 && to !== -1 && from !== to) {
      direction.current = to > from ? 'forward' : 'back'
    }
    previousPath.current = pathname
  }

  useEffect(() => {
    void window.echoflow.getSettings().then((settings) => setName(settings.displayName ?? ''))
  }, [pathname])

  useEffect(() => {
    document.body.dataset.phase = phase
    return () => {
      delete document.body.dataset.phase
    }
  }, [phase])

  useEffect(() => {
    document.querySelector('.site')?.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    const off = window.echoflow.onNavigate((path) => {
      if (!path) return
      navigate(path === '/more' ? '/settings' : path)
    })
    return () => off()
  }, [navigate])

  return (
    <div className={`site is-${phase}`}>
      {phase !== 'open' && (
        <LockScreen
          name={name || 'Your name'}
          onOpening={() => {
            if (pathname !== '/') navigate('/')
            setPhase('opening')
          }}
          onOpened={() => setPhase('open')}
        />
      )}
      <header className="site-nav">
        <div className="site-nav-inner">
          <NavLink to="/" end className="nav-mark">
            {name || 'Your name'}
          </NavLink>
          <span className="dock-rule" aria-hidden />
          <nav aria-label="Pages">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <div className="site-page">
        <div className="page-clip">
          <div key={pathname} className={`page-stage ${direction.current}`}>
            <Routes location={location}>
            <Route path="/" element={<NameHero />} />
            <Route path="/words" element={<HomePage />} />
            <Route path="/transcript" element={<TranscriptPage />} />
            <Route path="/voice" element={<VoicePage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/apps" element={<AppsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/membership" element={<MembershipPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </div>
        </div>
        {pathname !== '/' && (
          <footer className="site-foot">
            <NavLink to="/membership">Membership</NavLink>
            <NavLink to="/privacy">Privacy</NavLink>
          </footer>
        )}
      </div>
    </div>
  )
}

interface Props {
  onboarded: boolean
  onOnboarded: () => void
}

export function App({ onboarded, onOnboarded }: Props) {
  if (!onboarded) {
    return <Onboarding onComplete={onOnboarded} />
  }
  return <Shell />
}
