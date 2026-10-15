import { matchLocalCommand } from '../electron/commands/matcher'
import { parseSendIt, applySendItToAction } from '../electron/sendIt'
import { resolveEmailRecipient, isMyEmailShortcut } from '../electron/email'
import { prepareSendEmail } from '../electron/emailPlan'

console.log('=== send it ===')
for (const s of [
  'hello world and send it',
  'open notepad and write hello and send it',
  'send a message to mom saying good night and send it',
]) {
  console.log(JSON.stringify(s), '→', parseSendIt(s))
}

console.log('\n=== matcher send it ===')
const { action } = matchLocalCommand(
  'send a message to mom saying good night and send it',
  [],
  [],
)
console.log(action?.action, action?.responseText, 'submit=', action?.submit)

console.log('\n=== my email shortcuts ===')
const my = 'me@example.com'
for (const p of ['my email', 'email of mine', 'mine', 'alex@gmail.com']) {
  console.log(p, '→', resolveEmailRecipient(p, my), 'shortcut=', isMyEmailShortcut(p))
}

console.log('\n=== prepare email with shortcut ===')
const prep = prepareSendEmail({
  action: 'send_email',
  query: 'email of mine',
  responseText: 'test body',
  source: 'local',
  rawText: 'send email to email of mine saying test body',
})
// Mock myEmail in store - prepare uses getSettings() which may not have myEmail
console.log('missing', prep.missing, 'query', prep.ready.query)

console.log('\n=== applySendIt macro ===')
const macro = applySendItToAction(
  {
    action: 'macro',
    steps: [
      { action: 'open_app', target: 'notepad', source: 'local', rawText: '' },
      { action: 'dictate', responseText: 'hello there and send it', source: 'local', rawText: '' },
    ],
    source: 'local',
    rawText: 'open notepad and write hello there and send it',
  },
  'open notepad and write hello there and send it',
)
console.log('submit=', macro.submit, 'last step text=', macro.steps?.[1]?.responseText)
