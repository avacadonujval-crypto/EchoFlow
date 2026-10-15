import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Membership, VoiceProfile, VoiceStudio } from '../../shared/types'
import { intentionLine, lastSeven, milestoneLine, planName, profileLimit, wordAllowanceLabel } from '../../shared/voice'

export function VoicePage() {
  const [studio, setStudio] = useState<VoiceStudio | null>(null)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('120')

  const load = async () => {
    const [nextStudio, nextMembership] = await Promise.all([
      window.echoflow.getVoiceStudio(),
      window.echoflow.getMembership(),
    ])
    setStudio(nextStudio)
    setMembership(nextMembership)
    const active = nextStudio.profiles.find((profile) => profile.id === nextStudio.activeId)
    if (active) setGoal(String(active.dailyGoal))
  }

  useEffect(() => {
    void load()
    const off = window.echoflow.onHistoryUpdated(() => {
      void load()
    })
    return () => off()
  }, [])

  if (!studio || !membership) return <p className="muted">Opening your voice…</p>

  const active = studio.profiles.find((profile) => profile.id === studio.activeId) ?? studio.profiles[0]
  const limit = profileLimit(membership.plan)
  const roomForAnother = studio.profiles.length < limit
  const week = lastSeven(active)

  const saveGoal = async (profile: VoiceProfile) => {
    const dailyGoal = Number(goal)
    if (!Number.isFinite(dailyGoal) || dailyGoal < 1) return
    setStudio(await window.echoflow.saveVoiceProfile({ id: profile.id, name: profile.name, dailyGoal }))
  }

  return (
    <div className="view">
      <p className="eyebrow">Voice</p>
      <h1 className="page-title">{active.name}</h1>
      <p className="page-lead">{milestoneLine(active.words)}</p>

      <div className="studio-grid">
        <section className="panel voice-hero">
          <p className="stat-label">Words spoken</p>
          <p className="stat-figure">{active.words.toLocaleString()}</p>
          <p className="hint">{intentionLine(active.wordsToday, active.dailyGoal)}</p>
          <div className="week" aria-label="The last seven days">
            {week.map((day) => (
              <div key={day.day} className={`week-day ${day.words > 0 ? 'spoken' : ''}`}>
                <span>{day.day.slice(8)}</span>
              </div>
            ))}
          </div>
          <div className="stat-row">
            <div>
              <p className="stat-label">Days in a row</p>
              <p className="stat-quiet">{active.streak}</p>
            </div>
            <div>
              <p className="stat-label">Best run</p>
              <p className="stat-quiet">{active.bestStreak}</p>
            </div>
            <div>
              <p className="stat-label">Sessions</p>
              <p className="stat-quiet">{active.sessions}</p>
            </div>
          </div>
        </section>

        <section className="panel">
          <h2>Daily intention</h2>
          <p className="hint">
            A number you choose. It is a direction, not a debt. Missing a day simply starts a new one.
          </p>
          <label className="composer-label" htmlFor="daily-goal">
            Words for today
          </label>
          <div className="composer">
            <input
              id="daily-goal"
              inputMode="numeric"
              value={goal}
              aria-label="Daily word intention"
              onChange={(e) => setGoal(e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
            />
            <button type="button" className="composer-send" onClick={() => void saveGoal(active)}>
              Save
            </button>
          </div>
        </section>
      </div>

      <section className="panel">
        <h2>Voices</h2>
        <p className="hint">
          Each voice keeps its own word count. Words you speak land on the voice that is active.
        </p>
        <ul className="list">
          {studio.profiles.map((profile) => (
            <li key={profile.id}>
              <div>
                <div>{profile.name}</div>
                <div className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
                  {profile.words.toLocaleString()} words
                  {profile.id === studio.activeId ? ' · active' : ''}
                </div>
              </div>
              <div className="row">
                {profile.id !== studio.activeId && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => void window.echoflow.activateVoiceProfile(profile.id).then(setStudio)}
                  >
                    Use
                  </button>
                )}
                {studio.profiles.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => void window.echoflow.deleteVoiceProfile(profile.id).then(setStudio)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        {roomForAnother ? (
          <div className="composer" style={{ marginTop: 18 }}>
            <input
              id="voice-name"
              value={name}
              placeholder="New voice"
              aria-label="New voice"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) {
                  void window.echoflow.saveVoiceProfile({ name: name.trim() }).then((next) => {
                    setStudio(next)
                    setName('')
                  })
                }
              }}
            />
            <button
              type="button"
              className="composer-send"
              disabled={!name.trim()}
              onClick={async () => {
                if (!name.trim()) return
                setStudio(await window.echoflow.saveVoiceProfile({ name: name.trim() }))
                setName('')
              }}
            >
              Add
            </button>
          </div>
        ) : (
          <p className="hint" style={{ marginTop: 16, marginBottom: 0 }}>
            {membership.plan === 'personal'
              ? `${planName('personal')} includes ${wordAllowanceLabel('personal')} and one voice.`
              : membership.plan === 'studio'
                ? `${planName('studio')} includes ${wordAllowanceLabel('studio')} and four voices.`
                : `${planName('maison')} includes unlimited words and twelve voices.`}{' '}
            <Link to="/membership">See membership</Link>
          </p>
        )}
      </section>
    </div>
  )
}
