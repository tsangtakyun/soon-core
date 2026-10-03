import { createHash } from 'node:crypto'

import { NextResponse } from 'next/server'

import { pilotContract } from '@/lib/human-video-script-pilots'
import { authorisedStyleReader, loadPublishedStyles } from '@/lib/style-registry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type JsonRecord = Record<string, unknown>

const responseHeaders = { 'Cache-Control': 'private, no-store' }

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function values(value: unknown) {
  return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [])
}

function gapLabel(value: string) {
  const labels: Record<string, string> = {
    footage: '尚未確認可用實景影片。',
    presenter: '尚未確認可出鏡主持。',
    research: '尚未提供已核實資料及來源日期。',
    licensed_assets: '尚未確認資料圖片、音樂及字體使用權。',
    workspace_access_confirmed: '消費端尚未確認目前 workspace 存取權。',
    location_filming_confirmed: '尚未確認場地拍攝許可。',
    subject_release_confirmed: '尚未確認出鏡者同意。',
    asset_rights_confirmed: '尚未確認全部素材使用權。',
  }
  return labels[value] ?? `尚未確認：${value}`
}

export async function GET(request: Request) {
  if (!authorisedStyleReader(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(pilotContract, { headers: responseHeaders })
}

export async function POST(request: Request) {
  if (!authorisedStyleReader(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null) as JsonRecord | null
  if (!body || body.format !== 'human_short_video' || !['egg', 'creator'].includes(String(body.consumer)) || typeof body.brief !== 'string' || !body.brief.trim() || JSON.stringify(body).length > 100000) {
    return NextResponse.json({ error: 'Invalid production context' }, { status: 400, headers: responseHeaders })
  }

  const requested = values(body.pilotCodes)
  const selectedPilots = pilotContract.pilots.filter((pilot) => !requested.size || requested.has(pilot.code))
  if (!selectedPilots.length) return NextResponse.json({ error: 'No supported pilot style requested' }, { status: 422, headers: responseHeaders })

  try {
    const registry = await loadPublishedStyles({ format: 'human_short_video' })
    const byCode = new Map(registry.styles.map((style) => [style.code, style]))
    for (const pilot of selectedPilots) {
      const published = byCode.get(pilot.code)
      const template = published?.templates.find((item) => item.version.id === pilot.template.version_id)
      if (!published || published.styleId !== pilot.style.id || published.version.id !== pilot.style.version_id || published.version.contentHash !== pilot.style.content_hash || !template || template.version.contentHash !== pilot.template.content_hash) {
        return NextResponse.json({ error: `Pilot contract drift: ${pilot.code}` }, { status: 409, headers: responseHeaders })
      }
    }

    const materials = values(body.materials)
    const permissions = asRecord(body.permissions)
    const permissionValues = new Set(Object.entries(permissions).filter(([, enabled]) => enabled === true).map(([key]) => key))
    const contextHash = createHash('sha256').update(JSON.stringify({
      contract: pilotContract.contract_id,
      registry: registry.registryVersion,
      consumer: body.consumer,
      brief: body.brief,
      story: body.story ?? null,
      facts: body.facts ?? null,
      materials: [...materials].sort(),
      permissions: [...permissionValues].sort(),
      pilots: selectedPilots.map((pilot) => pilot.code),
    })).digest('hex')

    const styles = selectedPilots.map((pilot) => {
      const style = byCode.get(pilot.code)!
      if (!style.scriptContract) throw new Error(`Missing script contract: ${pilot.code}`)
      const missing = [
        ...pilot.required_materials.filter((item) => !materials.has(item)),
        ...pilot.required_permissions.filter((item) => !permissionValues.has(item)),
      ]
      return {
        ...style,
        recommendation: {
          score: missing.length ? 70 : 100,
          reason: pilot.code === 'situational_multi_dish_tasting'
            ? '用到訪情境及逐款試食循環組織同一題材，重點是真實入口、停頓及具體感受。'
            : '用實景提問及逐項知識快講組織同一題材，重點是來源、日期及畫面一一對應。',
          angle: pilot.code === 'situational_multi_dish_tasting'
            ? '按每款食物重複展示、入口、停頓、描述及有限度評價。'
            : '按每項已核實知識配一個實景或資料圖，最後回扣開場問題。',
          gaps: missing.map(gapLabel),
          preparationComplete: missing.length === 0,
          consumerPermissionCheckRequired: true,
        },
        scriptContract: style.scriptContract,
        pilotProfile: pilot,
      }
    })

    return NextResponse.json({
      schemaVersion: 1,
      phase: 'human_video_script_pilot',
      source: 'published_style_registry',
      recommendationMethod: 'deterministic_pilot_filter',
      paidModelCalls: 0,
      id: `pilot_${contextHash.slice(0, 32)}`,
      contractId: pilotContract.contract_id,
      registryVersion: registry.registryVersion,
      contextHash,
      candidateCount: styles.length,
      styles,
      emptyReason: '',
      outputCapability: 'human_video_script_contract',
      generationEnabled: false,
      legacyCompatibility: pilotContract.legacy_compatibility,
      permissions: pilotContract.permissions,
      excludedCapabilities: pilotContract.excluded_capabilities,
    }, { headers: responseHeaders })
  } catch (error) {
    console.error('[human video script pilots]', error)
    return NextResponse.json({ error: 'Pilot contract unavailable' }, { status: 503, headers: responseHeaders })
  }
}
