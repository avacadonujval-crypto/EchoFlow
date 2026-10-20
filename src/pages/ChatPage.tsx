import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ChatMessage } from '../../shared/types'

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [question, setQuestion] = useState<string | null>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const ready = useRef(false)

  useEffect(() => {
    const load = () => {
      void window.echoflow.getChatMessages().then(setMessages)
      void window.echoflow.getPendingQuestion().then(setQuestion)
    }
    load()
    const off = window.echoflow.onChatUpdated((next) => {
      setMessages(next)
      void window.echoflow.getPendingQuestion().then(setQuestion)
    })
    inputRef.current?.focus({ preventScroll: true })
    return () => off()
  }, [])

  useEffect(() => {
    const thread = threadRef.current
    if (!thread) return
    if (!ready.current) {
      ready.current = true
      return
    }
    thread.scrollTop = thread.scrollHeight
  }, [messages])

  const send = async (e?: FormEvent) => {
    e?.preventDefault()
    const t = text.trim()
    if (!t || busy) return
    setText('')
    setBusy(true)
    try {
      await window.echoflow.sendTranscript(t)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="view chat-page">
      <p className="eyebrow">Chat</p>
      <h1 className="page-title">Chat</h1>
      <p className="page-lead">
        If a name or detail isn't clear, EchoFlow asks here. Answer with Ctrl+Alt, or type below.
      </p>

      <div className="panel chat-panel">
        <div className="chat-thread" ref={threadRef} role="log" aria-live="polite">
          {messages.length === 0 && (
            <div className="chat-empty">
              <p>No messages yet.</p>
              <p className="muted">
                Try: <em>send an email to Alex saying I'll be late</em> — then type the address when
                asked.
              </p>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`chat-bubble chat-${m.role}`}>
              <div className="chat-role">
                {m.role === 'user' ? 'You' : m.role === 'assistant' ? 'EchoFlow' : 'System'}
              </div>
              <div className="chat-text">{m.text}</div>
            </div>
          ))}
        </div>

        <div className="chat-dock">
          {question && <p className="chat-ask">{question}</p>}
          <form className="composer" onSubmit={(e) => void send(e)}>
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={question ? 'Answer with Ctrl+Alt, or type here' : 'Type a reply'}
              disabled={busy}
              aria-label="Message"
            />
            <button type="submit" className="composer-send" disabled={busy || !text.trim()}>
              {busy ? 'Sending' : 'Send'}
            </button>
          </form>
          <div className="row chat-dock-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void window.echoflow.cancelClarify().then(() => setQuestion(null))}
            >
              Cancel question
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                void window.echoflow.clearChat().then((next) => {
                  setMessages(next)
                  setQuestion(null)
                })
              }
            >
              Clear chat
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
