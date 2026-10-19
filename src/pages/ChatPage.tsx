import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ChatMessage } from '../../shared/types'

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const ready = useRef(false)

  useEffect(() => {
    void window.echoflow.getChatMessages().then(setMessages)
    const off = window.echoflow.onChatUpdated(setMessages)
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
        When EchoFlow needs a detail — like which mail app to use, or someone's email address —
        it asks here. Type your answer and it continues the task.
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

        <form className="composer" onSubmit={(e) => void send(e)}>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a reply"
            disabled={busy}
            aria-label="Message"
          />
          <button type="submit" className="composer-send" disabled={busy || !text.trim()}>
            {busy ? 'Sending' : 'Send'}
          </button>
        </form>

        <div className="row" style={{ marginTop: 12, gap: 8 }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void window.echoflow.cancelClarify()}
          >
            Cancel question
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void window.echoflow.clearChat().then(setMessages)}
          >
            Clear chat
          </button>
        </div>
      </div>
    </div>
  )
}
