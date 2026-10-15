/** Copy built NSIS installer into website/downloads for static hosting. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const releaseDir = path.join(root, 'release')
const downloadsDir = path.join(root, 'website', 'downloads')

if (!fs.existsSync(releaseDir)) {
  console.error('[stage-website] No release/ folder — run electron-builder first.')
  process.exit(1)
}

const exe = fs
  .readdirSync(releaseDir)
  .find((f) => f.endsWith('.exe') && f.toLowerCase().includes('setup'))

if (!exe) {
  console.error('[stage-website] No Setup .exe found in release/')
  process.exit(1)
}

fs.mkdirSync(downloadsDir, { recursive: true })

// Clear old installers
for (const f of fs.readdirSync(downloadsDir)) {
  if (f.endsWith('.exe')) fs.unlinkSync(path.join(downloadsDir, f))
}

const src = path.join(releaseDir, exe)
const dest = path.join(downloadsDir, exe)
fs.copyFileSync(src, dest)

const mb = (fs.statSync(dest).size / (1024 * 1024)).toFixed(1)
console.log(`[stage-website] Staged ${exe} (${mb} MB) → website/downloads/`)

// Write manifest for site.js
const manifest = {
  version: exe.match(/(\d+\.\d+\.\d+)/)?.[1] ?? '1.0.0',
  file: exe,
  sizeBytes: fs.statSync(dest).size,
  updatedAt: new Date().toISOString(),
}
fs.writeFileSync(
  path.join(downloadsDir, 'manifest.json'),
  JSON.stringify(manifest, null, 2),
)
