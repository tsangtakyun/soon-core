import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

const root = process.cwd()
const manifest = JSON.parse(await fs.readFile(path.join(root, 'data/content-direction-video-covers.json'), 'utf8'))
const seen = new Set()

for (const cover of manifest.published_assets) {
  if (seen.has(cover.style_code)) throw new Error(`Duplicate video cover mapping: ${cover.style_code}`)
  seen.add(cover.style_code)
  const file = path.join(root, 'public', cover.asset.replace(/^\//, ''))
  const buffer = await fs.readFile(file)
  const metadata = await sharp(buffer).metadata()
  if (metadata.format !== 'jpeg' || metadata.width !== 1080 || metadata.height !== 1350) {
    throw new Error(`Invalid cover output for ${cover.style_code}: ${metadata.format} ${metadata.width}x${metadata.height}`)
  }
  const digest = createHash('sha256').update(buffer).digest('hex')
  if (digest !== cover.sha256) throw new Error(`Cover hash mismatch for ${cover.style_code}`)
}

for (const pending of manifest.review_new_pending) {
  if (pending.fallback?.use_source_frame !== false) throw new Error(`Pending-rights cover must not use source frame: ${pending.style_code}`)
}

if (seen.size !== manifest.summary.published_cover_count) throw new Error('Published cover count does not match manifest summary')
if (manifest.review_new_pending.length !== manifest.summary.review_new_pending_count) throw new Error('Pending cover count does not match manifest summary')
if (manifest.review_supplement_reuse.length !== manifest.summary.review_supplement_reuse_count) throw new Error('Reuse cover count does not match manifest summary')

console.log(`Verified ${seen.size} published video covers, ${manifest.review_new_pending.length} rights-pending fallbacks, and ${manifest.review_supplement_reuse.length} review reuses.`)
