import { useEffect, useRef, useState, type MouseEvent } from 'react'
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

const PAGE_LABELS: Record<string, string> = {
  '/': 'Home',
  '/words': 'Words',
  '/transcript': 'Transcript',
  '/voice': 'Voice',
  '/chat': 'Chat',
  '/apps': 'Apps',
  '/settings': 'Settings',
  '/membership': 'Membership',
  '/privacy': 'Privacy',
}

const PAGE_ORDER = [
  '/',
  '/words',
  '/transcript',
  '/voice',
  '/chat',
  '/apps',
  '/settings',
  '/membership',
  '/privacy',
]

const EASE = 'cubic-bezier(0.22, 0.8, 0.2, 1)'
const GATHER_MS = 420
const HOLD_MS = 180
const SETTLE_MS = 720

function NameHero() {
  const [name, setName] = useState('')

  useEffect(() => {
    void window.echoflow.getSettings().then((settings) => setName(settings.displayName ?? ''))
  }, [])

  return (
    <header className="site-hero">
      <p className="site-name">{name || 'Your name'}</p>
      <p className="site-kicker">Spoken on this computer.</p>
    </header>
  )
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function Shell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { pathname } = location
  const [name, setName] = useState('')
  const [phase, setPhase] = useState<'locked' | 'opening' | 'open'>('locked')
  const [dockPhase, setDockPhase] = useState<'idle' | 'gather' | 'hold' | 'settle'>('idle')
  const [flyLabel, setFlyLabel] = useState('')
  const navRef = useRef<HTMLElement>(null)
  const flyRef = useRef<HTMLParagraphElement>(null)
  const busy = useRef(false)
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
    if (dockPhase === 'idle') {
      document.querySelector('.site')?.scrollTo(0, 0)
    }
  }, [pathname, dockPhase])

  useEffect(() => {
    const off = window.echoflow.onNavigate((path) => {
      if (!path) return
      navigate(path === '/more' ? '/settings' : path)
    })
    return () => off()
  }, [navigate])

  const runDockTransit = (to: string, label: string, origin: DOMRect) => {
    if (busy.current || to === pathname) return
    if (prefersReducedMotion()) {
      navigate(to)
      return
    }

    busy.current = true
    setFlyLabel(label)
    setDockPhase('gather')

    const fly = flyRef.current
    if (fly) {
      fly.style.transition = 'none'
      fly.style.left = `${origin.left + origin.width / 2}px`
      fly.style.top = `${origin.top + origin.height / 2}px`
      fly.style.fontSize = '0.82rem'
      fly.style.opacity = '1'
      fly.style.transform = 'translate(-50%, -50%) scale(1)'
      void fly.offsetWidth
      requestAnimationFrame(() => {
        fly.style.transition = `left ${GATHER_MS}ms ${EASE}, top ${GATHER_MS}ms ${EASE}, font-size ${GATHER_MS}ms ${EASE}, transform ${GATHER_MS}ms ${EASE}`
        fly.style.left = '50%'
        fly.style.top = '46%'
        fly.style.fontSize = 'clamp(3.4rem, 9vw, 5.6rem)'
        fly.style.transform = 'translate(-50%, -50%) scale(1)'
      })
    }

    window.setTimeout(() => {
      setDockPhase('hold')
      navigate(to)
    }, GATHER_MS)

    window.setTimeout(() => {
      setDockPhase('settle')
      window.setTimeout(() => {
        if (!fly || !navRef.current) return
        const links = Array.from(navRef.current.querySelectorAll('a'))
        const slot =
          links.find((link) => {
            const href = link.getAttribute('href') ?? ''
            if (to === '/') return href === '#/' || href.endsWith('#/') || href === '/'
            return href === `#${to}` || href.endsWith(to)
          }) ?? (navRef.current.querySelector('a.active') as HTMLElement | null)
        const dest = slot?.getBoundingClientRect()
        if (!slot || !dest) return
        fly.style.transition = `left ${SETTLE_MS}ms ${EASE}, top ${SETTLE_MS}ms ${EASE}, font-size ${SETTLE_MS}ms ${EASE}, transform ${SETTLE_MS}ms ${EASE}, opacity 200ms ease ${SETTLE_MS - 160}ms`
        fly.style.left = `${dest.left + dest.width / 2}px`
        fly.style.top = `${dest.top + dest.height / 2}px`
        fly.style.fontSize = getComputedStyle(slot).fontSize
        fly.style.transform = 'translate(-50%, -50%) scale(1)'
        fly.style.opacity = '0'
      }, 80)
    }, GATHER_MS + HOLD_MS)

    window.setTimeout(() => {
      setDockPhase('idle')
      setFlyLabel('')
      busy.current = false
      if (fly) {
        fly.style.transition = 'none'
        fly.style.opacity = '0'
      }
    }, GATHER_MS + HOLD_MS + SETTLE_MS + 60)
  }

  const onNavClick = (event: MouseEvent<HTMLAnchorElement>, to: string, label: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return
    }
    if (to === pathname || busy.current) {
      event.preventDefault()
      return
    }
    event.preventDefault()
    runDockTransit(to, label, event.currentTarget.getBoundingClientRect())
  }

  return (
    <div className={`site is-${phase} dock-${dockPhase}`}>
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
      <header className="site-nav" ref={navRef}>
        <div className="site-nav-inner">
          <NavLink
            to="/"
            end
            className="nav-mark"
            onClick={(event) => onNavClick(event, '/', name || 'Home')}
          >
            {name || 'Your name'}
          </NavLink>
          <span className="dock-rule" aria-hidden />
          <nav aria-label="Pages">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={(event) => onNavClick(event, item.to, item.label)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <p className="page-fly" ref={flyRef} aria-hidden>
        {flyLabel || PAGE_LABELS[pathname] || ''}
      </p>

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
            <NavLink
              to="/membership"
              onClick={(event) => onNavClick(event, '/membership', 'Membership')}
            >
              Membership
            </NavLink>
            <NavLink to="/privacy" onClick={(event) => onNavClick(event, '/privacy', 'Privacy')}>
              Privacy
            </NavLink>
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
