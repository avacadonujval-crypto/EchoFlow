import { matchLocalCommand } from '../electron/commands/matcher'

const cases = [
  'open chrome and search programming',
  'open chromeo and search programming',
  'open google chrome and search for react tutorials',
  'open edge and search weather today',
  'open firefox and search rust lang',
  'search for programming',
  'open youtube and search for lo-fi beats',
]
for (const c of cases) {
  const { action } = matchLocalCommand(c, [], [])
  console.log(
    JSON.stringify(c).padEnd(55),
    '→',
    action
      ? `${action.action} target=${action.target ?? ''} query=${action.query ?? ''}`
      : '(gemini)',
  )
}
