import pilotContract from '@/data/human-video-script-pilot-contract.json'
import type { HumanVideoScriptStyleContract, PublishedStyle } from '@/types/style-registry'

export type HumanVideoPilot = (typeof pilotContract.pilots)[number]

const pilotsByCode = new Map(pilotContract.pilots.map((pilot) => [pilot.code, pilot]))

export function humanVideoPilot(code: string) {
  return pilotsByCode.get(code)
}

export function humanVideoScriptRegistrySeed() {
  return {
    contractId: pilotContract.contract_id,
    scriptSchemaVersion: pilotContract.script_schema_version,
    pilots: pilotContract.pilots.map((pilot) => ({
      code: pilot.code,
      style: pilot.style,
      scriptContract: pilot.script_contract,
    })),
  }
}

export function humanVideoScriptContract(
  style: Pick<PublishedStyle, 'code' | 'format' | 'name' | 'version'>,
  registryVersion: string,
): HumanVideoScriptStyleContract | undefined {
  const pilot = humanVideoPilot(style.code)
  if (!pilot || style.format !== 'human_short_video') return undefined
  if (
    style.version.id !== pilot.style.version_id
    || style.version.ref !== `style:${pilot.code}:v${pilot.style.version}`
    || style.version.contentHash !== pilot.style.content_hash
  ) return undefined

  return {
    contractVersion: 'human_video_script.v2',
    format: 'human_short_video',
    styleCode: style.code,
    styleName: style.name,
    styleVersionId: style.version.id,
    styleVersionRef: style.version.ref,
    styleContentHash: style.version.contentHash,
    registryVersion,
    requiredBeatFields: pilot.script_contract.required_beat_fields as HumanVideoScriptStyleContract['requiredBeatFields'],
    optionalBeatFields: pilot.script_contract.optional_beat_fields as HumanVideoScriptStyleContract['optionalBeatFields'],
    beatCountGuidance: {
      minimum: pilot.script_contract.beat_count_guidance.minimum,
      ideal: pilot.script_contract.beat_count_guidance.ideal,
      maximum: pilot.script_contract.beat_count_guidance.maximum,
    },
    roleProfile: {
      allowedRoles: pilot.script_contract.role_profile.allowed_roles,
      counts: Object.fromEntries(Object.entries(pilot.script_contract.role_profile.counts).map(([role, range]) => [role, {
        minimum: range.minimum,
        maximum: range.maximum,
      }])),
      order: pilot.script_contract.role_profile.order,
    },
  }
}

export { pilotContract }
