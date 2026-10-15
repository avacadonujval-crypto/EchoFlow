import { matchLocalCommand } from '../electron/commands/matcher'
import { normalizeSpokenEmail, buildGmailComposeUrl } from '../electron/email'
import { prepareSendEmail, mergeClarifyReply } from '../electron/emailPlan'
import { classifyWithGemini } from '../electron/gemini'
import { getGeminiApiKey } from '../electron/secrets'
import type { ParsedAction } from '../shared/types'

console.log('=== normalizeSpokenEmail ===')
for (const s of [
  'alex@gmail.com',
  'alex at gmail dot com',
  'John.Smith at company dot co dot uk',
  'not an email',
]) {
  console.log(JSON.stringify(s), '→', normalizeSpokenEmail(s))
}

console.log('\n=== matcher ===')
for (const p of [
  'send an email to alex at gmail dot com saying I will be late',
  'email bob@company.com from outlook saying hello',
  'send an email to Sarah saying hello',
  'email john about the meeting saying can we reschedule',
]) {
  const { action } = matchLocalCommand(p, [], [])
  console.log(
    JSON.stringify(p).slice(0, 70).padEnd(72),
    '→',
    action
      ? `${action.action} to=${action.query} via=${action.target ?? '-'} sub=${action.subject ?? '-'} body=${(action.responseText ?? '').slice(0, 40)}`
      : '(gemini)',
  )
}

console.log('\n=== prepare / clarify ===')
{
  const draft: ParsedAction = {
    action: 'send_email',
    query: 'Sarah',
    responseText: 'hello',
    source: 'local',
    rawText: 'send an email to Sarah saying hello',
  }
  const prep = prepareSendEmail(draft)
  console.log('missing', prep.missing, 'q=', prep.question)
  console.log('provider default', prep.ready.target)

  const merged = mergeClarifyReply(prep.ready, prep.missing, 'sarah at gmail dot com')
  const prep2 = prepareSendEmail(merged)
  console.log('after address', prep2.missing, prep2.ready.query, prep2.ready.target)
}

console.log('\n=== gmail url ===')
console.log(
  buildGmailComposeUrl({
    to: 'alex@gmail.com',
    subject: 'Hi',
    body: 'Hello there',
  }),
)

async function planner() {
  console.log('\n=== planner ===')
  const key = getGeminiApiKey()
  for (const p of [
    'send an email to alex at gmail dot com saying I will be late',
    'email someone from outlook or gmail saying hi',
  ]) {
    const a = await classifyWithGemini(key, p, [])
    console.log(
      JSON.stringify(p).slice(0, 60).padEnd(62),
      '→',
      a.action,
      a.target,
      a.query,
      a.subject ?? '',
      (a.responseText ?? '').slice(0, 40),
    )
  }
}

void planner()
