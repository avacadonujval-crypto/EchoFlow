/**
 * Full local pass over what EchoFlow will do, and what it must not do
 * until the user answers. Does not shut down, sleep, send, call, or open apps.
 * Run: npx tsx scripts/test-everything.ts
 */
import { matchLocalCommand } from '../electron/commands/matcher'
import { applySpokenSchedule, mergeTaskReply, prepareTask } from '../electron/messagePlan'
import { parseWhen } from '../electron/when'
import { findStudio, toBuildPrompt } from '../electron/studio'
import { speechOpen } from '../shared/voice'
import type { ParsedAction } from '../shared/types'

let failed = 0
let passed = 0

function check(cond: boolean, msg: string): void {
  if (cond) {
    passed++
    console.log('ok ', msg)
    return
  }
  failed++
  console.error('FAIL', msg)
}

function hear(input: string): ParsedAction | null {
  return matchLocalCommand(input, [], []).action
}

function expect(input: string, action: string, target?: string): ParsedAction {
  const hit = hear(input)
  check(!!hit, `heard: ${input}`)
  check(hit?.action === action, `${input} → ${action}, got ${hit?.action ?? 'nothing'}`)
  if (target) check(hit?.target === target, `${input} target ${target}, got ${hit?.target}`)
  return hit ?? { action: 'unknown', source: 'local', rawText: input }
}

const willDo: Array<[string, string, string?]> = [
  ['pause', 'system', 'media_play'],
  ['next song', 'system', 'media_next'],
  ['previous song', 'system', 'media_prev'],
  ['brightness up', 'system', 'brightness_up'],
  ['dim the screen', 'system', 'brightness_down'],
  ['turn off wifi', 'system', 'wifi_off'],
  ['turn on wifi', 'system', 'wifi_on'],
  ['open downloads', 'open_url', 'shell:Downloads'],
  ['open documents', 'open_url', 'shell:Personal'],
  ['open desktop', 'open_url', 'shell:Desktop'],
  ['open my phone', 'open_url', 'ms-phone:'],
  ['show desktop', 'system', 'show_desktop'],
  ['minimize this window', 'system', 'minimize'],
  ['close this window', 'system', 'close_window'],
  ['switch window', 'system', 'switch_window'],
  ['copy that', 'keys', '^c'],
  ['paste', 'keys', '^v'],
  ['undo', 'keys', '^z'],
  ['select all', 'keys', '^a'],
  ['what time is it', 'reply'],
  ['what is the date', 'reply'],
  ['battery', 'system', 'battery'],
  ['night light', 'system', 'night_light'],
  ['sleep', 'system', 'sleep'],
  ['take a screenshot', 'system', 'screenshot'],
  ['volume up', 'system', 'volume_up'],
  ['mute', 'system', 'mute'],
  ['lock the screen', 'system', 'lock'],
  ['search for nike shoes', 'web_search'],
  ['open youtube and search for rain', 'youtube_search'],
  ['play boiling water on youtube', 'youtube_search'],
  ['directions to the airport', 'open_url'],
  ['open chrome', 'open_app'],
  ['open notepad', 'open_app'],
  ['set a timer for 10 minutes', 'system', 'notify'],
  ['remind me to buy milk at 6 pm', 'system', 'notify'],
  ['text Chayapathi saying hello', 'send_message', 'whatsapp'],
  ['send a message to Chayapathi saying hello', 'send_message', 'whatsapp'],
  ['call 9876543210', 'system', 'call'],
  ['build a website for a coffee shop called Bloom', 'system', 'build'],
  ['take a note saying buy milk', 'macro'],
  ['install vlc', 'install_app'],
]

for (const [input, action, target] of willDo) expect(input, action, target)

console.log('\n— will not act without an answer —')

function asks(input: string, includes: string): void {
  const hit = expect(input, hear(input)?.action ?? 'unknown', hear(input)?.target)
  const gate = prepareTask(hit)
  check(!!gate.question && gate.question.toLowerCase().includes(includes.toLowerCase()), `${input} asks (${gate.question ?? 'no question'})`)
  check(gate.missing.length > 0, `${input} stays blocked`)
}

asks('shut down the computer', 'shut down')
asks('restart the computer', 'restart')
asks('sign out', 'sign out')
asks('empty the recycle bin', 'recycle')
asks('build a website', 'what should the website')
asks('call mom', 'phone number')
asks('remind me to call mom', 'when')

const shutdown = expect('shut down the computer', 'system', 'shutdown')
const refused = mergeTaskReply(shutdown, ['confirmAction'], 'no')
check(refused.action === 'reply', 'no on shutdown cancels instead of powering off')
check(refused.responseText === 'Cancelled.', 'cancel message')
const armed = mergeTaskReply(shutdown, ['confirmAction'], 'yes')
check(armed.action === 'system' && armed.confirmed === true, 'yes only marks shutdown confirmed')
check(armed.target === 'shutdown', 'yes does not change the action into something else')

const vague = prepareTask(expect('build a website', 'system', 'build'))
const answered = mergeTaskReply(vague.ready, vague.missing, 'a bakery with a menu and a contact page')
const readySite = prepareTask(answered)
check(!readySite.question, 'a real website brief is allowed through')
check(toBuildPrompt(answered.responseText ?? '').includes('bakery'), 'prompt keeps the user words')

const message = expect('send a message to Chayapathi saying hello', 'send_message', 'whatsapp')
const who = prepareTask(message)
check(who.missing.includes('confirmContact') || who.missing.length === 0, 'message either confirms the name or uses a saved one')
if (who.question) check(/heard|mean/i.test(who.question), `unknown name is a question: ${who.question}`)

const noBody = prepareTask({
  action: 'send_message',
  target: 'whatsapp',
  query: 'Chayapathi',
  source: 'local',
  rawText: 'send a message to Chayapathi',
})
check(noBody.missing.includes('message') || noBody.missing.includes('confirmContact'), 'will not send an empty message')

const scheduled = applySpokenSchedule(message, 'send a message to Chayapathi at 4 pm saying hello')
check(scheduled.query === 'Chayapathi', `time is not part of the name (${scheduled.query})`)
check(!/4|pm/i.test(scheduled.query ?? ''), 'clock words stay out of the contact')
check(!!scheduled.runAt && new Date(scheduled.runAt).getHours() === 16, '4 pm is kept as the send time')

const now = new Date('2026-10-21T09:00:00').getTime()
const soon = parseWhen('set a timer for 10 minutes', now)
check(!!soon && soon.at - now === 10 * 60_000, 'timer for 10 minutes')
check(!parseWhen('hello there', now), 'plain speech has no hidden time')

check(hear('Hello team, here are my notes')?.action === 'dictate', 'notes are typed, not executed')
const shop = hear('I will open the shop tomorrow')
check(shop?.action !== 'open_app', 'a sentence about opening is not an app launch')

check(speechOpen(0, 'personal'), 'free plan can speak at zero words')
check(!speechOpen(2000, 'personal'), 'free plan stops at the word limit')
check(speechOpen(500_000, 'maison'), 'pro plus does not stop for word count')

const studio = findStudio()
check(!!studio && /cursor|code/i.test(studio?.name ?? ''), `found an AI studio (${studio?.name ?? 'none'})`)
check(toBuildPrompt('build a website for Bloom') === 'build a website for Bloom', 'build prompt is the user request')

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
