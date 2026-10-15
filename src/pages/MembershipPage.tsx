import { useEffect, useState } from 'react'
import type { BillingCadence, Membership, MembershipPlan } from '../../shared/types'
import { planName } from '../../shared/voice'

const PLANS: {
  id: MembershipPlan
  name: string
  line: string
  monthly: number
  yearly: number
  points: string[]
}[] = [
  {
    id: 'personal',
    name: 'Free',
    line: '2,000 words',
    monthly: 0,
    yearly: 0,
    points: ['2,000 words', 'One voice', 'Daily intention'],
  },
  {
    id: 'studio',
    name: 'Pro',
    line: '200,000 words',
    monthly: 12,
    yearly: 96,
    points: ['200,000 words', 'Four voices', 'A count for each part of your day'],
  },
  {
    id: 'maison',
    name: 'Pro+',
    line: 'Unlimited words',
    monthly: 29,
    yearly: 240,
    points: ['Unlimited words', 'Twelve voices', 'Everything in Pro'],
  },
]

function priceLabel(plan: (typeof PLANS)[number], cadence: BillingCadence): string {
  if (plan.monthly === 0) return 'Included'
  if (cadence === 'yearly') return `$${plan.yearly} a year`
  return `$${plan.monthly} a month`
}

export function MembershipPage() {
  const [membership, setMembership] = useState<Membership | null>(null)
  const [cadence, setCadence] = useState<BillingCadence>('yearly')
  const [selected, setSelected] = useState<MembershipPlan>('studio')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    void window.echoflow.getMembership().then((current) => {
      setMembership(current)
      setSelected(current.plan)
      setCadence(current.cadence)
      setEmail(current.email)
    })
  }, [])

  if (!membership) return <p className="muted">Opening membership…</p>

  const chosen = PLANS.find((plan) => plan.id === selected) ?? PLANS[1]
  const needsEmail = selected !== 'personal'

  const confirm = async () => {
    if (needsEmail && !email.includes('@')) {
      setNote('Add an email so this plan has a name to return to.')
      return
    }
    const next = await window.echoflow.chooseMembership({
      plan: selected,
      cadence,
      email: needsEmail ? email.trim() : '',
    })
    setMembership(next)
    setNote(
      next.plan === 'personal'
        ? 'Free is active. You have not been charged.'
        : `${chosen.name} is saved on this computer. You have not been charged, and no card was stored.`,
    )
  }

  return (
    <div className="view">
      <p className="eyebrow">Membership</p>
      <h1 className="page-title">Membership</h1>
      <p className="page-lead">
        Free includes 2,000 words. Pro includes 200,000. Pro+ is unlimited. Speaking stops when Free or Pro is used up.
      </p>

      <div className="cadence" role="group" aria-label="Billing">
        <button
          type="button"
          className={cadence === 'monthly' ? 'on' : ''}
          onClick={() => setCadence('monthly')}
        >
          Monthly
        </button>
        <button
          type="button"
          className={cadence === 'yearly' ? 'on' : ''}
          onClick={() => setCadence('yearly')}
        >
          Yearly
        </button>
      </div>

      <div className="plan-list">
        {PLANS.map((plan) => (
          <button
            key={plan.id}
            type="button"
            className={`plan-row ${selected === plan.id ? 'selected' : ''}`}
            onClick={() => {
              setSelected(plan.id)
              setNote('')
            }}
          >
            <span className="plan-copy">
              <span className="plan-name">{plan.name}</span>
              <span className="plan-line">{plan.line}</span>
              <span className="plan-points">{plan.points.join(' · ')}</span>
            </span>
            <span className="plan-price">{priceLabel(plan, cadence)}</span>
          </button>
        ))}
      </div>

      <section className="panel">
        <p className="hint">
          {chosen.monthly === 0
            ? 'Free is included. Confirming it does not charge you.'
            : `${priceLabel(chosen, cadence)}. This choice is saved on this computer. You are not charged, and no card is stored.`}
        </p>
        {needsEmail ? (
          <div className="composer">
            <input
              id="billing-email"
              type="email"
              value={email}
              placeholder="Email"
              aria-label="Email"
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="button" className="composer-send" onClick={() => void confirm()}>
              {selected === membership.plan ? 'Keep' : 'Choose'}
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => void confirm()}>
            {selected === membership.plan ? 'Keep Free' : 'Choose Free'}
          </button>
        )}
        {note && <p className="hint">{note}</p>}
        {membership.plan !== 'personal' && membership.since > 0 && (
          <p className="hint" style={{ marginBottom: 0 }}>
            Current plan: {planName(membership.plan)} · {membership.cadence}
            {membership.email ? ` · ${membership.email}` : ''}
          </p>
        )}
      </section>
    </div>
  )
}
