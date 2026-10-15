/**
 * Lexicon cleanup for common command mishearings after STT (English only).
 */
const REPLACEMENTS: Array<[RegExp, string]> = [
  [/\byou\s*tube\b/gi, 'YouTube'],
  [/\bu\s*tube\b/gi, 'YouTube'],
  [/\bnote\s*pad\b/gi, 'Notepad'],
  [/\bchrome\b/gi, 'Chrome'],
  [/\bgoogle\s*chrome\b/gi, 'Google Chrome'],
  [/\bvs\s*code\b/gi, 'VS Code'],
  [/\bvisual\s*studio\s*code\b/gi, 'VS Code'],
  [/\bgmail\b/gi, 'Gmail'],
  [/\bspot\s*ify\b/gi, 'Spotify'],
  [/\bdisc\s*ord\b/gi, 'Discord'],
  [/\bgoo+gle\b/gi, 'Google'],
  [/\bsearch\s+for\s+for\b/gi, 'search for'],
  [/\bopen\s+up\b/gi, 'open'],
  [/\bsend\s+it\b/gi, 'send it'],
  [/\bemail\s+of\s+mine\b/gi, 'email of mine'],
  [/\bmy\s+email\b/gi, 'my email'],
]

const SPOKEN_MARKS: Array<[RegExp, string]> = [
  [/\bquestion mark\b/gi, '?'],
  [/\bexclamation (?:point|mark)\b/gi, '!'],
  [/\bdot dot dot\b/gi, '…'],
  [/\bellipsis\b/gi, '…'],
  [/\bnew paragraph\b/gi, '\n\n'],
  [/\b(?:new line|newline)\b/gi, '\n'],
  [/\bopen quote\b/gi, '“'],
  [/\b(?:close quote|end quote|unquote)\b/gi, '”'],
  [/\bsemicolon\b/gi, ';'],
  [/\bcolon\b/gi, ':'],
  [/\bcomma\b(?!\s+separated)/gi, ','],
  [/\b(?:full stop|period)\b(?!\s+(?:of|piece|drama))/gi, '.'],
  [/\bhyphen\b/gi, '-'],
  [/\bdash\b/gi, '—'],
]

function tidyMarks(text: string): string {
  return text
    .replace(/[ \t]+([,.;:!?…])/g, '$1')
    .replace(/([,;:])(?=[^\s\n\d])/g, '$1 ')
    .replace(/([.!?…])(?=[A-Za-z“])/g, '$1 ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .trim()
}

function capitalizeSentences(text: string): string {
  return text.replace(/(^|[.!?…]\s+|\n+)([a-z])/g, (_match, lead: string, letter: string) => {
    return lead + letter.toUpperCase()
  })
}

function finishSentence(text: string): string {
  if (!text || /[.!?…]["”]?\s*$/.test(text)) return text
  const started = /^[a-z]/.test(text) ? text.charAt(0).toUpperCase() + text.slice(1) : text
  return `${started}.`
}

export function polishTranscript(raw: string): string {
  let text = raw.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim()
  text = text.replace(/^[,.\-–—:\s]+/, '')
  const hasIndicOrCjk = /[\u0900-\u0dff\u0b80-\u0bff\u0c00-\u0c7f\u3040-\u4dbf\uac00-\ud7af\u0600-\u06ff]/.test(
    text,
  )
  if (!hasIndicOrCjk) {
    for (const [re, to] of SPOKEN_MARKS) text = text.replace(re, to)
    for (const [re, to] of REPLACEMENTS) text = text.replace(re, to)
    text = tidyMarks(text)
    text = capitalizeSentences(text)
    text = finishSentence(text)
  }
  return text.trim()
}
