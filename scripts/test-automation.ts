/**
 * E2E test for the single-process keystroke automation:
 * open Notepad on a temp file, type + Ctrl+S in one PowerShell run,
 * then read the file back to verify.
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawn, execFile } from 'node:child_process'
import { runAutomation } from '../electron/executor'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const file = path.join(process.env.TEMP ?? '', 'echoflow-auto-test.txt')
  fs.writeFileSync(file, '')

  const notepad = spawn('notepad.exe', [file], { detached: true, stdio: 'ignore' })
  await sleep(2500)

  const t0 = Date.now()
  await runAutomation([
    { text: 'EchoFlow batched automation works. Special chars: 50% (cool) + more!', delayMs: 300 },
    { keys: '^s', delayMs: 800 },
  ])
  console.log('automation took', Date.now() - t0, 'ms (single PowerShell process)')

  await sleep(500)
  execFile('taskkill', ['/pid', String(notepad.pid), '/f', '/t'])
  await sleep(500)

  const content = fs.readFileSync(file, 'utf8')
  console.log('file content:', JSON.stringify(content))
  console.log(
    content.includes('EchoFlow batched automation works. Special chars: 50% (cool) + more!')
      ? 'E2E PASS'
      : 'E2E FAIL',
  )
  fs.unlinkSync(file)
}

void main()
