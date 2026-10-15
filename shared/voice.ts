import type { MembershipPlan, VoiceProfile } from './types'

export function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length > 1 || /[A-Za-z0-9]/.test(trimmed)) return parts.length
  return Math.max(1, Math.round(trimmed.length / 2))
}

export function localDay(time = Date.now()): string {
  const d = new Date(time)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(y, (m || 1) - 1, d || 1)
  date.setDate(date.getDate() + delta)
  return localDay(date.getTime())
}

export function profileLimit(plan: MembershipPlan): number {
  if (plan === 'maison') return 12
  if (plan === 'studio') return 4
  return 1
}

/** Words included with the plan. Null means unlimited. */
export function wordAllowance(plan: MembershipPlan): number | null {
  if (plan === 'maison') return null
  if (plan === 'studio') return 200_000
  return 2_000
}

export function wordAllowanceLabel(plan: MembershipPlan): string {
  const limit = wordAllowance(plan)
  if (limit === null) return 'Unlimited words'
  return `${limit.toLocaleString()} words`
}

export function wordsRemaining(used: number, plan: MembershipPlan): number | null {
  const limit = wordAllowance(plan)
  if (limit === null) return null
  return Math.max(0, limit - used)
}

export function planName(plan: MembershipPlan): string {
  if (plan === 'maison') return 'Pro+'
  if (plan === 'studio') return 'Pro'
  return 'Free'
}

/** Free and Pro stop at their word allowance. Pro+ does not. */
export function speechOpen(used: number, plan: MembershipPlan): boolean {
  const limit = wordAllowance(plan)
  return limit === null || used < limit
}

export function intentionLine(today: number, goal: number): string {
  if (goal <= 0) return 'Set a daily intention when you want a gentle target.'
  if (today <= 0) return `Today’s intention is ${goal} words. One sentence begins it.`
  if (today < goal) {
    const left = goal - today
    return left <= 15 ? `${left} words close today’s ring.` : `${today} of ${goal} words today.`
  }
  return `You met today’s intention. ${today.toLocaleString()} words.`
}

export function milestoneLine(words: number): string {
  if (words <= 0) return 'Your first sentence starts the count.'
  if (words < 40) return 'A beginning. Another sentence will feel familiar.'
  if (words < 150) return 'Enough for a note you would have typed.'
  if (words < 600) return 'A page, spoken instead of typed.'
  if (words < 1000) return 'You are close to a thousand words.'
  if (words < 5000) return 'A thousand words is a short essay. You are past that.'
  return 'This voice has a long memory now.'
}

export function lastSeven(profile: VoiceProfile, today = localDay()): { day: string; words: number }[] {
  const days: { day: string; words: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const day = shiftDay(today, -i)
    days.push({ day, words: profile.days[day] ?? 0 })
  }
  return days
}
