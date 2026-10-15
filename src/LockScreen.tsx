import { useEffect, useRef, useState } from 'react'

function clockLabel(now: Date) {
  const hour = now.getHours() % 12 || 12
  const minute = now.getMinutes().toString().padStart(2, '0')
  return `${hour}:${minute}`
}

function StatusIcons() {
  return (
    <span className="lock-icons" aria-hidden>
      <svg viewBox="0 0 18 12" width="17" height="12">
        <rect x="0" y="7" width="3" height="5" rx="0.6" fill="currentColor" />
        <rect x="5" y="4.5" width="3" height="7.5" rx="0.6" fill="currentColor" />
        <rect x="10" y="2" width="3" height="10" rx="0.6" fill="currentColor" />
        <rect x="15" y="0" width="3" height="12" rx="0.6" fill="currentColor" />
      </svg>
      <svg viewBox="0 0 16 12" width="16" height="12">
        <path d="M8 9.6a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3Z" fill="currentColor" />
        <path d="M4.1 7.4a5.4 5.4 0 0 1 7.8 0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M1.5 4.6a9 9 0 0 1 13 0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <svg viewBox="0 0 27 13" width="25" height="13">
        <rect x="0.6" y="0.6" width="22" height="11.8" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <rect x="2.2" y="2.2" width="15" height="8.6" rx="1.2" fill="currentColor" />
        <path d="M24.2 4.2h1.2a1 1 0 0 1 1 1v2.4a1 1 0 0 1-1 1h-1.2" fill="currentColor" />
      </svg>
    </span>
  )
}

interface Props {
  name: string
  onOpening: () => void
  onOpened: () => void
}

export function LockScreen({ name, onOpening, onOpened }: Props) {
  const [now, setNow] = useState(() => new Date())
  const [drag, setDrag] = useState(0)
  const [settling, setSettling] = useState(false)
  const [opening, setOpening] = useState(false)
  const nameRef = useRef<HTMLParagraphElement>(null)
  const ghostRef = useRef<HTMLElement | null>(null)
  const startY = useRef(0)
  const tracking = useRef(false)
  const started = useRef(false)

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    return () => {
      ghostRef.current?.remove()
    }
  }, [])

  const open = () => {
    if (started.current) return
    started.current = true
    setOpening(true)
    setDrag(0)
    onOpening()

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      window.setTimeout(onOpened, 0)
      return
    }

    window.setTimeout(() => {
      const source = nameRef.current
      if (!source) {
        onOpened()
        return
      }

    const from = source.getBoundingClientRect()
    const target = document.querySelector('.site-name') as HTMLElement | null
    const to = target?.getBoundingClientRect()
    const ghost = source.cloneNode(true) as HTMLElement
    ghost.className = 'lock-fly'
    ghost.style.transition = 'none'
    ghost.style.left = `${from.left}px`
    ghost.style.top = `${from.top}px`
    ghost.style.width = `${from.width}px`
    ghost.style.fontSize = getComputedStyle(source).fontSize
    document.body.appendChild(ghost)
    ghostRef.current = ghost
    source.style.visibility = 'hidden'
    void ghost.offsetWidth

    const destWidth = to?.width ?? Math.min(760, window.innerWidth - 80)
    const destLeft = to?.left ?? (window.innerWidth - destWidth) / 2
    const destTop = to?.top ?? window.innerHeight * 0.34
    const destFont = target ? getComputedStyle(target).fontSize : '6.5rem'
    ghost.style.color = '#ffffff'

    requestAnimationFrame(() => {
      ghost.style.transition =
        'left 820ms cubic-bezier(0.22, 0.8, 0.2, 1), top 820ms cubic-bezier(0.22, 0.8, 0.2, 1), width 820ms cubic-bezier(0.22, 0.8, 0.2, 1), font-size 820ms cubic-bezier(0.22, 0.8, 0.2, 1), color 820ms ease'
      ghost.style.left = `${destLeft}px`
      ghost.style.top = `${destTop}px`
      ghost.style.width = `${destWidth}px`
      ghost.style.fontSize = destFont
      ghost.style.color = '#000000'
    })

    window.setTimeout(() => {
      ghost.remove()
      ghostRef.current = null
      onOpened()
    }, 840)
    }, 80)
  }

  const time = clockLabel(now)
  const date = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div
      className={`lock${opening ? ' opening' : ''}`}
      style={{ ['--drag' as string]: `${drag}px` }}
      onPointerDown={(event) => {
        if (opening || event.button !== 0) return
        tracking.current = true
        startY.current = event.clientY
        setSettling(false)
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (!tracking.current || opening) return
        setDrag(Math.min(0, event.clientY - startY.current))
      }}
      onPointerUp={(event) => {
        if (!tracking.current || opening) return
        tracking.current = false
        const delta = event.clientY - startY.current
        if (delta < -64 || Math.abs(delta) < 10) {
          open()
          return
        }
        setSettling(true)
        setDrag(0)
      }}
      onPointerCancel={() => {
        tracking.current = false
        setSettling(true)
        setDrag(0)
      }}
    >
      <div className="lock-status">
        <span>{time}</span>
        <StatusIcons />
      </div>
      <div className={`lock-body${settling ? ' settling' : ''}`}>
        <p className="lock-date">{date}</p>
        <p className="lock-time">{time}</p>
        <p className="lock-name" ref={nameRef}>
          {name}
        </p>
      </div>
      <div className="lock-hint">
        <span className="lock-chevron" aria-hidden />
        <span>Swipe up</span>
        <span className="lock-bar" />
      </div>
    </div>
  )
}
