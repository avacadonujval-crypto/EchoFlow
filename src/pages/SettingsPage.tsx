import { useEffect, useState } from 'react'
import type { AppSettings, ChromeProfileInfo, CommandAlias, Macro, Snippet } from '../../shared/types'
import { SPEECH_LANGUAGES } from '../../shared/languages'

function Switch({
  on,
  onToggle,
}: {
  on: boolean
  onToggle: () => void
}) {
  return (
    <button type="button" className={`switch ${on ? 'on' : ''}`} onClick={onToggle} aria-pressed={on}>
      <span />
    </button>
  )
}

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [testMsg, setTestMsg] = useState<string | null>(null)
  const [aliases, setAliases] = useState<CommandAlias[]>([])
  const [macros, setMacros] = useState<Macro[]>([])
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [snippetName, setSnippetName] = useState('')
  const [snippetText, setSnippetText] = useState('')
  const [editingSnippet, setEditingSnippet] = useState<string | null>(null)
  const [aliasPhrase, setAliasPhrase] = useState('')
  const [aliasTarget, setAliasTarget] = useState('chrome')
  const [macroPhrase, setMacroPhrase] = useState('')
  const [version, setVersion] = useState('')
  const [chromeProfiles, setChromeProfiles] = useState<ChromeProfileInfo[]>([])

  const load = async () => {
    const s = await window.echoflow.getSettings()
    setSettings(s)
    setAliases(await window.echoflow.listAliases())
    setMacros(await window.echoflow.listMacros())
    setSnippets(await window.echoflow.listSnippets())
    setVersion(await window.echoflow.getVersion())
    setChromeProfiles(await window.echoflow.listChromeProfiles())
  }

  useEffect(() => {
    void load()
  }, [])

  if (!settings) return <p className="muted">Loading…</p>

  const testAi = async () => {
    const result = await window.echoflow.testGeminiKey()
    setTestMsg(result.ok ? 'Language service is working.' : 'Language service is unavailable.')
  }

  const patch = async (partial: Partial<AppSettings>) => {
    const next = await window.echoflow.updateSettings(partial)
    setSettings(next)
  }

  return (
    <div className="view">
      <h1 className="page-title">Settings</h1>
      <p className="page-lead">Shortcuts, aliases, and privacy controls. EchoFlow v{version}</p>

      <div className="panel">
        <h2>Your name</h2>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="display-name">The name on the first page</label>
          <input
            id="display-name"
            value={settings.displayName ?? ''}
            placeholder="Your name"
            onChange={(e) => void patch({ displayName: e.target.value.slice(0, 32) })}
          />
        </div>
      </div>

      <div className="panel">
        <h2>Language service</h2>
        <p className="hint">
          Everyday commands run on this PC. More complex requests use EchoFlow&apos;s language
          service. Connection details stay inside the app and are not shown here.
        </p>
        <div className="row">
          <span className={settings.geminiReady ? 'success' : 'error'}>
            {settings.geminiReady ? 'Configured' : 'Unavailable'}
          </span>
          <button type="button" className="btn btn-ghost" onClick={() => void testAi()}>
            Test connection
          </button>
        </div>
        {testMsg && (
          <p className={testMsg.includes('working') ? 'success' : 'error'}>{testMsg}</p>
        )}
      </div>

      <div className="panel">
        <h2>Behavior</h2>
        <div className="toggle">
          <div>
            <div>Auto-paste dictation</div>
            <div className="muted" style={{ fontSize: '0.85rem' }}>
              Paste transcript into the focused app on release
            </div>
          </div>
          <Switch on={settings.autoPaste} onToggle={() => void patch({ autoPaste: !settings.autoPaste })} />
        </div>
        <div className="toggle">
          <div>
            <div>Show listening overlay</div>
            <div className="muted" style={{ fontSize: '0.85rem' }}>
              Floating pill while you speak
            </div>
          </div>
          <Switch on={settings.showOverlay} onToggle={() => void patch({ showOverlay: !settings.showOverlay })} />
        </div>
        <div className="toggle">
          <div>
            <div>Launch at Windows startup</div>
            <div className="muted" style={{ fontSize: '0.85rem' }}>
              Keep EchoFlow in the tray
            </div>
          </div>
          <Switch
            on={settings.launchAtStartup}
            onToggle={() => void patch({ launchAtStartup: !settings.launchAtStartup })}
          />
        </div>
        <div className="field" style={{ marginTop: 18, marginBottom: 0 }}>
          <label htmlFor="speech-language">Speech language</label>
          <select
            id="speech-language"
            value={settings.speechLanguage ?? 'auto'}
            onChange={(e) => void patch({ speechLanguage: e.target.value })}
          >
            {SPEECH_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
                {lang.nativeName && lang.code !== 'auto' ? ` — ${lang.nativeName}` : ''}
              </option>
            ))}
          </select>
          <p className="hint" style={{ margin: '8px 0 0' }}>
            Speak in Kannada, Hindi, Tamil, Telugu, English, or 15+ languages. Auto-detect works for
            mixed speech too. Commands and dictation stay in your language.
          </p>
        </div>
        <div className="field" style={{ marginTop: 18, marginBottom: 0 }}>
          <label htmlFor="my-email">My email address</label>
          <input
            id="my-email"
            type="email"
            placeholder="you@example.com"
            value={settings.myEmail ?? ''}
            onChange={(e) => void patch({ myEmail: e.target.value.trim() })}
          />
          <p className="hint" style={{ margin: '8px 0 0' }}>
            Say <em>my email</em> or <em>email of mine</em> when sending mail — EchoFlow fills in this
            address automatically.
          </p>
        </div>
        <div className="field" style={{ marginTop: 18, marginBottom: 0 }}>
          <label htmlFor="chrome-account">Default Chrome account</label>
          <select
            id="chrome-account"
            value={settings.defaultChromeAccount ?? 'ask'}
            onChange={(e) => void patch({ defaultChromeAccount: e.target.value })}
          >
            <option value="ask">Always ask in Chat (recommended)</option>
            {chromeProfiles.map((p) => (
              <option key={p.profileDir} value={p.profileDir}>
                {p.email || p.label}
                {p.email && p.label !== p.email ? ` — ${p.label}` : ''}
              </option>
            ))}
          </select>
          <p className="hint" style={{ margin: '8px 0 0' }}>
            Email, booking, and other signed-in websites open in this Chrome profile. If set to
            &quot;Always ask&quot;, EchoFlow lists your Chrome accounts in Chat before sending mail
            or opening booking sites.
          </p>
          {chromeProfiles.length === 0 && (
            <p className="hint" style={{ margin: '8px 0 0' }}>
              No Chrome profiles found — sign into Google in Chrome, then refresh Settings.
            </p>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            style={{ marginTop: 10 }}
            onClick={() =>
              void window.echoflow.listChromeProfiles().then(setChromeProfiles)
            }
          >
            Refresh Chrome accounts
          </button>
        </div>
        <div className="field" style={{ marginTop: 18, marginBottom: 0 }}>
          <label htmlFor="email-client">Default email app</label>
          <select
            id="email-client"
            value={settings.defaultEmailClient ?? 'gmail'}
            onChange={(e) =>
              void patch({
                defaultEmailClient: e.target.value as AppSettings['defaultEmailClient'],
              })
            }
          >
            <option value="gmail">Gmail (recommended)</option>
            <option value="outlook">Outlook</option>
            <option value="ask">Always ask in Chat</option>
          </select>
          <p className="hint" style={{ margin: '8px 0 0' }}>
            Used when you say &quot;send an email&quot; without naming Gmail or Outlook. If set to
            &quot;Always ask&quot;, EchoFlow opens Chat for you to choose.
          </p>
        </div>
        <p className="hint" style={{ marginTop: 16, marginBottom: 0 }}>
          Push-to-talk: <span className="kbd">Ctrl</span> + <span className="kbd">Alt</span> (hold).
          Tap-to-speak from the Hub is also available. Always-on listening is intentionally not
          included.
        </p>
      </div>

      <div className="panel">
        <h2>Snippets</h2>
        <p className="hint">Say the name, and EchoFlow types the full text.</p>
        <div className="field">
          <label htmlFor="snippet-name">Name</label>
          <input
            id="snippet-name"
            value={snippetName}
            placeholder="my email address"
            onChange={(e) => setSnippetName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="snippet-text">Text</label>
          <textarea
            id="snippet-text"
            rows={3}
            value={snippetText}
            placeholder="avacadonujval@gmail.com"
            onChange={(e) => setSnippetText(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!snippetName.trim() || !snippetText.trim()}
          onClick={async () => {
            const next = await window.echoflow.saveSnippet({
              id: editingSnippet ?? crypto.randomUUID(),
              phrase: snippetName.trim(),
              expansion: snippetText.trim(),
              createdAt: Date.now(),
            })
            setSnippets(next)
            setSnippetName('')
            setSnippetText('')
            setEditingSnippet(null)
          }}
        >
          {editingSnippet ? 'Save snippet' : 'Add snippet'}
        </button>
        {snippets.length > 0 && (
          <ul className="list snippet-list">
            {snippets.map((snippet) => (
              <li key={snippet.id}>
                <div className="snippet-line">
                  <span>{snippet.phrase}</span>
                  <span className="muted">→</span>
                  <span className="snippet-body">{snippet.expansion}</span>
                </div>
                <div className="row">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setEditingSnippet(snippet.id)
                      setSnippetName(snippet.phrase)
                      setSnippetText(snippet.expansion)
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={async () => setSnippets(await window.echoflow.deleteSnippet(snippet.id))}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel">
        <h2>Custom aliases</h2>
        <p className="hint">Map a phrase to an open action, e.g. “open my mail” → Gmail.</p>
        <div className="row" style={{ alignItems: 'stretch' }}>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label>Phrase</label>
            <input value={aliasPhrase} onChange={(e) => setAliasPhrase(e.target.value)} placeholder="open my mail" />
          </div>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label>Target URL or app</label>
            <input value={aliasTarget} onChange={(e) => setAliasTarget(e.target.value)} placeholder="https://mail.google.com" />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ alignSelf: 'flex-end' }}
            onClick={async () => {
              if (!aliasPhrase.trim() || !aliasTarget.trim()) return
              const isUrl = aliasTarget.includes('://') || aliasTarget.includes('.')
              const next = await window.echoflow.saveAlias({
                id: crypto.randomUUID(),
                phrase: aliasPhrase.trim(),
                action: isUrl ? 'open_url' : 'open_app',
                target: aliasTarget.trim(),
                createdAt: Date.now(),
              })
              setAliases(next)
              setAliasPhrase('')
            }}
          >
            Add
          </button>
        </div>
        <ul className="list">
          {aliases.map((a) => (
            <li key={a.id}>
              <div>
                <div>{a.phrase}</div>
                <div className="muted" style={{ fontSize: '0.8rem' }}>
                  {a.action} → {a.target}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => setAliases(await window.echoflow.deleteAlias(a.id))}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <h2>Macros</h2>
        <p className="hint">
          Chain actions under one phrase. Starter: “start my workday” opens Chrome, Gmail, and Slack.
        </p>
        <div className="row">
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label>Trigger phrase</label>
            <input
              value={macroPhrase}
              onChange={(e) => setMacroPhrase(e.target.value)}
              placeholder="start my workday"
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ alignSelf: 'flex-end' }}
            onClick={async () => {
              const phrase = macroPhrase.trim() || 'start my workday'
              const next = await window.echoflow.saveMacro({
                id: crypto.randomUUID(),
                phrase,
                steps: [
                  { action: 'open_app', target: 'chrome', delayMs: 600 },
                  { action: 'open_url', target: 'https://mail.google.com', delayMs: 600 },
                  { action: 'open_url', target: 'slack:', delayMs: 600 },
                ],
                createdAt: Date.now(),
              })
              setMacros(next)
              setMacroPhrase('')
            }}
          >
            Add workday macro
          </button>
        </div>
        <ul className="list">
          {macros.map((m) => (
            <li key={m.id}>
              <div>
                <div>{m.phrase}</div>
                <div className="muted" style={{ fontSize: '0.8rem' }}>
                  {m.steps.length} steps
                </div>
              </div>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => setMacros(await window.echoflow.deleteMacro(m.id))}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <h2>History</h2>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => void window.echoflow.clearHistory()}
        >
          Clear command history
        </button>
      </div>
    </div>
  )
}
