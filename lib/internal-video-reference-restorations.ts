import 'server-only'

import restorationPackage from '@/data/renee-video-reference-restorations.json'
import publishedRestorationPackage from '@/data/published-video-reference-restorations.json'
import reconstructionPackage from '@/data/renee-ai-reconstruction-experiment-prompts.json'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

const CORE_WORKSPACE_ID = 'a5c7750e-1b3b-495b-8cd3-6e1d47d05ef2'
const SOURCE_PREFIX = 'local-reference://renee-video-restoration/2026-10-01/'
const PUBLISHED_SOURCE_PREFIX = 'local-reference://published-video-restoration/2026-10-03/'
const PROMPT_SOURCE_PREFIX = 'local-reference://renee-ai-reconstruction-prompt/2026-10-01/'
const HUMAN_SOURCE = 'renee_reference_intake_2026_09_29'
const AI_SOURCE = 'renee_ai_video_reference_intake_2026_09_29'

type JsonRecord = Record<string, unknown>
type FullEntry = (typeof restorationPackage.full_representatives)[number]
type FragmentEntry = (typeof restorationPackage.fragment_supplements)[number]
type PublishedEntry = (typeof publishedRestorationPackage.published_representatives)[number]

export type VideoReferenceRestoration = {
  id: string
  styleCode: string
  styleName: string
  styleVersionId: string
  version: number
  status: string
  sourceUrl: string
  referenceKey: string
  format: 'human' | 'ai'
  selection: 'full_representative' | 'fragment_supplement'
  role: string
  sourceFilename: string
  durationSeconds: number
  coverageSeconds: number
  coveragePercent: number
  audioTranscriptStatus: string
  visualStatus: string
  rightsState: string
  timeline: JsonRecord[]
  unverified: string[]
}

export type AiReconstructionPromptSet = {
  id: string
  styleCode: string
  styleName: string
  styleVersionId: string
  version: number
  status: string
  referenceKey: string
  displayName: string
  promptStatus: string
  sourceDurationSeconds: number
  shotCount: number
  shots: JsonRecord[]
  unverified: string[]
}

function targetStyleCode(entry: FullEntry | FragmentEntry) {
  return entry.style_code === 'research_only' ? 'ai_artist_reflective_monologue' : entry.style_code
}

function sourceUrl(entry: FullEntry | FragmentEntry) {
  if ('fragment' in entry) return `${SOURCE_PREFIX}${entry.reference_key}/${entry.fragment.start_seconds}-${entry.fragment.end_seconds}`
  return `${SOURCE_PREFIX}${entry.reference_key}/full`
}

function publishedSourceUrl(entry: PublishedEntry) {
  return `${PUBLISHED_SOURCE_PREFIX}${entry.style_code}/full`
}

function publishedExtractedPatterns(entry: PublishedEntry): JsonRecord {
  return {
    artifact_type: 'original_video_restoration',
    artifact_label_zh: '原片還原稿',
    semantic_separation: {
      original_video_restoration: 'stored_here',
      style_specification: 'linked_published_style_version',
      demonstration_script: 'separate_artifact_not_in_this_record',
      reconstruction_prompt: 'separate_artifact_not_in_this_record',
    },
    reference_key: entry.reference_key,
    format: entry.format,
    source_id: entry.source_id,
    source_filename: entry.source_filename,
    duration_seconds: entry.duration_seconds,
    selection: entry.selection,
    source_style_code: entry.style_code,
    target_style_code: entry.style_code,
    role: entry.role,
    rights_state: entry.rights_state,
    restoration_scope: entry.restoration_scope,
    coverage_seconds: entry.coverage_seconds,
    coverage_percent: entry.coverage_percent,
    audio_transcript_status: entry.audio_transcript_status,
    visual_status: entry.visual_status,
    timeline: entry.timeline,
    unverified: entry.unverified,
    rights_policy: {
      internal_research_only: true,
      playable_reference: true,
      reupload_allowed: false,
    },
  }
}

function extractedPatterns(entry: FullEntry | FragmentEntry): JsonRecord {
  const isFragment = 'fragment' in entry
  const timeline = isFragment
    ? [{
        order: 1,
        start_seconds: entry.fragment.start_seconds,
        end_seconds: entry.fragment.end_seconds,
        visual_description_zh: entry.fragment.visual_description_zh,
        speech_or_narration_zh: null,
        speech_source: entry.fragment.speech_status,
        on_screen_text_zh: null,
        verification: {
          visual: 'described_from_source_delivery',
          audio: 'pending_manual_listening',
          translation: 'pending_when_applicable',
        },
        notes: entry.notes.join('；') || null,
      }]
    : entry.timeline
  const coverageSeconds = isFragment
    ? Number((entry.fragment.end_seconds - entry.fragment.start_seconds).toFixed(3))
    : entry.coverage_seconds
  return {
    artifact_type: 'original_video_restoration',
    artifact_label_zh: '原片還原稿',
    semantic_separation: {
      original_video_restoration: 'stored_here',
      style_specification: 'linked_style_version',
      demonstration_script: 'separate_artifact_not_in_this_record',
      reconstruction_prompt: 'not_delivered_not_enabled',
    },
    reference_key: entry.reference_key,
    format: entry.format,
    source_id: entry.source_id,
    source_filename: entry.source_filename,
    duration_seconds: entry.duration_seconds,
    selection: entry.selection,
    source_style_code: entry.style_code,
    target_style_code: targetStyleCode(entry),
    role: entry.role,
    rights_state: entry.rights_state,
    restoration_scope: isFragment ? 'selected_fragment_only' : entry.restoration_scope,
    coverage_seconds: coverageSeconds,
    coverage_percent: isFragment ? Number(((coverageSeconds / entry.duration_seconds) * 100).toFixed(2)) : entry.coverage_percent,
    audio_transcript_status: isFragment ? entry.fragment.speech_status : entry.audio_transcript_status,
    visual_status: isFragment ? 'delivered_fragment_description' : entry.visual_status,
    timeline,
    unverified: isFragment ? entry.notes : entry.unverified,
    rights_policy: {
      internal_research_only: true,
      playable_reference: false,
      reupload_allowed: false,
    },
  }
}

function allEntries(): Array<FullEntry | FragmentEntry> {
  return [...restorationPackage.full_representatives, ...restorationPackage.fragment_supplements]
}

export async function loadVideoReferenceRestorations(format?: 'human' | 'ai'): Promise<VideoReferenceRestoration[]> {
  const admin = createSupabaseAdmin()
  const query = admin.from('style_references')
    .select('id,style_id,style_version_id,source_url,extracted_patterns,confirmation_status')
    .or(`source_url.like.${SOURCE_PREFIX}%,source_url.like.${PUBLISHED_SOURCE_PREFIX}%`)
    .eq('confirmation_status', 'review')
  const { data: references, error } = await query
  if (error) throw error
  const filtered = (references ?? []).filter((reference) => {
    const patterns = reference.extracted_patterns as JsonRecord
    return !format || patterns.format === format
  })
  if (!filtered.length) return []
  const styleIds = [...new Set(filtered.map((reference) => reference.style_id))]
  const versionIds = [...new Set(filtered.map((reference) => reference.style_version_id).filter(Boolean))]
  const [{ data: styles, error: styleError }, { data: versions, error: versionError }] = await Promise.all([
    admin.from('content_styles').select('id,code,name').in('id', styleIds),
    admin.from('style_versions').select('id,version,status').in('id', versionIds),
  ])
  if (styleError || versionError) throw styleError || versionError
  const styleById = new Map((styles ?? []).map((style) => [style.id, style]))
  const versionById = new Map((versions ?? []).map((version) => [version.id, version]))
  return filtered.map((reference) => {
    const patterns = reference.extracted_patterns as JsonRecord
    const style = styleById.get(reference.style_id)
    const version = versionById.get(reference.style_version_id)
    return {
      id: reference.id,
      styleCode: style?.code ?? String(patterns.target_style_code ?? ''),
      styleName: style?.name ?? String(patterns.target_style_code ?? ''),
      styleVersionId: reference.style_version_id ?? '',
      version: version?.version ?? 0,
      status: version?.status ?? 'review',
      sourceUrl: reference.source_url ?? '',
      referenceKey: String(patterns.reference_key ?? ''),
      format: patterns.format as 'human' | 'ai',
      selection: patterns.selection as 'full_representative' | 'fragment_supplement',
      role: String(patterns.role ?? ''),
      sourceFilename: String(patterns.source_filename ?? ''),
      durationSeconds: Number(patterns.duration_seconds ?? 0),
      coverageSeconds: Number(patterns.coverage_seconds ?? 0),
      coveragePercent: Number(patterns.coverage_percent ?? 0),
      audioTranscriptStatus: String(patterns.audio_transcript_status ?? ''),
      visualStatus: String(patterns.visual_status ?? ''),
      rightsState: String(patterns.rights_state ?? ''),
      timeline: Array.isArray(patterns.timeline) ? patterns.timeline as JsonRecord[] : [],
      unverified: Array.isArray(patterns.unverified) ? patterns.unverified.map(String) : [],
    }
  }).sort((a, b) => a.referenceKey.localeCompare(b.referenceKey) || a.sourceUrl.localeCompare(b.sourceUrl))
}

async function applyPublishedVideoReferenceRestorations(actorId: string | null) {
  const admin = createSupabaseAdmin()
  const entries = publishedRestorationPackage.published_representatives
  const codes = entries.map((entry) => entry.style_code)
  const { data: styles, error: styleError } = await admin.from('content_styles').select('id,code').in('code', codes)
  if (styleError) throw styleError
  const styleByCode = new Map((styles ?? []).map((style) => [style.code, style]))
  const styleIds = (styles ?? []).map((style) => style.id)
  const { data: versions, error: versionError } = await admin.from('style_versions')
    .select('id,style_id,version,status').in('style_id', styleIds).eq('status', 'published')
  if (versionError) throw versionError

  const inserted: string[] = []
  const updated: string[] = []
  await Promise.all(entries.map(async (entry) => {
    const style = styleByCode.get(entry.style_code)
    if (!style) throw new Error(`Published target style missing for ${entry.style_code}`)
    const version = (versions ?? [])
      .filter((item) => item.style_id === style.id)
      .sort((a, b) => b.version - a.version)[0]
    if (!version) throw new Error(`Published style version missing for ${entry.style_code}`)
    const url = publishedSourceUrl(entry)
    const row = {
      style_id: style.id,
      style_version_id: version.id,
      workspace_id: CORE_WORKSPACE_ID,
      reference_type: 'external',
      source_url: url,
      source_account: 'Published reference restoration 2026-10-03',
      extracted_patterns: publishedExtractedPatterns(entry),
      evidence_summary: `${entry.style_name_zh}正式代表片完整時間軸原片還原稿；畫面已逐段抽查，音訊仍待人工逐句聆聽。`,
      evidence_level: 'observed',
      confirmation_status: 'review',
      source_scope: 'workspace_private',
      confirmed_by: null,
      confirmed_at: null,
      created_by: actorId,
    }
    const { data: existing, error: lookupError } = await admin.from('style_references').select('id').eq('source_url', url).maybeSingle()
    if (lookupError) throw lookupError
    if (existing) {
      const { error: updateError } = await admin.from('style_references').update(row).eq('id', existing.id)
      if (updateError) throw updateError
      updated.push(url)
    } else {
      const { error: insertError } = await admin.from('style_references').insert(row)
      if (insertError) throw insertError
      inserted.push(url)
    }
  }))
  return { inserted, updated }
}

export async function loadAiReconstructionPromptSets(): Promise<AiReconstructionPromptSet[]> {
  const admin = createSupabaseAdmin()
  const { data: references, error } = await admin.from('style_references')
    .select('id,style_id,style_version_id,extracted_patterns,confirmation_status')
    .like('source_url', `${PROMPT_SOURCE_PREFIX}%`)
    .eq('confirmation_status', 'review')
  if (error) throw error
  if (!references?.length) return []
  const styleIds = [...new Set(references.map((reference) => reference.style_id))]
  const versionIds = [...new Set(references.map((reference) => reference.style_version_id).filter(Boolean))]
  const [{ data: styles, error: styleError }, { data: versions, error: versionError }] = await Promise.all([
    admin.from('content_styles').select('id,code,name').in('id', styleIds),
    admin.from('style_versions').select('id,version,status').in('id', versionIds),
  ])
  if (styleError || versionError) throw styleError || versionError
  const styleById = new Map((styles ?? []).map((style) => [style.id, style]))
  const versionById = new Map((versions ?? []).map((version) => [version.id, version]))
  return references.map((reference) => {
    const patterns = reference.extracted_patterns as JsonRecord
    const style = styleById.get(reference.style_id)
    const version = versionById.get(reference.style_version_id)
    return {
      id: reference.id,
      styleCode: style?.code ?? String(patterns.style_code ?? ''),
      styleName: style?.name ?? String(patterns.style_code ?? ''),
      styleVersionId: reference.style_version_id ?? '',
      version: version?.version ?? 0,
      status: version?.status ?? 'review',
      referenceKey: String(patterns.reference_key ?? ''),
      displayName: String(patterns.display_name_zh ?? ''),
      promptStatus: String(patterns.prompt_status ?? ''),
      sourceDurationSeconds: Number(patterns.source_duration_seconds ?? 0),
      shotCount: Array.isArray(patterns.shots) ? patterns.shots.length : 0,
      shots: Array.isArray(patterns.shots) ? patterns.shots as JsonRecord[] : [],
      unverified: Array.isArray(patterns.unverified) ? patterns.unverified.map(String) : [],
    }
  }).sort((a, b) => a.referenceKey.localeCompare(b.referenceKey))
}

async function applyAiReconstructionPromptSets(actorId: string | null) {
  const admin = createSupabaseAdmin()
  const codes = reconstructionPackage.styles.map((entry) => entry.style_code)
  const { data: styles, error: styleError } = await admin.from('content_styles').select('id,code').in('code', codes)
  if (styleError) throw styleError
  const styleByCode = new Map((styles ?? []).map((style) => [style.code, style]))
  const { data: versions, error: versionError } = await admin.from('style_versions')
    .select('id,style_id,version,status,rules').in('style_id', (styles ?? []).map((style) => style.id)).in('status', ['draft', 'review'])
  if (versionError) throw versionError
  const inserted: string[] = []
  const updated: string[] = []
  await Promise.all(reconstructionPackage.styles.map(async (entry) => {
    const style = styleByCode.get(entry.style_code)
    if (!style) throw new Error(`Target style missing for ${entry.style_code}`)
    const version = (versions ?? [])
      .filter((item) => item.style_id === style.id)
      .sort((a, b) => b.version - a.version)
      .find((item) => ((item.rules as JsonRecord).core_distribution as JsonRecord | undefined)?.source === AI_SOURCE)
    if (!version) throw new Error(`Core review version missing for ${entry.style_code}`)
    const url = `${PROMPT_SOURCE_PREFIX}${entry.reference_key}`
    const patterns: JsonRecord = {
      artifact_type: 'reconstruction_experiment_prompt',
      artifact_label_zh: '重建實驗 Prompt',
      semantic_separation: {
        original_video_restoration: 'linked_separate_artifact',
        style_specification: 'linked_style_version',
        demonstration_script: 'separate_artifact_not_in_this_record',
        reconstruction_prompt: 'stored_here',
      },
      reference_key: entry.reference_key,
      style_code: entry.style_code,
      display_name_zh: entry.display_name_zh,
      source_duration_seconds: entry.source_duration_seconds,
      prompt_status: entry.prompt_status,
      story_rule: entry.story_rule,
      global_visual_prompt: entry.global_visual_prompt,
      character_bible: entry.character_bible,
      scene_bible: entry.scene_bible,
      reference_image_requirements: entry.reference_image_requirements,
      stitching: entry.stitching,
      shots: entry.shots,
      test_order: entry.test_order,
      pass_criteria: entry.pass_criteria,
      common_constraints: reconstructionPackage.common,
      unverified: reconstructionPackage.unverified,
      execution: {
        generation_enabled: false,
        generation_runs: 0,
        api_transactions: 0,
        credits_used: 0,
        model_specific_parameters_verified: false,
        audio_fully_manually_verified_count: 0,
      },
    }
    const row = {
      style_id: style.id,
      style_version_id: version.id,
      workspace_id: CORE_WORKSPACE_ID,
      reference_type: 'external',
      source_url: url,
      source_account: 'Renee AI reconstruction prompt delivery',
      extracted_patterns: patterns,
      evidence_summary: `${entry.reference_key} 重建實驗 Prompt，共 ${entry.shots.length} 個短鏡；未執行生成，音訊仍待人工聆聽。`,
      evidence_level: 'candidate',
      confirmation_status: 'review',
      source_scope: 'workspace_private',
      confirmed_by: null,
      confirmed_at: null,
      created_by: actorId,
    }
    const { data: existing, error: lookupError } = await admin.from('style_references').select('id').eq('source_url', url).maybeSingle()
    if (lookupError) throw lookupError
    if (existing) {
      const { error: updateError } = await admin.from('style_references').update(row).eq('id', existing.id)
      if (updateError) throw updateError
      updated.push(url)
    } else {
      const { error: insertError } = await admin.from('style_references').insert(row)
      if (insertError) throw insertError
      inserted.push(url)
    }
  }))
  return { inserted, updated }
}

export async function applyVideoReferenceRestorations(actorId: string | null) {
  const admin = createSupabaseAdmin()
  const entries = allEntries()
  const codes = [...new Set(entries.map(targetStyleCode))]
  const { data: styles, error: styleError } = await admin.from('content_styles').select('id,code').in('code', codes)
  if (styleError) throw styleError
  const styleByCode = new Map((styles ?? []).map((style) => [style.code, style]))
  const styleIds = (styles ?? []).map((style) => style.id)
  const { data: versions, error: versionError } = await admin.from('style_versions')
    .select('id,style_id,version,status,rules').in('style_id', styleIds).in('status', ['draft', 'review'])
  if (versionError) throw versionError

  const inserted: string[] = []
  const updated: string[] = []
  await Promise.all(entries.map(async (entry) => {
    const code = targetStyleCode(entry)
    const style = styleByCode.get(code)
    if (!style) throw new Error(`Target style missing for ${code}`)
    const expectedSource = entry.format === 'human' ? HUMAN_SOURCE : AI_SOURCE
    const version = (versions ?? [])
      .filter((item) => item.style_id === style.id)
      .sort((a, b) => b.version - a.version)
      .find((item) => ((item.rules as JsonRecord).core_distribution as JsonRecord | undefined)?.source === expectedSource)
    if (!version) throw new Error(`Core review version missing for ${code}`)
    const url = sourceUrl(entry)
    const patterns = extractedPatterns(entry)
    const row = {
      style_id: style.id,
      style_version_id: version.id,
      workspace_id: CORE_WORKSPACE_ID,
      reference_type: 'external',
      source_url: url,
      source_account: 'Renee reference restoration delivery',
      extracted_patterns: patterns,
      evidence_summary: `${entry.reference_key} ${entry.selection === 'full_representative' ? '完整時間軸原片還原稿' : '精選片段原片還原稿'}；畫面狀態可見，音訊仍待人工逐句聆聽。`,
      evidence_level: 'observed',
      confirmation_status: 'review',
      source_scope: 'workspace_private',
      confirmed_by: null,
      confirmed_at: null,
      created_by: actorId,
    }
    const { data: existing, error: lookupError } = await admin.from('style_references').select('id').eq('source_url', url).maybeSingle()
    if (lookupError) throw lookupError
    if (existing) {
      const { error: updateError } = await admin.from('style_references').update(row).eq('id', existing.id)
      if (updateError) throw updateError
      updated.push(url)
    } else {
      const { error: insertError } = await admin.from('style_references').insert(row)
      if (insertError) throw insertError
      inserted.push(url)
    }
  }))
  const [publishedRestorations, promptSets] = await Promise.all([
    applyPublishedVideoReferenceRestorations(actorId),
    applyAiReconstructionPromptSets(actorId),
  ])
  return {
    source: SOURCE_PREFIX,
    publishedSource: PUBLISHED_SOURCE_PREFIX,
    insertedCount: inserted.length + publishedRestorations.inserted.length,
    updatedCount: updated.length + publishedRestorations.updated.length,
    publishedInsertedCount: publishedRestorations.inserted.length,
    publishedUpdatedCount: publishedRestorations.updated.length,
    promptSetInsertedCount: promptSets.inserted.length,
    promptSetUpdatedCount: promptSets.updated.length,
    audioFullyManuallyVerifiedCount: restorationPackage.summary.audio_fully_manually_verified_count,
    restorations: await loadVideoReferenceRestorations(),
    promptSets: await loadAiReconstructionPromptSets(),
  }
}
