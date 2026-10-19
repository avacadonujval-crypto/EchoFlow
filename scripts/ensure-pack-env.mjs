/** Ensure .env exists for electron-builder extraResources (local or CI). */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const envPath = path.join(root, '.env')

if (fs.existsSync(envPath)) {
  console.log('[ensure-pack-env] Using existing .env')
  process.exit(0)
}

const key = process.env.ECHOFLOW_GEMINI_API_KEY?.trim()
if (!key) {
  console.error(
    '[ensure-pack-env] Missing .env and ECHOFLOW_GEMINI_API_KEY — packaged speech will not work.',
  )
  process.exit(1)
}

fs.writeFileSync(
  envPath,
  `# Generated at build time — do not commit\nECHOFLOW_GEMINI_API_KEY=${key}\n`,
  'utf8',
)
console.log('[ensure-pack-env] Wrote .env from ECHOFLOW_GEMINI_API_KEY')
