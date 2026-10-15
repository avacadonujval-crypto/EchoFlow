import { prepareWebAction, mergeWebClarifyReply } from '../electron/webSessionPlan'
import { listChromeProfiles } from '../electron/chromeProfiles'

console.log('=== Chrome profiles on this PC ===')
const profiles = listChromeProfiles(true)
for (const p of profiles) {
  console.log(`  ${p.profileDir}: ${p.email || p.label}`)
}

console.log('\n=== prepareWebAction: send email (should ask account if ask + multi) ===')
const prep = prepareWebAction({
  action: 'send_email',
  target: 'gmail',
  query: 'dummy@test.com',
  responseText: 'Hello dummy test',
  source: 'local',
  rawText: 'send email to dummy@test.com saying hello dummy test',
})
console.log('missing:', prep.missing)
console.log('question:', prep.question?.slice(0, 120))

if (prep.missing.includes('chromeAccount') && prep.question) {
  const pick = profiles[0]?.email || profiles[0]?.label || '1'
  console.log('\n=== merge account reply:', pick, '===')
  const merged = mergeWebClarifyReply(prep.ready, prep.missing, pick)
  const prep2 = prepareWebAction(merged)
  console.log('after account — missing:', prep2.missing, 'profile:', prep2.ready.chromeProfile)
}

console.log('\n=== prepareWebAction: booking URL ===')
const book = prepareWebAction({
  action: 'open_url',
  target: 'https://www.makemytrip.com/flights/',
  source: 'gemini',
  rawText: 'book a flight on makemytrip',
})
console.log('missing:', book.missing)
console.log('needs account:', book.missing.includes('chromeAccount'))
