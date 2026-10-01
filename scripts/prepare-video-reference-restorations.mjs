import fs from 'node:fs'
import path from 'node:path'

const input = process.argv[2]
const output = process.argv[3]
if (!input || !output) throw new Error('Usage: node scripts/prepare-video-reference-restorations.mjs <input.json> <output.json>')

const source = JSON.parse(fs.readFileSync(input, 'utf8'))
const cleanPath = (value) => typeof value === 'string' ? value.replace(/^.*\//, '') : value
const cleanEntry = (entry) => {
  const safe = { ...entry }
  delete safe.source_path
  if (Array.isArray(safe.timeline)) {
    safe.timeline = safe.timeline.map((segment) => ({
      ...segment,
      verification_frame_path: cleanPath(segment.verification_frame_path),
    }))
  }
  if (safe.verification_sheet_path) safe.verification_sheet_path = cleanPath(safe.verification_sheet_path)
  return safe
}

const sanitized = {
  schema_version: source.schema_version,
  created_at: source.created_at,
  definitions: source.definitions,
  quality_policy: source.quality_policy,
  full_representatives: source.full_representatives.map(cleanEntry),
  fragment_supplements: source.fragment_supplements.map(cleanEntry),
  excluded_unchanged: source.excluded_unchanged,
  summary: source.summary,
}

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, `${JSON.stringify(sanitized, null, 2)}\n`)
