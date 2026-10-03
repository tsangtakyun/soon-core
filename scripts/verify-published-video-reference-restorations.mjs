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
    if (!Array.isArray(segment.speech_raw_asr_segments)) throw new Error(`${entry.style_code} does not preserve timestamped raw ASR segments`)
    const reconstructedRaw = segment.speech_raw_asr_segments.map((item) => String(item.text ?? '')).join('').trim()
    if (reconstructedRaw !== String(segment.speech_raw_asr ?? '')) throw new Error(`${entry.style_code} raw ASR no longer matches its immutable source segments`)
    if (!segment.speech_asr_cleaned) throw new Error(`${entry.style_code} has no separate cleaned transcript field`)
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

const allSegments = entries.flatMap((entry) => entry.timeline)
const unusableMarker = '語音未能可靠辨識，待人工核聽。'
const calculatedSummary = {
  timeline_segment_count: allSegments.length,
  usable_dialogue_or_caption_segment_count: allSegments.filter((segment) => segment.speech_or_narration_zh && segment.speech_or_narration_zh !== unusableMarker).length,
  pending_manual_audio_verification_segment_count: allSegments.filter((segment) => segment.verification?.audio !== 'manually_verified').length,
  unrecognizable_display_segment_count: allSegments.filter((segment) => segment.speech_or_narration_zh === unusableMarker).length,
}
for (const [key, value] of Object.entries(calculatedSummary)) {
  if (restorations.summary[key] !== value) throw new Error(`Summary ${key} is ${restorations.summary[key]}, expected ${value}`)
}

const founder = entries.find((entry) => entry.style_code === 'ai_cinematic_founder_biography')
if (!founder?.timeline.some((segment) => /From time to time to time/i.test(segment.speech_raw_asr))) {
  throw new Error('Founder raw ASR must preserve the original repeated hallucination for provenance')
}

const artist = entries.find((entry) => entry.style_code === 'ai_artist_reflective_monologue')
const expectedArtistCuts = [0, 19.16, 34.22, 55.82, 75.64, 90.96, 108.12, 136.44, 151.716]
if (!artist || artist.timeline.some((segment, index) => segment.start_seconds !== expectedArtistCuts[index] || segment.end_seconds !== expectedArtistCuts[index + 1])) {
  throw new Error('Artist restoration timeline no longer follows the verified ASR sentence boundaries')
}
if (!artist.timeline[0].speech_or_narration_zh.includes('我直到二十七歲才決定成為一名畫家')
  || artist.timeline[7].speech_or_narration_zh.includes('我不知道堅持是否一定會等來掌聲')) {
  throw new Error('Artist display transcript has a missing or cross-segment sentence')
}
if (founder.timeline.some((segment) => /From time to time to time/i.test(segment.speech_or_narration_zh))) {
  throw new Error('Founder display transcript exposes a raw ASR hallucination')
}

for (const code of ['ai_cinematic_founder_biography', 'route_led_city_portrait']) {
  const entry = entries.find((item) => item.style_code === code)
  if (!entry?.timeline.every((segment) => segment.speech_original && segment.speech_translation_zh_hant)) {
    throw new Error(`${code} must retain original speech and a labelled Traditional Chinese translation`)
  }
}

console.log(`Verified ${entries.length} published video restorations with complete timelines.`)
