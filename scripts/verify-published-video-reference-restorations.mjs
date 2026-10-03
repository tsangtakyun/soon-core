import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const covers = JSON.parse(fs.readFileSync(path.join(root, 'data/content-direction-video-covers.json'), 'utf8'))
const restorations = JSON.parse(fs.readFileSync(path.join(root, 'data/published-video-reference-restorations.json'), 'utf8'))

const expectedCodes = covers.published_assets
  .filter((entry) => entry.format === 'human_short_video' || entry.format === 'ai_short_video')
  .map((entry) => entry.style_code)
  .sort()
const entries = restorations.published_representatives
const actualCodes = entries.map((entry) => entry.style_code).sort()

if (JSON.stringify(expectedCodes) !== JSON.stringify(actualCodes)) {
  const missing = expectedCodes.filter((code) => !actualCodes.includes(code))
  const extra = actualCodes.filter((code) => !expectedCodes.includes(code))
  throw new Error(`Published restoration coverage mismatch. Missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'}`)
}

for (const entry of entries) {
  if (!entry.timeline.length) throw new Error(`${entry.style_code} has no restoration timeline`)
  if (entry.timeline[0].start_seconds !== 0) throw new Error(`${entry.style_code} does not start at 0 seconds`)
  let cursor = 0
  for (const segment of entry.timeline) {
    if (Math.abs(segment.start_seconds - cursor) > 0.001) throw new Error(`${entry.style_code} has a timeline gap at ${cursor}`)
    if (segment.end_seconds <= segment.start_seconds) throw new Error(`${entry.style_code} has an invalid segment ending at ${segment.end_seconds}`)
    if (!segment.visual_description_zh) throw new Error(`${entry.style_code} has a segment without a visual description`)
    if (!Object.hasOwn(segment, 'speech_raw_asr')) throw new Error(`${entry.style_code} does not preserve raw ASR for every segment`)
    const displayedSpeech = String(segment.speech_or_narration_zh ?? '')
    if (/(Fromtimetotime){2,}|(朋友){4,}|(你在一起){3,}/i.test(displayedSpeech.replaceAll(' ', ''))) {
      throw new Error(`${entry.style_code} exposes repeated ASR hallucination in display text`)
    }
    cursor = segment.end_seconds
  }
  if (Math.abs(cursor - entry.duration_seconds) > 0.001) {
    throw new Error(`${entry.style_code} ends at ${cursor}, expected ${entry.duration_seconds}`)
  }
  if (entry.coverage_percent !== 100 || Math.abs(entry.coverage_seconds - entry.duration_seconds) > 0.001) {
    throw new Error(`${entry.style_code} is not marked as full coverage`)
  }
}

for (const code of ['ai_cinematic_founder_biography', 'route_led_city_portrait']) {
  const entry = entries.find((item) => item.style_code === code)
  if (!entry?.timeline.every((segment) => segment.speech_original && segment.speech_translation_zh_hant)) {
    throw new Error(`${code} must retain original speech and a labelled Traditional Chinese translation`)
  }
}

console.log(`Verified ${entries.length} published video restorations with complete timelines.`)
