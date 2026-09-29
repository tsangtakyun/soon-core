import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'

import intakeSpec from '@/data/renee-ai-video-production-specs.json'

const SOURCE = 'renee_ai_video_reference_intake_2026_09_29'
const CORE_WORKSPACE_ID = 'a5c7750e-1b3b-495b-8cd3-6e1d47d05ef2'

type JsonRecord = Record<string, unknown>

type InternalSpecification = {
  code: string
  name: string
  description: string
  format: 'ai_short_video'
  styleId: string
  versionId: string
  version: number
  status: 'draft' | 'review'
  specificationType: 'new_direction' | 'existing_direction_supplement'
  creatorEligible: boolean
  contentStudioEnabled: boolean
  generationEnabled: boolean
  templateBindingAllowed: boolean
  activeBindingCount: number
  playableReferenceCount: number
  rules: JsonRecord
}

const newDirectionIds: Record<string, { styleId: string; versionId: string }> = {
  ai_absurd_twist_microdrama: {
    styleId: '92ec1d62-24fa-4833-96a7-a7114a934c8e',
    versionId: '9cffc550-3dc5-4de7-8188-d143f6d8f570',
  },
  ai_continuity_ensemble_skit: {
    styleId: '066cdf60-8c70-4d6d-ac2e-8cf4a098bd96',
    versionId: '7bec6f50-203a-4036-8c99-577643d74fb9',
  },
  ai_host_time_travel_tour: {
    styleId: '4a500f79-ae68-442e-aab1-e80ed10b5905',
    versionId: 'bb4e6c8b-d401-409b-8d8b-8c57cecd3737',
  },
}

const supplementVersionId = '45dab5e2-e3bf-4bab-8d74-a74d2d4bc8f3'

function distribution(specificationType: InternalSpecification['specificationType']) {
  return {
    source: SOURCE,
    specification_type: specificationType,
    core_visibility: 'internal_review',
    creator_eligible: false,
    content_studio_enabled: false,
    generation_enabled: false,
    template_binding_allowed: false,
    capability_claim: intakeSpec.storage_policy.capability_claim,
  }
}

function mergeRules(base: JsonRecord, patch: JsonRecord) {
  return {
    ...base,
    ...patch,
    visual_modules: {
      ...((base.visual_modules as JsonRecord | undefined) ?? {}),
      ...((patch.visual_modules as JsonRecord | undefined) ?? {}),
    },
    effect_research: {
      ...((base.effect_research as JsonRecord | undefined) ?? {}),
      ...((patch.effect_research as JsonRecord | undefined) ?? {}),
    },
    reference_classification: {
      ...((base.reference_classification as JsonRecord | undefined) ?? {}),
      ...((patch.reference_classification as JsonRecord | undefined) ?? {}),
    },
  }
}

export async function loadInternalAiVideoSpecifications(): Promise<InternalSpecification[]> {
  const admin = createSupabaseAdmin()
  const { data: styles, error: styleError } = await admin.from('content_styles')
    .select('id,code,name,description').eq('format', 'ai_short_video')
  if (styleError) throw styleError
  const styleIds = (styles ?? []).map((style) => style.id)
  if (!styleIds.length) return []
  const { data: versions, error: versionError } = await admin.from('style_versions')
    .select('id,style_id,version,status,rules').in('style_id', styleIds)
    .in('status', ['draft', 'review']).order('version', { ascending: false })
  if (versionError) throw versionError
  const sourceVersions = (versions ?? []).filter((version) => {
    const rules = version.rules as JsonRecord
    const intake = rules?.core_distribution as JsonRecord | undefined
    return intake?.source === SOURCE
  })
  if (!sourceVersions.length) return []
  const versionIds = sourceVersions.map((version) => version.id)
  const [{ data: bindings, error: bindingError }, { data: references, error: referenceError }] = await Promise.all([
    admin.from('style_template_bindings').select('style_version_id').in('style_version_id', versionIds).eq('status', 'active'),
    admin.from('style_references').select('style_version_id').in('style_version_id', versionIds),
  ])
  if (bindingError || referenceError) throw bindingError || referenceError
  const bindingCounts = new Map<string, number>()
  const referenceCounts = new Map<string, number>()
  for (const binding of bindings ?? []) bindingCounts.set(binding.style_version_id, (bindingCounts.get(binding.style_version_id) ?? 0) + 1)
  for (const reference of references ?? []) referenceCounts.set(reference.style_version_id, (referenceCounts.get(reference.style_version_id) ?? 0) + 1)
  const styleById = new Map((styles ?? []).map((style) => [style.id, style]))
  return sourceVersions.flatMap((version) => {
    const style = styleById.get(version.style_id)
    const rules = version.rules as JsonRecord
    const intake = rules.core_distribution as JsonRecord
    if (!style) return []
    return [{
      code: style.code,
      name: style.name,
      description: style.description,
      format: 'ai_short_video' as const,
      styleId: style.id,
      versionId: version.id,
      version: version.version,
      status: version.status,
      specificationType: intake.specification_type as InternalSpecification['specificationType'],
      creatorEligible: intake.creator_eligible === true,
      contentStudioEnabled: intake.content_studio_enabled === true,
      generationEnabled: intake.generation_enabled === true,
      templateBindingAllowed: intake.template_binding_allowed === true,
      activeBindingCount: bindingCounts.get(version.id) ?? 0,
      playableReferenceCount: referenceCounts.get(version.id) ?? 0,
      rules,
    }]
  })
}

export async function applyInternalAiVideoSpecifications(actorId: string | null) {
  const admin = createSupabaseAdmin()
  const applied: Array<{ code: string; version: number; status: string; type: string }> = []

  for (const candidate of intakeSpec.directions) {
    const ids = newDirectionIds[candidate.code]
    if (!ids) throw new Error(`Missing stable identity for ${candidate.code}`)
    const { data: existingStyle, error: lookupError } = await admin.from('content_styles')
      .select('id,format').eq('code', candidate.code).maybeSingle()
    if (lookupError) throw lookupError
    if (existingStyle && existingStyle.format !== 'ai_short_video') throw new Error(`Style code collision for ${candidate.code}`)
    let styleId = existingStyle?.id as string | undefined
    if (!styleId) {
      const { data: inserted, error } = await admin.from('content_styles').insert({
        id: ids.styleId,
        code: candidate.code,
        format: 'ai_short_video',
        name: candidate.name,
        description: candidate.intent,
        status: 'active',
        scope: 'soon_owned',
        source_workspace_id: CORE_WORKSPACE_ID,
        created_by: actorId,
      }).select('id').single()
      if (error) throw error
      styleId = inserted.id
    }
    const { data: existingVersion, error: existingVersionError } = await admin.from('style_versions')
      .select('id,version,status').eq('style_id', styleId)
      .contains('rules', { core_distribution: { source: SOURCE } }).maybeSingle()
    if (existingVersionError) throw existingVersionError
    if (!existingVersion) {
      const rules: JsonRecord = {
        ...candidate,
        schema_version: intakeSpec.schema_version,
        core_distribution: distribution('new_direction'),
        global_rights_and_fact_restrictions: intakeSpec.global_rights_and_fact_restrictions,
        reference_playback_allowed: false,
        source_project_files_supplied: false,
        generation_methods_verified: false,
      }
      if (candidate.code === 'ai_absurd_twist_microdrama') {
        rules.effect_research = intakeSpec.effect_research
        rules.excluded_direct_reference = intakeSpec.excluded_direct_reference
      }
      const { error } = await admin.from('style_versions').insert({
        id: ids.versionId,
        style_id: styleId,
        version: 1,
        rules,
        change_summary: 'Core-only AI video production specification; no generation capability or Creator distribution enabled.',
        status: 'review',
        created_by: actorId,
        reviewed_by: actorId,
      })
      if (error) throw error
      applied.push({ code: candidate.code, version: 1, status: 'review', type: 'new_direction' })
    } else applied.push({ code: candidate.code, version: existingVersion.version, status: existingVersion.status, type: 'new_direction_existing' })
  }

  const supplement = intakeSpec.existing_direction_supplement
  const { data: style, error: styleError } = await admin.from('content_styles')
    .select('id').eq('code', supplement.merge_target).eq('format', 'ai_short_video').single()
  if (styleError) throw styleError
  const { data: versions, error: versionError } = await admin.from('style_versions')
    .select('id,version,status,rules').eq('style_id', style.id).order('version', { ascending: false })
  if (versionError) throw versionError
  const existingSupplement = (versions ?? []).find((version) => {
    const rules = version.rules as JsonRecord
    return (rules.core_distribution as JsonRecord | undefined)?.source === SOURCE
  })
  if (existingSupplement) {
    applied.push({ code: supplement.merge_target, version: existingSupplement.version, status: existingSupplement.status, type: 'supplement_existing' })
  } else {
    const base = (versions ?? []).find((version) => version.status === 'published')
    if (!base) throw new Error(`Published base style missing for ${supplement.merge_target}`)
    const nextVersion = Math.max(...(versions ?? []).map((version) => version.version)) + 1
    const rules = mergeRules(base.rules as JsonRecord, {
      core_distribution: distribution('existing_direction_supplement'),
      visual_modules: {
        [supplement.module_code]: supplement,
      },
      effect_research: {
        [intakeSpec.effect_research.research_code]: intakeSpec.effect_research,
      },
      reference_classification: {
        '05': 'existing_artist_direction_visual_module_rights_pending',
        '06': 'cross_direction_effect_research_only_no_style_or_template',
        '08': 'excluded_direct_reference_third_party_ip',
      },
      global_rights_and_fact_restrictions: intakeSpec.global_rights_and_fact_restrictions,
      reference_playback_allowed: false,
    })
    const { error } = await admin.from('style_versions').insert({
      id: supplementVersionId,
      style_id: style.id,
      version: nextVersion,
      rules,
      change_summary: 'Core-only review supplement for artwork-in-reality module and cross-direction space-boundary effect research.',
      status: 'review',
      created_by: actorId,
      reviewed_by: actorId,
    })
    if (error) throw error
    applied.push({ code: supplement.merge_target, version: nextVersion, status: 'review', type: 'supplement' })
  }

  const specifications = await loadInternalAiVideoSpecifications()
  return { source: SOURCE, applied, specifications }
}
