/**
 * Create a project folder and hand the user's words to the AI studio on this PC.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

interface Studio {
  name: string
  exe: string
  kind: 'cursor' | 'code'
}

function existing(file: string): string | null {
  return fs.existsSync(file) ? file : null
}

export function findStudio(): Studio | null {
  const local = process.env.LOCALAPPDATA ?? ''
  const cursor =
    existing(path.join(local, 'Programs', 'cursor', 'Cursor.exe')) ??
    existing(path.join(local, 'Programs', 'Cursor', 'Cursor.exe'))
  if (cursor) return { name: 'Cursor', exe: cursor, kind: 'cursor' }

  const code =
    existing(path.join(local, 'Programs', 'Microsoft VS Code', 'Code.exe')) ??
    existing(path.join(process.env.ProgramFiles ?? '', 'Microsoft VS Code', 'Code.exe'))
  if (code) return { name: 'VS Code', exe: code, kind: 'code' }
  return null
}

function folderName(brief: string): string {
  const cleaned = brief
    .replace(/^(?:please\s+)?(?:build|make|create)\s+(?:me\s+)?(?:a\s+)?(?:new\s+)?/i, '')
    .replace(/^(?:website|site|web\s*app|webapp|landing\s+page|app)\b/i, '')
    .replace(/^(?:for|about|called|named)\s+/i, '')
  const skip = new Set(['a', 'an', 'the', 'with', 'and', 'for', 'my', 'me', 'to'])
  const words = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !skip.has(word))
    .slice(0, 4)
  const base = (words.join('-') || 'website').slice(0, 40)
  return base
}

export function toBuildPrompt(brief: string): string {
  const text = brief.replace(/\s+/g, ' ').trim()
  if (/^(?:build|make|create)\b/i.test(text)) return text
  return `Build a website: ${text}`
}

function open(file: string, args: string[]): void {
  const child = spawn(file, args, { detached: true, stdio: 'ignore', windowsHide: true })
  child.unref()
}

export async function buildInStudio(brief: string): Promise<string> {
  const studio = findStudio()
  if (!studio) {
    throw new Error('No AI studio is installed. Install Cursor and try again.')
  }

  const prompt = toBuildPrompt(brief).slice(0, 4000)
  const root = path.join(os.homedir(), 'Documents', 'EchoFlow')
  let name = folderName(prompt)
  let dir = path.join(root, name)
  if (fs.existsSync(dir)) {
    name = `${name}-${Date.now().toString().slice(-4)}`
    dir = path.join(root, name)
  }
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'PROMPT.md'), `${prompt}\n`, 'utf8')

  open(studio.exe, ['-n', dir])

  if (studio.kind === 'cursor') {
    await new Promise((resolve) => setTimeout(resolve, 2500))
    const link =
      'cursor://anysphere.cursor-deeplink/prompt?text=' +
      encodeURIComponent(prompt) +
      '&workspace=' +
      encodeURIComponent(name)
    open('cmd.exe', ['/c', 'start', '', link])
  }

  return `Created ${dir} and opened ${studio.name} with your prompt.`
}
