import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'

import candidateSpecs from '@/data/renee-human-video-production-specs.json'

const SOURCE = 'renee_reference_intake_2026_09_29'
const CORE_WORKSPACE_ID = 'a5c7750e-1b3b-495b-8cd3-6e1d47d05ef2'

type JsonRecord = Record<string, unknown>

type InternalSpecification = {
  code: string
  name: string
  description: string
  styleId: string
  versionId: string
  version: number
  status: 'draft' | 'review'
  specificationType: 'new_direction' | 'existing_direction_supplement'
  creatorEligible: false
  contentStudioEnabled: false
  generationEnabled: false
  rules: JsonRecord
}

const newDirectionIds: Record<string, { styleId: string; versionId: string }> = {
  multi_stop_city_curation: {
    styleId: '0d60ed22-efbc-43f7-b86d-8d2a9fe6d7e3',
    versionId: '669372ac-8d10-4063-9652-272cc25051af',
  },
  spectacle_first_experience_micro: {
    styleId: '40d9abb0-4029-4015-9789-52beebcb54ea',
    versionId: '8496133c-629e-440f-b9d8-e91c595973cb',
  },
  immersive_experience_reflection: {
    styleId: 'efde0b7e-fd72-4341-851b-bd808c137403',
    versionId: '273e62b4-258a-4b6c-9410-5bf4ceb20e14',
  },
}

const supplements: Array<{
  code: string
  summary: string
  patch: JsonRecord
}> = [
  {
    code: 'first_person_journey_diary',
    summary: 'Core-only review supplement: bucket-list experience and caption-led teaser variants from references 05 and 09.',
    patch: {
      production_variants: {
        bucket_list_experience: {
          reference_id: '05',
          duration_seconds: { min: 45, ideal: 75, max: 90 },
          arc: ['personal_wish', 'place_difference', 'pre_attempt_concern', 'complete_experience', 'first_real_reaction', 'separate_practical_tip'],
          capture_required: ['anticipated_subject', 'entry', 'rules_or_signage', 'first_reaction', 'complete_core_action', 'booking_or_visit_evidence'],
          facts_require_source_and_date: ['records', 'dates', 'capacity', 'booking', 'language', 'open_status'],
        },
        caption_led_teaser: {
          reference_id: '09',
          duration_seconds: { min: 15, ideal: 22, max: 30 },
          purpose: 'teaser_for_an_already_completed_journey_story',
          caption_cards: { min: 5, max: 8, one_complete_idea_each: true },
          capture_required: ['place_wide', 'core_activity', 'human_reaction', 'detail', 'exit_or_location_clue'],
          restriction: 'atmosphere_montage_is_not_a_travel_guide_without_visit_and_fact_evidence',
        },
      },
      reference_classification: {
        '05': 'approved_structure_supplement_bucket_list_experience',
        '09': 'approved_structure_supplement_caption_led_teaser',
      },
    },
  },
  {
    code: 'on_location_fact_sprint',
    summary: 'Core-only review supplement: voice-over micro tour variant from reference 08.',
    patch: {
      production_variants: {
        voiceover_micro_tour: {
          reference_id: '08',
          duration_seconds: { min: 25, ideal: 35, max: 45 },
          host_to_camera_required: false,
          arc: ['question', 'place_or_name', 'one_change_or_origin', 'two_to_four_visible_artefacts', 'current_state', 'callback_or_save'],
          capture_required: ['entrance_name', 'address_or_location_evidence', 'wide', 'three_details', 'host_visit_evidence_or_original_pov'],
          facts_require_source_and_date: ['first_claim', 'year', 'founder', 'free_claim', 'opening_hours', 'travel_time'],
        },
      },
      reference_classification: {
        '08': 'approved_structure_supplement_voiceover_micro_tour',
      },
    },
  },
  {
    code: 'human_product_demo_conversion',
    summary: 'Core-only review note: personalised novelty result handling from reference 06.',
    patch: {
      production_notes: {
        personalised_novelty_result: {
          reference_id: '06',
          use: 'result_first_then_order_delivery_packaging_physical_difference_and_real_use_or_tasting',
          requirements: ['commercial_relationship', 'price_or_purchase_conditions', 'material_or_food_information', 'storage_method'],
          restriction: 'do_not_claim_manufacturing_process_or_mechanism_without_process_footage',
        },
      },
      reference_classification: {
        '06': 'supplement_only_not_a_new_direction',
      },
    },
  },
]

function distribution(specificationType: InternalSpecification['specificationType']) {
  return {
    source: SOURCE,
    specification_type: specificationType,
    core_visibility: 'internal_review',
    creator_eligible: false,
    content_studio_enabled: false,
    generation_enabled: false,
    template_binding_allowed: false,
  }
}

function mergeRules(base: JsonRecord, patch: JsonRecord) {
  return {
    ...base,
    ...patch,
    production_variants: {
      ...((base.production_variants as JsonRecord | undefined) ?? {}),
      ...((patch.production_variants as JsonRecord | undefined) ?? {}),
    },
    production_notes: {
      ...((base.production_notes as JsonRecord | undefined) ?? {}),
      ...((patch.production_notes as JsonRecord | undefined) ?? {}),
    },
    reference_classification: {
      ...((base.reference_classification as JsonRecord | undefined) ?? {}),
      ...((patch.reference_classification as JsonRecord | undefined) ?? {}),
    },
  }
}

export async function loadInternalHumanVideoSpecifications(): Promise<InternalSpecification[]> {
  const admin = createSupabaseAdmin()
  const { data: styles, error: styleError } = await admin.from('content_styles')
    .select('id,code,name,description').eq('format', 'human_short_video')
  if (styleError) throw styleError
  const styleIds = (styles ?? []).map((style) => style.id)
  if (!styleIds.length) return []
  const { data: versions, error: versionError } = await admin.from('style_versions')
    .select('id,style_id,version,status,rules').in('style_id', styleIds)
    .in('status', ['draft', 'review']).order('version', { ascending: false })
  if (versionError) throw versionError
  const styleById = new Map((styles ?? []).map((style) => [style.id, style]))
  return (versions ?? []).flatMap((version) => {
    const style = styleById.get(version.style_id)
    const rules = version.rules as JsonRecord
    const intake = rules?.core_distribution as JsonRecord | undefined
    if (!style || intake?.source !== SOURCE) return []
    return [{
      code: style.code,
      name: style.name,
      description: style.description,
      styleId: style.id,
      versionId: version.id,
      version: version.version,
      status: version.status,
      specificationType: intake.specification_type as InternalSpecification['specificationType'],
      creatorEligible: false,
      contentStudioEnabled: false,
      generationEnabled: false,
      rules,
    }]
  })
}

export async function applyInternalHumanVideoSpecifications(actorId: string | null) {
  const admin = createSupabaseAdmin()
  const created: Array<{ code: string; version: number; status: string; type: string }> = []

  for (const candidate of candidateSpecs.directions) {
    const ids = newDirectionIds[candidate.code]
    if (!ids) throw new Error(`Missing stable identity for ${candidate.code}`)
    const { data: existingStyle, error: lookupError } = await admin.from('content_styles')
      .select('id').eq('code', candidate.code).maybeSingle()
    if (lookupError) throw lookupError
    let styleId = existingStyle?.id as string | undefined
    if (!styleId) {
      const { data: inserted, error } = await admin.from('content_styles').insert({
        id: ids.styleId,
        code: candidate.code,
        format: 'human_short_video',
        name: candidate.display_name,
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
      .select('id,version,status').eq('style_id', styleId).contains('rules', { core_distribution: { source: SOURCE } }).maybeSingle()
    if (existingVersionError) throw existingVersionError
    if (!existingVersion) {
      const rules = {
        ...candidate,
        schema_version: 1,
        output: { width: 1080, height: 1920, aspect_ratio: '9:16', target_seconds: candidate.duration_seconds },
        core_distribution: distribution('new_direction'),
        factual_guardrails: {
          unverified_source_claims_are_template_facts: false,
          allowed_labels: ['原片說法', '待核實'],
          source_and_checked_date_required: true,
        },
        reference_classification: candidate.code === 'spectacle_first_experience_micro'
          ? { '02': 'supporting_one_take_result_not_standalone', '03': 'analysis_only_rights_pending', '04': 'analysis_only_rights_pending', '07': 'primary_structure_reference' }
          : Object.fromEntries(candidate.reference_ids.map((id) => [id, 'primary_structure_reference'])),
      }
      const { error } = await admin.from('style_versions').insert({
        id: ids.versionId,
        style_id: styleId,
        version: 1,
        rules,
        change_summary: 'Core-only reviewed production specification; intentionally unavailable to Creator and Content Studio.',
        status: 'review',
        created_by: actorId,
        reviewed_by: actorId,
      })
      if (error) throw error
      created.push({ code: candidate.code, version: 1, status: 'review', type: 'new_direction' })
    } else created.push({ code: candidate.code, version: existingVersion.version, status: existingVersion.status, type: 'new_direction_existing' })
  }

  for (const supplement of supplements) {
    const { data: style, error: styleError } = await admin.from('content_styles')
      .select('id').eq('code', supplement.code).eq('format', 'human_short_video').single()
    if (styleError) throw styleError
    const { data: versions, error: versionError } = await admin.from('style_versions')
      .select('id,version,status,rules').eq('style_id', style.id).order('version', { ascending: false })
    if (versionError) throw versionError
    const existing = (versions ?? []).find((version) => (version.rules as JsonRecord)?.core_distribution &&
      ((version.rules as JsonRecord).core_distribution as JsonRecord).source === SOURCE)
    if (existing) {
      created.push({ code: supplement.code, version: existing.version, status: existing.status, type: 'supplement_existing' })
      continue
    }
    const base = (versions ?? []).find((version) => version.status === 'published')
    if (!base) throw new Error(`Published base style missing for ${supplement.code}`)
    const nextVersion = Math.max(...(versions ?? []).map((version) => version.version)) + 1
    const rules = mergeRules(base.rules as JsonRecord, {
      ...supplement.patch,
      core_distribution: distribution('existing_direction_supplement'),
    })
    const { error } = await admin.from('style_versions').insert({
      style_id: style.id,
      version: nextVersion,
      rules,
      change_summary: supplement.summary,
      status: 'review',
      created_by: actorId,
      reviewed_by: actorId,
    })
    if (error) throw error
    created.push({ code: supplement.code, version: nextVersion, status: 'review', type: 'supplement' })
  }

  return { source: SOURCE, created, specifications: await loadInternalHumanVideoSpecifications() }
}

