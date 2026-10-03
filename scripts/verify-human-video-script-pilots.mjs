import { readFile } from 'node:fs/promises'

const contract = JSON.parse(await readFile(new URL('../data/human-video-script-pilot-contract.json', import.meta.url), 'utf8'))
const expected = new Set(['situational_multi_dish_tasting', 'on_location_fact_sprint'])
if (contract.contract_id !== 'human-video-script-pilot-v2' || contract.schema_version !== 2 || contract.script_schema_version !== 'human_video_script.v2') throw new Error('Unexpected pilot contract identity')
if (contract.pilots.length !== 2 || contract.pilots.some((pilot) => !expected.delete(pilot.code)) || expected.size) throw new Error('Pilot styles must contain the exact approved pair')
if (contract.paid_ai.enabled || contract.paid_ai.model_calls_in_core_pilot !== 0) throw new Error('Paid AI must remain disabled')
if (contract.response.generation_enabled || contract.response.script_schema_version !== 'human_video_script.v2') throw new Error('Contract availability must remain separate from generation')
if (!contract.legacy_compatibility.read.includes('script_flow') || !contract.legacy_compatibility.reopen_without_migration) throw new Error('Legacy script_flow compatibility missing')
for (const pilot of contract.pilots) {
  if (pilot.style.status !== 'published' || pilot.style.version !== 1 || !/^[0-9a-f]{64}$/.test(pilot.style.content_hash)) throw new Error(`${pilot.code}: invalid published style identity`)
  if (pilot.template.status !== 'published' || pilot.template.version !== 1 || !/^[0-9a-f]{64}$/.test(pilot.template.content_hash)) throw new Error(`${pilot.code}: invalid published template identity`)
  if (!pilot.narrative_structure.length || !pilot.shot_guidance.length || !pilot.voice.mode || !pilot.captions.human_review_required) throw new Error(`${pilot.code}: incomplete script contract`)
  const required = new Set(pilot.script_contract.required_beat_fields)
  const optional = new Set(pilot.script_contract.optional_beat_fields)
  if ([...required].some((field) => optional.has(field))) throw new Error(`${pilot.code}: required and optional beat fields overlap`)
  const count = pilot.script_contract.beat_count_guidance
  if (!(count.minimum <= count.ideal && count.ideal <= count.maximum)) throw new Error(`${pilot.code}: invalid beat count guidance`)
  if (!required.has('role') || !pilot.script_contract.role_profile.allowed_roles.length) throw new Error(`${pilot.code}: structured role profile missing`)
  if (pilot.script_contract.role_profile.mapping_status !== 'additive_contract_mapping_from_published_narrative_structure') throw new Error(`${pilot.code}: role provenance missing`)
  const definitions = pilot.script_contract.role_profile.definitions
  if (definitions.length !== pilot.script_contract.role_profile.allowed_roles.length || definitions.some((role) => !role.display_name_zh_hant || !role.condition)) throw new Error(`${pilot.code}: incomplete role definitions`)
  const roleCount = Object.values(pilot.script_contract.role_profile.counts).reduce((sum, range) => ({
    minimum: sum.minimum + range.minimum,
    maximum: sum.maximum + range.maximum,
  }), { minimum: 0, maximum: 0 })
  if (roleCount.minimum !== count.minimum || roleCount.maximum !== count.maximum) throw new Error(`${pilot.code}: role counts disagree with beat guidance`)
  if (!pilot.required_permissions.includes('workspace_access_confirmed') || !pilot.required_permissions.includes('asset_rights_confirmed')) throw new Error(`${pilot.code}: permission boundary missing`)
}
const [tasting, facts] = contract.pilots
if (tasting.duration_seconds.ideal === facts.duration_seconds.ideal) throw new Error('Pilot rhythms must remain distinct')
if (JSON.stringify(tasting.narrative_structure) === JSON.stringify(facts.narrative_structure)) throw new Error('Pilot structures must remain distinct')
if (tasting.script_contract.required_beat_fields.includes('spoken.text')) throw new Error('Tasting must preserve unknown reactions before capture')
if (tasting.script_contract.role_profile.counts.dish_tasting.minimum !== 2 || tasting.script_contract.role_profile.counts.dish_tasting.maximum !== 6) throw new Error('Tasting dish role count changed')
if (facts.script_contract.role_profile.counts.fact.minimum !== 3) throw new Error('Fact sprint minimum factual beats changed')
for (const field of ['spoken.text', 'subtitle.text', 'assetRefs', 'evidence.sourceRefs']) {
  if (!facts.script_contract.required_beat_fields.includes(field)) throw new Error(`Fact sprint missing required field: ${field}`)
}
for (const forbidden of ['editing_timeline', 'automatic_video_editing', 'video_generation', 'direct_social_publishing']) {
  if (!contract.excluded_capabilities.includes(forbidden)) throw new Error(`Missing excluded capability: ${forbidden}`)
}
console.log('Verified two immutable human-video script pilots with distinct structure and permission boundaries.')
